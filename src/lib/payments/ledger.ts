import fs from 'fs';
import path from 'path';
import {
  CreditTransaction,
  CreditTransactionType,
  CreditBalanceResponse,
  CreditReservation,
} from './types';
import { FREE_INITIAL_CREDITS } from './config';
import { safeLogger } from '../security/logger';
import { AppDatabase, defaultDb } from '../db/database';
import { DbTransaction } from '../db/schema';
import { TursoDatabase } from '../db/tursoDatabase';

export class CreditLedgerService {
  private transactions: Map<string, CreditTransaction[]> = new Map(); // userId -> transactions
  private balances: Map<string, number> = new Map(); // userId -> current total balance
  private freeGrantUsers: Set<string> = new Set(); // users who have received initial free grant
  private redeemedOrders: Set<string> = new Set(); // orderId / captureId already credited
  private migratedAnonymousUsers: Set<string> = new Set();
  private activeReservations: Map<string, CreditReservation> = new Map(); // reservationId -> reservation
  private userMutexes: Map<string, Promise<unknown>> = new Map(); // serialization lock per user
  private journalPath: string | null = null;
  private isDurable: boolean = false;
  private initialization: Promise<void> | null = null;
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || process.env.DATA_DIR || path.join(process.cwd(), '.data');
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.initStorage().catch((error: unknown) => {
        this.initialization = null;
        this.isDurable = false;
        throw error;
      });
    }
    return this.initialization;
  }

  private async initStorage(): Promise<void> {
    if (defaultDb instanceof AppDatabase && !(defaultDb instanceof TursoDatabase)) {
      const dataDir = this.storageDir;
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const legacyJournalPath = path.join(dataDir, 'credit_ledger.jsonl');
      await this.migrateLegacyJournalIfPresent(legacyJournalPath);
    }

    await this.loadFromSQLite();
    this.isDurable = true;
    safeLogger.info(`Credit ledger initialized with durable storage at: ${defaultDb.getDatabasePath()}`);
  }

  /**
   * One-time migration: reads legacy credit_ledger.jsonl, records it in the database, and unlinks the file.
   */
  private async migrateLegacyJournalIfPresent(legacyJournalPath: string): Promise<void> {
    if (!fs.existsSync(legacyJournalPath)) return;
    const fileData = fs.readFileSync(legacyJournalPath, 'utf8');
    const lines = fileData.split('\n');
    let migratedCount = 0;
    const transactions: CreditTransaction[] = [];

    for (const [index, line] of lines.entries()) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        transactions.push(JSON.parse(trimmed) as CreditTransaction);
      } catch (error) {
        throw new Error(`Invalid legacy credit journal entry on line ${index + 1}.`, {
          cause: error,
        });
      }
    }

    for (const tx of transactions) {
      await defaultDb.recordTransaction({
        id: tx.id,
        userId: tx.userId,
        type: tx.type,
        amount: tx.amount,
        balanceAfter: tx.balanceAfter,
        reason: tx.reason,
        idempotencyKey: tx.idempotencyKey,
        metadata: tx.metadata,
        createdAt: tx.timestamp,
      });
      migratedCount++;
    }
    fs.unlinkSync(legacyJournalPath);
    safeLogger.info(`Successfully migrated ${migratedCount} legacy transactions from credit_ledger.jsonl into the database and removed JSONL file.`);
  }

  /**
   * Loads existing transactions directly from the SQLite database.
   */
  private async loadFromSQLite(): Promise<void> {
    const rows = await defaultDb.getAllTransactions();
    for (const row of rows) {
      let metadata: Record<string, unknown> | undefined = undefined;
      if (row.metadata_json) {
        try {
          metadata = JSON.parse(row.metadata_json);
        } catch {
          // ignore malformed historical metadata
        }
      }
      const tx: CreditTransaction = {
        id: row.id,
        userId: row.user_id,
        timestamp: row.created_at,
        type: row.type as CreditTransactionType,
        amount: row.amount,
        balanceAfter: row.balance_after,
        reason: row.reason,
        idempotencyKey: row.idempotency_key || undefined,
        metadata,
      };
      this.applyTransactionToMemory(tx);
    }
    for (const state of await defaultDb.getAllUserCreditStates()) {
      this.balances.set(state.user_id, state.credits_available);
      if (state.has_received_free_grant) {
        this.freeGrantUsers.add(state.user_id);
      }
    }
  }

  /**
   * Records a transaction in the configured database for ACID durability.
   */
  private async appendToJournal(tx: CreditTransaction): Promise<DbTransaction> {
    return await defaultDb.recordTransaction({
      id: tx.id,
      userId: tx.userId,
      type: tx.type,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      reason: tx.reason,
      idempotencyKey: tx.idempotencyKey,
      metadata: tx.metadata,
      createdAt: tx.timestamp,
    });
  }

  private applyTransactionToMemory(tx: CreditTransaction) {
    const list = this.transactions.get(tx.userId) || [];
    list.push(tx);
    this.transactions.set(tx.userId, list);
    this.balances.set(tx.userId, tx.balanceAfter);

    if (tx.type === 'initial_grant') {
      this.freeGrantUsers.add(tx.userId);
    }

    if (tx.metadata?.orderId) {
      this.redeemedOrders.add(tx.metadata.orderId);
    }
    if (tx.metadata?.captureId) {
      this.redeemedOrders.add(tx.metadata.captureId);
    }
  }

  /**
   * Runs an operation with strict per-user mutex serialization to prevent concurrent race conditions.
   */
  private async withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    const prev = this.userMutexes.get(userId) || Promise.resolve();
    let resolveLock!: () => void;
    const current = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.userMutexes.set(userId, prev.then(() => current));

    try {
      await prev;
      return await fn();
    } finally {
      resolveLock();
      if (this.userMutexes.get(userId) === current) {
        this.userMutexes.delete(userId);
      }
    }
  }

  /**
   * Synchronously initializes free credits for a user if not already initialized (internal helper).
   */
  private async initUser(userId: string): Promise<void> {
    const persistedState = await defaultDb.getUserCreditState(userId);
    if (persistedState) {
      this.balances.set(userId, persistedState.credits_available);
      if (persistedState.has_received_free_grant) {
        this.freeGrantUsers.add(userId);
      }
    }
    if (this.freeGrantUsers.has(userId)) return;
    if (this.migratedAnonymousUsers.has(userId) ||
        await defaultDb.hasAnonymousCreditMigration(userId)) {
      this.migratedAnonymousUsers.add(userId);
      return;
    }

    const currentBalance = this.balances.get(userId) || 0;
    const newBalance = currentBalance + FREE_INITIAL_CREDITS;

    const tx: CreditTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      timestamp: new Date().toISOString(),
      type: 'initial_grant',
      amount: FREE_INITIAL_CREDITS,
      balanceAfter: newBalance,
      reason: `Freemium Welcome Bonus (${FREE_INITIAL_CREDITS} Free Analysis Credits)`,
      idempotencyKey: `free_grant_${userId}`,
    };

    const persisted = await this.appendToJournal(tx);
    tx.balanceAfter = persisted.balance_after;
    this.applyTransactionToMemory(tx);

    safeLogger.info(`Granted ${FREE_INITIAL_CREDITS} free credits to user ${userId}`);
  }

  /**
   * Idempotently gets or creates a user and grants their one-time 3 free credits.
   */
  async getOrCreateUser(userId: string): Promise<CreditBalanceResponse> {
    return this.withUserLock(userId, async () => {
      await this.initUser(userId);
      return this.computeBalanceResponse(userId);
    });
  }

  /**
   * Returns current user balance, active reservations, and availability.
   */
  async getBalance(userId: string): Promise<CreditBalanceResponse> {
    return this.withUserLock(userId, async () => {
      await this.initUser(userId);
      return this.computeBalanceResponse(userId);
    });
  }

  private computeBalanceResponse(userId: string): CreditBalanceResponse {
    const balance = this.balances.get(userId) || 0;
    const now = Date.now();

    // Sum active, non-expired reservations
    let reserved = 0;
    for (const [resId, res] of this.activeReservations.entries()) {
      if (res.userId === userId && res.status === 'pending') {
        if (now > res.expiresAt) {
          // Expired reservation auto-released
          res.status = 'released';
          this.activeReservations.delete(resId);
        } else {
          reserved += res.amount;
        }
      }
    }

    const available = Math.max(0, balance - reserved);
    const txs = this.transactions.get(userId) || [];

    return {
      userId,
      balance,
      reserved,
      available,
      hasReceivedFreeGrant: this.freeGrantUsers.has(userId),
      transactionsCount: txs.length,
    };
  }

  /**
   * Concurrency-safe reservation of credits before an analysis starts.
   * Throws Error if insufficient available credits.
   */
  async reserveCredits(
    userId: string,
    amount: number,
    analysisType: 'text' | 'url' | 'image'
  ): Promise<CreditReservation> {
    return this.withUserLock(userId, async () => {
      await this.initUser(userId);

      const balanceInfo = this.computeBalanceResponse(userId);
      if (balanceInfo.available < amount) {
        const err = new Error(
          `Insufficient credits. Required: ${amount}, Available: ${balanceInfo.available}.`
        );
        (err as any).code = 'INSUFFICIENT_CREDITS';
        (err as any).available = balanceInfo.available;
        (err as any).required = amount;
        throw err;
      }

      const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const reservation: CreditReservation = {
        reservationId,
        userId,
        amount,
        createdAt: Date.now(),
        expiresAt: Date.now() + 120 * 1000, // 2-minute reservation TTL
        status: 'pending',
        analysisType,
      };

      this.activeReservations.set(reservationId, reservation);
      safeLogger.info(
        `Reserved ${amount} credits for user ${userId} (${analysisType}). Available now: ${balanceInfo.available - amount}`
      );

      return reservation;
    });
  }

  /**
   * Commits a pending reservation into a permanent analysis_debit transaction.
   */
  async commitReservation(
    reservationId: string,
    analysisId: string,
    metadata?: Record<string, unknown>
  ): Promise<CreditTransaction | null> {
    const reservation = this.activeReservations.get(reservationId);
    if (!reservation || reservation.status !== 'pending') {
      return null;
    }

    return this.withUserLock(reservation.userId, async () => {
      await this.initUser(reservation.userId);
      const currentBalance = this.balances.get(reservation.userId) || 0;
      const newBalance = Math.max(0, currentBalance - reservation.amount);

      const tx: CreditTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        userId: reservation.userId,
        timestamp: new Date().toISOString(),
        type: 'analysis_debit',
        amount: -reservation.amount,
        balanceAfter: newBalance,
        reason: `${reservation.analysisType.toUpperCase()} Analysis (${analysisId})`,
        idempotencyKey: `debit_${analysisId}`,
        metadata: {
          analysisId,
          analysisType: reservation.analysisType,
          ...metadata,
        },
      };

      const persisted = await this.appendToJournal(tx);
      if (persisted.id !== tx.id) {
        reservation.status = 'committed';
        this.activeReservations.delete(reservationId);
        const state = await defaultDb.getUserCreditState(reservation.userId);
        if (state) this.balances.set(reservation.userId, state.credits_available);
        return this.toCreditTransaction(persisted);
      }
      tx.balanceAfter = persisted.balance_after;
      reservation.status = 'committed';
      this.activeReservations.delete(reservationId);
      this.applyTransactionToMemory(tx);

      safeLogger.info(
        `Committed debit of ${reservation.amount} credits for user ${reservation.userId}. New balance: ${tx.balanceAfter}`
      );
      return tx;
    });
  }

  /**
   * Releases a pending reservation if an analysis fails or aborts.
   */
  async releaseReservation(reservationId: string, reason: string = 'analysis_failed'): Promise<boolean> {
    const reservation = this.activeReservations.get(reservationId);
    if (!reservation || reservation.status !== 'pending') {
      return false;
    }

    return this.withUserLock(reservation.userId, async () => {
      reservation.status = 'released';
      this.activeReservations.delete(reservationId);
      safeLogger.info(
        `Released reservation ${reservationId} of ${reservation.amount} credits for user ${reservation.userId} (reason: ${reason})`
      );
      return true;
    });
  }

  /**
   * Idempotently credits a user account following a verified PayPal purchase.
   */
  async addPurchaseCredits(
    userId: string,
    credits: number,
    orderId: string,
    captureId: string,
    packageId: string,
    price: string,
    currency: string
  ): Promise<{ transaction: CreditTransaction; alreadyRedeemed: boolean }> {
    return this.withUserLock(userId, async () => {
      // 1. Strict Idempotency Check
      if (this.redeemedOrders.has(orderId) || this.redeemedOrders.has(captureId)) {
        safeLogger.warn(
          `Idempotency guard: PayPal order ${orderId} / capture ${captureId} was already credited.`
        );
        const existingTx = (this.transactions.get(userId) || []).find(
          (t) => t.metadata?.orderId === orderId || t.metadata?.captureId === captureId
        );
        return {
          transaction: existingTx!,
          alreadyRedeemed: true,
        };
      }

      // Ensure user initialized
      await this.initUser(userId);

      const currentBalance = this.balances.get(userId) || 0;
      const newBalance = currentBalance + credits;

      const tx: CreditTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        userId,
        timestamp: new Date().toISOString(),
        type: 'purchase_credit',
        amount: credits,
        balanceAfter: newBalance,
        reason: `PayPal Purchase: Package ${packageId} (${credits} credits for ${price} ${currency})`,
        idempotencyKey: `paypal_${orderId}_${captureId}`,
        metadata: {
          orderId,
          captureId,
          packageId,
          price,
          currency,
        },
      };

      const persisted = await this.appendToJournal(tx);
      if (persisted.id !== tx.id) {
        return {
          transaction: this.toCreditTransaction(persisted),
          alreadyRedeemed: true,
        };
      }
      tx.balanceAfter = persisted.balance_after;
      this.applyTransactionToMemory(tx);

      safeLogger.info(
        `Credited ${credits} purchased credits to user ${userId} for PayPal order ${orderId}. New balance: ${tx.balanceAfter}`
      );

      return {
        transaction: tx,
        alreadyRedeemed: false,
      };
    });
  }

  /**
   * Reconciles refunds or reversals by deducting credits down to 0 and recording the transaction.
   */
  async reconcileRefund(
    userId: string,
    captureId: string,
    refundId: string,
    creditsToDeduct: number
  ): Promise<CreditTransaction | null> {
    return this.withUserLock(userId, async () => {
      await this.initUser(userId);
      // Check if refund already processed
      const existingRefund = (this.transactions.get(userId) || []).find(
        (t) => t.metadata?.refundId === refundId
      );
      if (existingRefund) {
        return existingRefund;
      }

      const currentBalance = this.balances.get(userId) || 0;
      const actualDeduction = Math.min(currentBalance, creditsToDeduct);
      const newBalance = Math.max(0, currentBalance - actualDeduction);

      const tx: CreditTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        userId,
        timestamp: new Date().toISOString(),
        type: 'refund_reversal',
        amount: actualDeduction === 0 ? 0 : -actualDeduction,
        balanceAfter: newBalance,
        reason: `PayPal Refund Reversal (Capture: ${captureId}, Refund: ${refundId})`,
        idempotencyKey: `refund_${refundId}`,
        metadata: {
          captureId,
          refundId,
        },
      };

      const persisted = await this.appendToJournal(tx);
      if (persisted.id !== tx.id) return this.toCreditTransaction(persisted);
      tx.balanceAfter = persisted.balance_after;
      this.applyTransactionToMemory(tx);

      safeLogger.info(
        `Processed refund reversal of ${actualDeduction} credits for user ${userId}. New balance: ${tx.balanceAfter}`
      );
      return tx;
    });
  }

  /**
   * Retrieves transaction history for user.
   */
  async getTransactions(userId: string): Promise<CreditTransaction[]> {
    return this.withUserLock(userId, async () => {
      const rows = await defaultDb.getTransactionsByUser(userId, 50);
      return rows.map((row) => this.toCreditTransaction(row));
    });
  }

  private toCreditTransaction(row: DbTransaction): CreditTransaction {
    let metadata: Record<string, unknown> | undefined;
    if (row.metadata_json) {
      try {
        metadata = JSON.parse(row.metadata_json);
      } catch {
        // Ignore malformed historical metadata.
      }
    }
    return {
      id: row.id,
      userId: row.user_id,
      timestamp: row.created_at,
      type: row.type as CreditTransactionType,
      amount: row.amount,
      balanceAfter: row.balance_after,
      reason: row.reason,
      idempotencyKey: row.idempotency_key || undefined,
      metadata,
    };
  }

  /**
   * Migrates credits and transaction history from an anonymous user to an authenticated account.
   */
  async migrateUser(fromUserId: string, toUserId: string): Promise<CreditBalanceResponse> {
    if (!fromUserId || !toUserId || fromUserId === toUserId) {
      return this.getBalance(toUserId);
    }

    return this.withUserLock(toUserId, async () => {
      return this.withUserLock(fromUserId, async () => {
        await this.initUser(fromUserId);
        const fromBalance = this.balances.get(fromUserId) || 0;
        const alreadyMigrated = this.migratedAnonymousUsers.has(fromUserId) ||
          await defaultDb.hasAnonymousCreditMigration(fromUserId);

        if (fromBalance > 0 && !alreadyMigrated) {
          const targetState = await defaultDb.getUserCreditState(toUserId);
          const targetHasReceivedFreeGrant = this.freeGrantUsers.has(toUserId) ||
            Boolean(targetState?.has_received_free_grant);
          const transactions: CreditTransaction[] = [];

          if (!targetHasReceivedFreeGrant) {
            const toBalance = this.balances.get(toUserId) ?? targetState?.credits_available ?? 0;
            const newBalance = toBalance + fromBalance;
            const timestamp = new Date().toISOString();
            transactions.push({
              id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              userId: fromUserId,
              timestamp,
              type: 'administrative_adjustment',
              amount: -fromBalance,
              balanceAfter: 0,
              reason: `Account link: transferred ${fromBalance} credits`,
              idempotencyKey: `merge_${fromUserId}_to_${toUserId}_debit`,
              metadata: { mergedTo: toUserId },
            });
            transactions.push({
              id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              userId: toUserId,
              timestamp,
              type: 'initial_grant',
              amount: fromBalance,
              balanceAfter: newBalance,
              reason: `Account link: merged ${fromBalance} credits from anonymous session`,
              idempotencyKey: `merge_${fromUserId}_to_${toUserId}`,
              metadata: { mergedFrom: fromUserId },
            });
          }

          const migrated = await defaultDb.recordAnonymousCreditMigration(
            fromUserId,
            toUserId,
            transactions
          );
          if (migrated) {
            this.migratedAnonymousUsers.add(fromUserId);
            for (const tx of transactions) this.applyTransactionToMemory(tx);
        }
        }

        await defaultDb.migrateAnonymousData(fromUserId, toUserId);

        const fromTransactions = this.transactions.get(fromUserId) || [];
        if (fromTransactions.length > 0) {
          const toTransactions = this.transactions.get(toUserId) || [];
          this.transactions.set(toUserId, [...toTransactions, ...fromTransactions]);
          this.transactions.delete(fromUserId);
        }

        return this.computeBalanceResponse(toUserId);
      });
    });
  }

  /**
   * Resets ledger in memory and in SQLite (for test suite cleanup).
   */
  async reset(): Promise<void> {
    this.transactions.clear();
    this.balances.clear();
    this.freeGrantUsers.clear();
    this.redeemedOrders.clear();
    this.migratedAnonymousUsers.clear();
    this.activeReservations.clear();
    this.userMutexes.clear();

    await defaultDb.clearAllTransactions();

    if (this.journalPath && fs.existsSync(this.journalPath)) {
      fs.unlinkSync(this.journalPath);
    }
  }

  get durabilityStatus(): {
    isDurable: boolean;
    storage: 'sqlite' | 'turso';
    databasePath: string;
    journalPath: string | null;
  } {
    return {
      isDurable: this.isDurable,
      storage: defaultDb instanceof TursoDatabase ? 'turso' : 'sqlite',
      databasePath: defaultDb.getDatabasePath(),
      journalPath: this.journalPath,
    };
  }
}

export const defaultCreditLedger = new CreditLedgerService();

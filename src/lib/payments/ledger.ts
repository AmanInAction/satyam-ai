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
import { defaultDb } from '../db/database';

export class CreditLedgerService {
  private transactions: Map<string, CreditTransaction[]> = new Map(); // userId -> transactions
  private balances: Map<string, number> = new Map(); // userId -> current total balance
  private freeGrantUsers: Set<string> = new Set(); // users who have received initial free grant
  private redeemedOrders: Set<string> = new Set(); // orderId / captureId already credited
  private activeReservations: Map<string, CreditReservation> = new Map(); // reservationId -> reservation
  private userMutexes: Map<string, Promise<unknown>> = new Map(); // serialization lock per user
  private journalPath: string | null = null;
  private isDurable: boolean = false;

  constructor(storageDir?: string) {
    if (storageDir) {
      this.initStorage(storageDir);
    } else {
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), '.data');
      this.initStorage(dataDir);
    }
  }

  private initStorage(dataDir: string) {
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.journalPath = path.join(dataDir, 'credit_ledger.jsonl');
      this.loadJournal();
      this.isDurable = true;
      safeLogger.info(`Credit ledger initialized with durable storage at: ${this.journalPath}`);
    } catch (err: unknown) {
      this.isDurable = false;
      safeLogger.warn(
        `Failed to initialize durable storage for credit ledger (${(err as Error)?.message}). Operating with in-memory persistence.`
      );
    }
  }

  /**
   * Loads existing transactions from the append-only journal file on disk.
   */
  private loadJournal() {
    if (!this.journalPath || !fs.existsSync(this.journalPath)) return;

    try {
      const fileData = fs.readFileSync(this.journalPath, 'utf8');
      const lines = fileData.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const tx: CreditTransaction = JSON.parse(trimmed);
          this.applyTransactionToMemory(tx);
        } catch {
          // Ignore malformed line
        }
      }
    } catch (err: unknown) {
      safeLogger.error(`Error loading credit ledger journal: ${(err as Error)?.message}`);
    }
  }

  /**
   * Appends a transaction to the on-disk journal atomically.
   */
  private appendToJournal(tx: CreditTransaction) {
    if (this.journalPath) {
      try {
        fs.appendFileSync(this.journalPath, JSON.stringify(tx) + '\n', 'utf8');
      } catch (err: unknown) {
        safeLogger.error(`Failed to write transaction to journal: ${(err as Error)?.message}`);
      }
    }
    // Also record synchronously into SQLite for ACID persistence
    try {
      defaultDb.recordTransaction({
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
    } catch (dbErr: unknown) {
      safeLogger.warn(`SQLite transaction sync notice: ${(dbErr as Error)?.message}`);
    }
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
  private initUserSync(userId: string): void {
    if (!this.freeGrantUsers.has(userId)) {
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

      this.applyTransactionToMemory(tx);
      this.appendToJournal(tx);

      safeLogger.info(`Granted ${FREE_INITIAL_CREDITS} free credits to user ${userId}`);
    }
  }

  /**
   * Idempotently gets or creates a user and grants their one-time 3 free credits.
   */
  async getOrCreateUser(userId: string): Promise<CreditBalanceResponse> {
    return this.withUserLock(userId, async () => {
      this.initUserSync(userId);
      return this.computeBalanceResponse(userId);
    });
  }

  /**
   * Returns current user balance, active reservations, and availability.
   */
  async getBalance(userId: string): Promise<CreditBalanceResponse> {
    return this.withUserLock(userId, async () => {
      this.initUserSync(userId);
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
      this.initUserSync(userId);

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
      reservation.status = 'committed';
      this.activeReservations.delete(reservationId);

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

      this.applyTransactionToMemory(tx);
      this.appendToJournal(tx);

      safeLogger.info(
        `Committed debit of ${reservation.amount} credits for user ${reservation.userId}. New balance: ${newBalance}`
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
      this.initUserSync(userId);

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

      this.applyTransactionToMemory(tx);
      this.appendToJournal(tx);

      safeLogger.info(
        `Credited ${credits} purchased credits to user ${userId} for PayPal order ${orderId}. New balance: ${newBalance}`
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

      this.applyTransactionToMemory(tx);
      this.appendToJournal(tx);

      safeLogger.info(
        `Processed refund reversal of ${actualDeduction} credits for user ${userId}. New balance: ${newBalance}`
      );
      return tx;
    });
  }

  /**
   * Retrieves transaction history for user.
   */
  async getTransactions(userId: string): Promise<CreditTransaction[]> {
    return this.withUserLock(userId, async () => {
      return [...(this.transactions.get(userId) || [])].reverse();
    });
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
        const fromBalance = this.balances.get(fromUserId) || 0;
        const toBalance = this.balances.get(toUserId) || 0;

        if (fromBalance > 0) {
          const newBalance = toBalance + fromBalance;
          this.balances.set(toUserId, newBalance);
          this.balances.set(fromUserId, 0);

          const tx: CreditTransaction = {
            id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            userId: toUserId,
            timestamp: new Date().toISOString(),
            type: 'initial_grant',
            amount: fromBalance,
            balanceAfter: newBalance,
            reason: `Account link: merged ${fromBalance} credits from anonymous session`,
            idempotencyKey: `merge_${fromUserId}_to_${toUserId}`,
            metadata: { mergedFrom: fromUserId },
          };
          this.applyTransactionToMemory(tx);
          this.appendToJournal(tx);
        }

        const fromTxs = this.transactions.get(fromUserId) || [];
        const toTxs = this.transactions.get(toUserId) || [];
        this.transactions.set(toUserId, [...toTxs, ...fromTxs]);
        this.transactions.delete(fromUserId);

        try {
          defaultDb.migrateAnonymousData(fromUserId, toUserId);
        } catch {
          // ignore
        }

        return this.computeBalanceResponse(toUserId);
      });
    });
  }

  /**
   * Resets ledger in memory and deletes test journal (for test suite cleanup).
   */
  reset(): void {
    this.transactions.clear();
    this.balances.clear();
    this.freeGrantUsers.clear();
    this.redeemedOrders.clear();
    this.activeReservations.clear();
    this.userMutexes.clear();

    if (this.journalPath && fs.existsSync(this.journalPath)) {
      try {
        fs.unlinkSync(this.journalPath);
      } catch {
        // ignore
      }
    }
  }

  get durabilityStatus(): { isDurable: boolean; journalPath: string | null } {
    return {
      isDurable: this.isDurable,
      journalPath: this.journalPath,
    };
  }
}

export const defaultCreditLedger = new CreditLedgerService();

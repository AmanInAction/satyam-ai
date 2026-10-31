import crypto from 'node:crypto';
import { createClient, type Client, type Transaction } from '@tursodatabase/serverless/compat';
import {
  DbAnalysis,
  DbSession,
  DbTransaction,
  DbUser,
  DbUserCreditState,
} from './schema';

type AnalysisInput = {
  id: string;
  userId: string;
  inputType: 'text' | 'url' | 'image';
  inputPreview: string;
  verdict: string;
  scamRisk: string;
  claimVerdict: string;
  confidenceScore: number;
  reasonsSummary: string;
  fullResult: unknown;
};

type TransactionInput = {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

type TransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  reason: string;
  idempotency_key: string | null;
  metadata_json: string | null;
  created_at: string;
};

export class TursoDatabase {
  private client: Client | null = null;
  private initialization: Promise<void> | null = null;

  private getClient(): Client {
    if (this.client) return this.client;
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for Vercel database access.');
    }

    this.client = createClient({ url, authToken });
    return this.client;
  }

  private async ensureInitialized(): Promise<Client> {
    const client = this.getClient();
    if (!this.initialization) {
      this.initialization = client.execute({
        sql: 'SELECT version FROM app_schema_migrations WHERE version = ?',
        args: [1],
      }).then((result) => {
        if (result.rows.length === 0) {
          throw new Error('Turso schema version 1 is missing. Run `npm run db:migrate:turso` before deployment.');
        }
      }).catch((error: unknown) => {
        this.initialization = null;
        throw new Error('Unable to verify the Turso database schema or connect to Turso.', { cause: error });
      });
    }

    await this.initialization;
    return client;
  }

  private async execute(
    sql: string,
    args: Array<string | number | null> = [],
    transaction?: Transaction
  ) {
    const client = await this.ensureInitialized();
    return transaction
      ? transaction.execute({ sql, args })
      : client.execute({ sql, args });
  }

  private async writeTransaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const client = await this.ensureInitialized();
    const tx = await client.transaction('write');
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  public createTelegramLinkCode(userId: string, codeHash: string, expiresAt: number): Promise<void> {
    const now = new Date().toISOString();
    return this.writeTransaction(async (tx) => {
      await this.execute('DELETE FROM telegram_link_codes WHERE expires_at <= ?', [Date.now()], tx);
      await this.execute('DELETE FROM telegram_link_codes WHERE user_id = ?', [userId], tx);
      await this.execute(`
        INSERT INTO telegram_link_codes (code_hash, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `, [codeHash, userId, expiresAt, now], tx);
    });
  }

  public async claimTelegramLinkCode(
    codeHash: string,
    chatId: string
  ):
    Promise<
      | { status: 'claimed'; userId: string }
      | { status: 'already_linked'; userId: string }
      | { status: 'chat_linked' | 'user_linked' | 'invalid_code' }
    > {
    return this.writeTransaction(async (tx) => {
      const codeRows = await this.execute(`
        SELECT user_id, expires_at, claimed_by_chat FROM telegram_link_codes
        WHERE code_hash = ? LIMIT 1
      `, [codeHash], tx);
      const code = codeRows.rows[0] as unknown as {
        user_id: string;
        expires_at: number;
        claimed_by_chat: string | null;
      } | undefined;
      if (!code || code.expires_at <= Date.now() ||
          (code.claimed_by_chat !== null && code.claimed_by_chat !== chatId)) {
        return { status: 'invalid_code' };
      }

      const chatRows = await this.execute(
        'SELECT user_id FROM telegram_accounts WHERE chat_id = ? LIMIT 1',
        [chatId],
        tx
      );
      const chatLink = chatRows.rows[0] as unknown as { user_id: string } | undefined;
      if (chatLink) {
        return chatLink.user_id === code.user_id
          ? { status: 'already_linked', userId: code.user_id }
          : { status: 'chat_linked' };
      }

      const userRows = await this.execute(
        'SELECT chat_id FROM telegram_accounts WHERE user_id = ? LIMIT 1',
        [code.user_id],
        tx
      );
      if (userRows.rows.length > 0) return { status: 'user_linked' };

      await this.execute(
        'UPDATE telegram_link_codes SET claimed_by_chat = ? WHERE code_hash = ?',
        [chatId, codeHash],
        tx
      );
      return { status: 'claimed', userId: code.user_id };
    });
  }

  public async completeTelegramAccountLink(codeHash: string, chatId: string, userId: string): Promise<boolean> {
    return this.writeTransaction(async (tx) => {
      const codeRows = await this.execute(`
        SELECT user_id, expires_at, claimed_by_chat FROM telegram_link_codes
        WHERE code_hash = ? LIMIT 1
      `, [codeHash], tx);
      const code = codeRows.rows[0] as unknown as {
        user_id: string;
        expires_at: number;
        claimed_by_chat: string | null;
      } | undefined;
      if (!code || code.user_id !== userId || code.claimed_by_chat !== chatId ||
          code.expires_at <= Date.now()) return false;

      await this.execute(`
        INSERT INTO telegram_accounts (chat_id, user_id, linked_at) VALUES (?, ?, ?)
      `, [chatId, userId, new Date().toISOString()], tx);
      await this.execute('DELETE FROM telegram_link_codes WHERE code_hash = ?', [codeHash], tx);
      return true;
    });
  }

  public async getTelegramLinkedUserId(chatId: string): Promise<string | null> {
    const result = await this.execute(
      'SELECT user_id FROM telegram_accounts WHERE chat_id = ? LIMIT 1',
      [chatId]
    );
    return (result.rows[0] as unknown as { user_id: string } | undefined)?.user_id || null;
  }

  public hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    return { hash: crypto.scryptSync(password, salt, 64).toString('hex'), salt };
  }

  public verifyPassword(password: string, hash: string, salt: string): boolean {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
  }

  public async createUser(email: string, password: string, displayName?: string): Promise<DbUser> {
    const cleanEmail = email.trim().toLowerCase();
    const { hash, salt } = this.hashPassword(password);
    const userId = `usr_${crypto.randomBytes(6).toString('hex')}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const name = displayName?.trim() || cleanEmail.split('@')[0] || 'User';

    try {
      await this.writeTransaction(async (tx) => {
        await this.execute(`
          INSERT INTO users (
            id, email, password_hash, password_salt, display_name, credits_available,
            has_received_free_grant, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
        `, [userId, cleanEmail, hash, salt, name, now, now], tx);
        await this.execute(`
          INSERT INTO credit_balances (user_id, balance, has_received_free_grant, updated_at)
          VALUES (?, 0, 0, ?)
        `, [userId, now], tx);
      });
    } catch (error) {
      if ((error as { code?: string }).code?.includes('CONSTRAINT')) {
        const duplicate = new Error('A user with this email address already exists.');
        (duplicate as Error & { code?: string }).code = 'EMAIL_EXISTS';
        throw duplicate;
      }
      throw error;
    }

    return {
      id: userId,
      email: cleanEmail,
      password_hash: hash,
      password_salt: salt,
      display_name: name,
      credits_available: 0,
      has_received_free_grant: 0,
      created_at: now,
      updated_at: now,
    };
  }

  public async findUserByEmail(email: string): Promise<DbUser | null> {
    const result = await this.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email.trim().toLowerCase()]);
    return result.rows[0] ? result.rows[0] as unknown as DbUser : null;
  }

  public async findUserById(id: string): Promise<DbUser | null> {
    const result = await this.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return result.rows[0] ? result.rows[0] as unknown as DbUser : null;
  }

  public async createSession(userId: string, ttlMs: number = 30 * 24 * 60 * 60 * 1000): Promise<DbSession> {
    const session = {
      token: `sess_${crypto.randomBytes(32).toString('hex')}`,
      user_id: userId,
      expires_at: Date.now() + ttlMs,
      created_at: new Date().toISOString(),
    };
    await this.execute(`
      INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)
    `, [session.token, session.user_id, session.expires_at, session.created_at]);
    return session;
  }

  public async getSession(token: string): Promise<(DbSession & { user: DbUser }) | null> {
    const result = await this.execute(`
      SELECT s.token, s.user_id, s.expires_at, s.created_at,
             u.id AS u_id, u.email AS u_email, u.display_name AS u_name,
             u.password_hash AS u_hash, u.password_salt AS u_salt,
             u.credits_available AS u_credits_available,
             u.has_received_free_grant AS u_has_received_free_grant,
             u.created_at AS u_created_at, u.updated_at AS u_updated_at
      FROM sessions s JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ? LIMIT 1
    `, [token, Date.now()]);
    const row = result.rows[0] as unknown as Record<string, string | number> | undefined;
    if (!row) return null;
    return {
      token: String(row.token),
      user_id: String(row.user_id),
      expires_at: Number(row.expires_at),
      created_at: String(row.created_at),
      user: {
        id: String(row.u_id),
        email: String(row.u_email),
        display_name: String(row.u_name),
        password_hash: String(row.u_hash),
        password_salt: String(row.u_salt),
        credits_available: Number(row.u_credits_available),
        has_received_free_grant: Number(row.u_has_received_free_grant),
        created_at: String(row.u_created_at),
        updated_at: String(row.u_updated_at),
      },
    };
  }

  public async deleteSession(token: string): Promise<boolean> {
    await this.execute('DELETE FROM sessions WHERE token = ?', [token]);
    return true;
  }

  public async saveAnalysis(analysis: AnalysisInput): Promise<DbAnalysis> {
    const now = new Date().toISOString();
    const preview = analysis.inputPreview.slice(0, 300);
    const fullResult = JSON.stringify(analysis.fullResult);
    await this.execute(`
      INSERT OR REPLACE INTO analyses (
        id, user_id, input_type, input_preview, verdict, scam_risk, claim_verdict,
        confidence_score, reasons_summary, full_result_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      analysis.id, analysis.userId, analysis.inputType, preview, analysis.verdict,
      analysis.scamRisk, analysis.claimVerdict, analysis.confidenceScore,
      analysis.reasonsSummary, fullResult, now,
    ]);
    return {
      id: analysis.id,
      user_id: analysis.userId,
      input_type: analysis.inputType,
      input_preview: preview,
      verdict: analysis.verdict,
      scam_risk: analysis.scamRisk,
      claim_verdict: analysis.claimVerdict,
      confidence_score: analysis.confidenceScore,
      reasons_summary: analysis.reasonsSummary,
      full_result_json: fullResult,
      created_at: now,
    };
  }

  public async getAnalysesByUser(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    search?: string
  ): Promise<DbAnalysis[]> {
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      const result = await this.execute(`
        SELECT * FROM analyses
        WHERE user_id = ? AND (input_preview LIKE ? OR reasons_summary LIKE ? OR verdict LIKE ?)
        ORDER BY created_at DESC LIMIT ? OFFSET ?
      `, [userId, term, term, term, limit, offset]);
      return result.rows as unknown as DbAnalysis[];
    }
    const result = await this.execute(`
      SELECT * FROM analyses WHERE user_id = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [userId, limit, offset]);
    return result.rows as unknown as DbAnalysis[];
  }

  public async getAnalysisById(id: string, userId?: string): Promise<DbAnalysis | null> {
    const result = userId
      ? await this.execute('SELECT * FROM analyses WHERE id = ? AND user_id = ? LIMIT 1', [id, userId])
      : await this.execute('SELECT * FROM analyses WHERE id = ? LIMIT 1', [id]);
    return result.rows[0] ? result.rows[0] as unknown as DbAnalysis : null;
  }

  public async deleteAnalysis(id: string, userId: string): Promise<boolean> {
    await this.execute('DELETE FROM analyses WHERE id = ? AND user_id = ?', [id, userId]);
    return true;
  }

  public async clearAnalyses(userId: string): Promise<boolean> {
    await this.execute('DELETE FROM analyses WHERE user_id = ?', [userId]);
    return true;
  }

  private async writeTransactionRow(tx: TransactionInput, transaction: Transaction): Promise<TransactionRow> {
    if (tx.idempotencyKey) {
      const existing = await this.execute(
        'SELECT * FROM transactions WHERE idempotency_key = ? LIMIT 1',
        [tx.idempotencyKey],
        transaction
      );
      if (existing.rows[0]) return existing.rows[0] as unknown as TransactionRow;
    }

    const existingById = await this.execute(
      'SELECT * FROM transactions WHERE id = ? LIMIT 1',
      [tx.id],
      transaction
    );
    if (existingById.rows[0]) return existingById.rows[0] as unknown as TransactionRow;

    const stateResult = await this.execute(
      'SELECT balance FROM credit_balances WHERE user_id = ? LIMIT 1',
      [tx.userId],
      transaction
    );
    const state = stateResult.rows[0] as unknown as { balance: number } | undefined;
    const previousBalance = state ? Number(state.balance) : tx.balanceAfter - tx.amount;
    const nextBalance = previousBalance + tx.amount;
    if (nextBalance < 0) throw new Error('Credit balance would become negative.');
    const now = tx.createdAt || new Date().toISOString();
    const metadata = tx.metadata ? JSON.stringify(tx.metadata) : null;

    await this.execute(`
      INSERT INTO credit_balances (user_id, balance, has_received_free_grant, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        balance = excluded.balance,
        has_received_free_grant = CASE WHEN excluded.has_received_free_grant = 1
          THEN 1 ELSE credit_balances.has_received_free_grant END,
        updated_at = excluded.updated_at
    `, [tx.userId, nextBalance, tx.type === 'initial_grant' ? 1 : 0, now], transaction);

    await this.execute(`
      UPDATE users SET credits_available = ?, has_received_free_grant = CASE WHEN ? = 1
        THEN 1 ELSE has_received_free_grant END, updated_at = ? WHERE id = ?
    `, [nextBalance, tx.type === 'initial_grant' ? 1 : 0, now, tx.userId], transaction);

    await this.execute(`
      INSERT INTO transactions (
        id, user_id, type, amount, balance_after, reason, idempotency_key, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tx.id, tx.userId, tx.type, tx.amount, nextBalance, tx.reason,
      tx.idempotencyKey || null, metadata, now,
    ], transaction);

    return {
      id: tx.id,
      user_id: tx.userId,
      type: tx.type,
      amount: tx.amount,
      balance_after: nextBalance,
      reason: tx.reason,
      idempotency_key: tx.idempotencyKey || null,
      metadata_json: metadata,
      created_at: now,
    };
  }

  public recordTransaction(tx: TransactionInput): Promise<DbTransaction> {
    return this.writeTransaction(async (transaction) => this.writeTransactionRow(tx, transaction));
  }

  public async getUserCreditState(userId: string): Promise<DbUserCreditState | null> {
    const result = await this.execute(`
      SELECT user_id, balance AS credits_available, has_received_free_grant
      FROM credit_balances WHERE user_id = ? LIMIT 1
    `, [userId]);
    const state = result.rows[0] as unknown as DbUserCreditState | undefined;
    if (state) return state;

    const user = await this.findUserById(userId);
    return user ? {
      user_id: user.id,
      credits_available: user.credits_available,
      has_received_free_grant: user.has_received_free_grant,
    } : null;
  }

  public async getAllUserCreditStates(): Promise<DbUserCreditState[]> {
    const result = await this.execute(`
      SELECT user_id, balance AS credits_available, has_received_free_grant FROM credit_balances
    `);
    return result.rows as unknown as DbUserCreditState[];
  }

  public async hasAnonymousCreditMigration(anonymousUserId: string): Promise<boolean> {
    const result = await this.execute(
      'SELECT 1 FROM anonymous_credit_migrations WHERE anonymous_user_id = ? LIMIT 1',
      [anonymousUserId]
    );
    return result.rows.length > 0;
  }

  public recordAnonymousCreditMigration(
    anonymousUserId: string,
    authenticatedUserId: string,
    transactions: TransactionInput[]
  ): Promise<boolean> {
    return this.writeTransaction(async (tx) => {
      const result = await this.execute(`
        INSERT OR IGNORE INTO anonymous_credit_migrations (
          anonymous_user_id, authenticated_user_id, created_at
        ) VALUES (?, ?, ?)
      `, [anonymousUserId, authenticatedUserId, new Date().toISOString()], tx);
      if (Number(result.rowsAffected) === 0) return false;
      for (const transaction of transactions) {
        await this.writeTransactionRow(transaction, tx);
      }
      return true;
    });
  }

  public async getTransactionsByUser(userId: string, limit: number = 50): Promise<DbTransaction[]> {
    const result = await this.execute(`
      SELECT * FROM transactions WHERE user_id = ?
      ORDER BY created_at DESC LIMIT ?
    `, [userId, limit]);
    return result.rows as unknown as DbTransaction[];
  }

  public async getAllTransactions(): Promise<DbTransaction[]> {
    const result = await this.execute('SELECT * FROM transactions ORDER BY created_at ASC');
    return result.rows as unknown as DbTransaction[];
  }

  public async clearAllTransactions(): Promise<void> {
    await this.writeTransaction(async (tx) => {
      await this.execute('DELETE FROM transactions', [], tx);
      await this.execute('DELETE FROM anonymous_credit_migrations', [], tx);
      await this.execute('DELETE FROM credit_balances', [], tx);
      await this.execute(`
        UPDATE users SET credits_available = 0, has_received_free_grant = 0
      `, [], tx);
    });
  }

  public getDatabasePath(): string {
    return process.env.TURSO_DATABASE_URL || 'Turso database (remote)';
  }

  public migrateAnonymousData(anonymousUserId: string, authenticatedUserId: string): Promise<void> {
    if (!anonymousUserId || !authenticatedUserId || anonymousUserId === authenticatedUserId) {
      return Promise.resolve();
    }
    return this.writeTransaction(async (tx) => {
      await this.execute(
        'UPDATE analyses SET user_id = ? WHERE user_id = ?',
        [authenticatedUserId, anonymousUserId],
        tx
      );
      await this.execute(
        'UPDATE transactions SET user_id = ? WHERE user_id = ?',
        [authenticatedUserId, anonymousUserId],
        tx
      );
    });
  }

  public async close(): Promise<void> {
    this.client?.close();
    this.client = null;
    this.initialization = null;
  }
}

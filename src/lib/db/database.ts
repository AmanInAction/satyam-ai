import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DbUser, DbSession, DbAnalysis, DbTransaction, DbUserCreditState } from './schema';
import { safeLogger } from '../security/logger';
import { TursoDatabase } from './tursoDatabase';

export class AppDatabase {
  private db!: DatabaseSync;
  private dbPath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath;
    } else if (process.env.NODE_ENV === 'test' && !process.env.PERSIST_TEST_DB) {
      this.dbPath = ':memory:';
    } else {
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), '.data');
      this.dbPath = path.join(dataDir, 'satyam.sqlite');
    }

    try {
      if (this.dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      }
      this.db = new DatabaseSync(this.dbPath);
      if (this.dbPath !== ':memory:') {
        this.db.exec('PRAGMA journal_mode = WAL;');
      }
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.initTables();
      safeLogger.info(`SQLite Database initialized successfully at: ${this.dbPath}`);
    } catch (err: unknown) {
      safeLogger.error(`SQLite initialization failed at ${this.dbPath}: ${(err as Error)?.message}`);
      throw new Error(`Unable to initialize the SQLite database at ${this.dbPath}.`, { cause: err });
    }
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        display_name TEXT NOT NULL,
        credits_available INTEGER NOT NULL DEFAULT 0,
        has_received_free_grant INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        input_type TEXT NOT NULL,
        input_preview TEXT NOT NULL,
        verdict TEXT NOT NULL,
        scam_risk TEXT NOT NULL,
        claim_verdict TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        reasons_summary TEXT NOT NULL,
        full_result_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        balance_after REAL NOT NULL,
        reason TEXT NOT NULL,
        idempotency_key TEXT UNIQUE,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS credit_balances (
        user_id TEXT PRIMARY KEY,
        balance REAL NOT NULL DEFAULT 0,
        has_received_free_grant INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS anonymous_credit_migrations (
        anonymous_user_id TEXT PRIMARY KEY,
        authenticated_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS telegram_link_codes (
        code_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        claimed_by_chat TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user
        ON telegram_link_codes(user_id);

      CREATE TABLE IF NOT EXISTS telegram_accounts (
        chat_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        linked_at TEXT NOT NULL
      );
    `);

    const userColumns = this.db.prepare('PRAGMA table_info(users)').all() as unknown as Array<{
      name: string;
    }>;
    const existingColumns = new Set(userColumns.map((column) => column.name));
    if (!existingColumns.has('credits_available')) {
      this.db.exec('ALTER TABLE users ADD COLUMN credits_available INTEGER NOT NULL DEFAULT 0');
      this.db.exec(`
        UPDATE users
        SET credits_available = COALESCE((
          SELECT balance_after FROM transactions
          WHERE transactions.user_id = users.id
          ORDER BY created_at DESC LIMIT 1
        ), 0)
      `);
    }
    if (!existingColumns.has('has_received_free_grant')) {
      this.db.exec('ALTER TABLE users ADD COLUMN has_received_free_grant INTEGER NOT NULL DEFAULT 0');
      this.db.exec(`
        UPDATE users
        SET has_received_free_grant = CASE WHEN EXISTS (
          SELECT 1 FROM transactions
          WHERE transactions.user_id = users.id AND transactions.type = 'initial_grant'
        ) THEN 1 ELSE 0 END
      `);
    }

    this.db.exec(`
      INSERT OR IGNORE INTO credit_balances (user_id, balance, has_received_free_grant, updated_at)
      SELECT t.user_id, t.balance_after,
             CASE WHEN EXISTS (
               SELECT 1 FROM transactions grant_tx
               WHERE grant_tx.user_id = t.user_id AND grant_tx.type = 'initial_grant'
             ) THEN 1 ELSE 0 END,
             t.created_at
      FROM transactions t
      WHERE t.rowid = (
        SELECT latest.rowid FROM transactions latest
        WHERE latest.user_id = t.user_id
        ORDER BY latest.created_at DESC, latest.rowid DESC LIMIT 1
      );

      INSERT OR IGNORE INTO credit_balances (user_id, balance, has_received_free_grant, updated_at)
      SELECT id, credits_available, has_received_free_grant, updated_at FROM users;

      UPDATE users
      SET credits_available = COALESCE((
        SELECT balance FROM credit_balances WHERE credit_balances.user_id = users.id
      ), credits_available),
      has_received_free_grant = COALESCE((
        SELECT has_received_free_grant FROM credit_balances
        WHERE credit_balances.user_id = users.id
      ), has_received_free_grant);
    `);
  }

  public createTelegramLinkCode(userId: string, codeHash: string, expiresAt: number): void {
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM telegram_link_codes WHERE expires_at <= ?').run(Date.now());
      this.db.prepare('DELETE FROM telegram_link_codes WHERE user_id = ?').run(userId);
      this.db.prepare(`
        INSERT INTO telegram_link_codes (code_hash, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `).run(codeHash, userId, expiresAt, now);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public claimTelegramLinkCode(
    codeHash: string,
    chatId: string
  ):
    | { status: 'claimed'; userId: string }
    | { status: 'already_linked'; userId: string }
    | { status: 'chat_linked' | 'user_linked' | 'invalid_code' } {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const codeRows = this.db.prepare(`
        SELECT user_id, expires_at, claimed_by_chat
        FROM telegram_link_codes
        WHERE code_hash = ?
        LIMIT 1
      `).all(codeHash) as unknown as Array<{
        user_id: string;
        expires_at: number;
        claimed_by_chat: string | null;
      }>;
      const code = codeRows[0];
      if (!code || code.expires_at <= Date.now() ||
          (code.claimed_by_chat !== null && code.claimed_by_chat !== chatId)) {
        this.db.exec('COMMIT');
        return { status: 'invalid_code' };
      }

      const chatRows = this.db.prepare(
        'SELECT user_id FROM telegram_accounts WHERE chat_id = ? LIMIT 1'
      ).all(chatId) as unknown as Array<{ user_id: string }>;
      if (chatRows[0]) {
        this.db.exec('COMMIT');
        return chatRows[0].user_id === code.user_id
          ? { status: 'already_linked', userId: code.user_id }
          : { status: 'chat_linked' };
      }

      const userRows = this.db.prepare(
        'SELECT chat_id FROM telegram_accounts WHERE user_id = ? LIMIT 1'
      ).all(code.user_id) as unknown as Array<{ chat_id: string }>;
      if (userRows[0]) {
        this.db.exec('COMMIT');
        return { status: 'user_linked' };
      }

      this.db.prepare(`
        UPDATE telegram_link_codes
        SET claimed_by_chat = ?
        WHERE code_hash = ?
      `).run(chatId, codeHash);
      this.db.exec('COMMIT');
      return { status: 'claimed', userId: code.user_id };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public completeTelegramAccountLink(
    codeHash: string,
    chatId: string,
    userId: string
  ): boolean {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const codeRows = this.db.prepare(`
        SELECT user_id, expires_at, claimed_by_chat
        FROM telegram_link_codes
        WHERE code_hash = ?
        LIMIT 1
      `).all(codeHash) as unknown as Array<{
        user_id: string;
        expires_at: number;
        claimed_by_chat: string | null;
      }>;
      const code = codeRows[0];
      if (!code || code.user_id !== userId || code.claimed_by_chat !== chatId ||
          code.expires_at <= Date.now()) {
        this.db.exec('COMMIT');
        return false;
      }

      this.db.prepare(`
        INSERT INTO telegram_accounts (chat_id, user_id, linked_at)
        VALUES (?, ?, ?)
      `).run(chatId, userId, new Date().toISOString());
      this.db.prepare('DELETE FROM telegram_link_codes WHERE code_hash = ?').run(codeHash);
      this.db.exec('COMMIT');
      return true;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public getTelegramLinkedUserId(chatId: string): string | null {
    const rows = this.db.prepare(
      'SELECT user_id FROM telegram_accounts WHERE chat_id = ? LIMIT 1'
    ).all(chatId) as unknown as Array<{ user_id: string }>;
    return rows[0]?.user_id || null;
  }

  // ----------------------------------------------------
  // Cryptography & Password Hashing
  // ----------------------------------------------------
  public hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
  }

  public verifyPassword(password: string, hash: string, salt: string): boolean {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
  }

  // ----------------------------------------------------
  // User Management
  // ----------------------------------------------------
  public createUser(email: string, password: string, displayName?: string): DbUser {
    const cleanEmail = email.trim().toLowerCase();
    const existing = this.findUserByEmail(cleanEmail);
    if (existing) {
      const err = new Error('A user with this email address already exists.');
      (err as any).code = 'EMAIL_EXISTS';
      throw err;
    }

    const { hash, salt } = this.hashPassword(password);
    const userId = `usr_${crypto.randomBytes(6).toString('hex')}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const name = displayName?.trim() || cleanEmail.split('@')[0] || 'User';

    const insert = this.db.prepare(`
      INSERT INTO users (
        id, email, password_hash, password_salt, display_name,
        credits_available, has_received_free_grant, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
    `);
    insert.run(userId, cleanEmail, hash, salt, name, now, now);

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

  public findUserByEmail(email: string): DbUser | null {
    const query = this.db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    const result = query.all(email.trim().toLowerCase()) as unknown as DbUser[];
    return result.length > 0 ? result[0] : null;
  }

  public findUserById(id: string): DbUser | null {
    const query = this.db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    const result = query.all(id) as unknown as DbUser[];
    return result.length > 0 ? result[0] : null;
  }

  // ----------------------------------------------------
  // Session Management
  // ----------------------------------------------------
  public createSession(userId: string, ttlMs: number = 30 * 24 * 60 * 60 * 1000): DbSession {
    const token = `sess_${crypto.randomBytes(32).toString('hex')}`;
    const now = new Date().toISOString();
    const expiresAt = Date.now() + ttlMs;

    const insert = this.db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `);
    insert.run(token, userId, expiresAt, now);

    return { token, user_id: userId, expires_at: expiresAt, created_at: now };
  }

  public getSession(token: string): (DbSession & { user: DbUser }) | null {
    const query = this.db.prepare(`
      SELECT s.token, s.user_id, s.expires_at, s.created_at,
             u.id as u_id, u.email as u_email, u.display_name as u_name,
             u.password_hash as u_hash, u.password_salt as u_salt,
             u.credits_available as u_credits_available,
             u.has_received_free_grant as u_has_received_free_grant,
             u.created_at as u_created_at, u.updated_at as u_updated_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
      LIMIT 1
    `);
    const results = query.all(token, Date.now()) as unknown as Record<string, any>[];
    if (results.length === 0) return null;

    const row = results[0];
    return {
      token: row.token,
      user_id: row.user_id,
      expires_at: row.expires_at,
      created_at: row.created_at,
      user: {
        id: row.u_id,
        email: row.u_email,
        display_name: row.u_name,
        password_hash: row.u_hash,
        password_salt: row.u_salt,
        credits_available: row.u_credits_available,
        has_received_free_grant: row.u_has_received_free_grant,
        created_at: row.u_created_at,
        updated_at: row.u_updated_at,
      },
    };
  }

  public deleteSession(token: string): boolean {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE token = ?');
    stmt.run(token);
    return true;
  }

  // ----------------------------------------------------
  // Analysis History Persistence
  // ----------------------------------------------------
  public saveAnalysis(analysis: {
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
  }): DbAnalysis {
    const now = new Date().toISOString();
    const preview = analysis.inputPreview.slice(0, 300);
    const jsonStr = JSON.stringify(analysis.fullResult);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO analyses (
        id, user_id, input_type, input_preview, verdict, scam_risk,
        claim_verdict, confidence_score, reasons_summary, full_result_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      analysis.id,
      analysis.userId,
      analysis.inputType,
      preview,
      analysis.verdict,
      analysis.scamRisk,
      analysis.claimVerdict,
      analysis.confidenceScore,
      analysis.reasonsSummary,
      jsonStr,
      now
    );

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
      full_result_json: jsonStr,
      created_at: now,
    };
  }

  public getAnalysesByUser(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    search?: string
  ): DbAnalysis[] {
    if (search && search.trim()) {
      const query = this.db.prepare(`
        SELECT * FROM analyses
        WHERE user_id = ? AND (input_preview LIKE ? OR reasons_summary LIKE ? OR verdict LIKE ?)
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);
      const term = `%${search.trim()}%`;
      return query.all(userId, term, term, term, limit, offset) as unknown as DbAnalysis[];
    }

    const query = this.db.prepare(`
      SELECT * FROM analyses
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    return query.all(userId, limit, offset) as unknown as DbAnalysis[];
  }

  public getAnalysisById(id: string, userId?: string): DbAnalysis | null {
    if (userId) {
      const query = this.db.prepare('SELECT * FROM analyses WHERE id = ? AND user_id = ? LIMIT 1');
      const rows = query.all(id, userId) as unknown as DbAnalysis[];
      return rows.length > 0 ? rows[0] : null;
    }
    const query = this.db.prepare('SELECT * FROM analyses WHERE id = ? LIMIT 1');
    const rows = query.all(id) as unknown as DbAnalysis[];
    return rows.length > 0 ? rows[0] : null;
  }

  public deleteAnalysis(id: string, userId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM analyses WHERE id = ? AND user_id = ?');
    stmt.run(id, userId);
    return true;
  }

  public clearAnalyses(userId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM analyses WHERE user_id = ?');
    stmt.run(userId);
    return true;
  }

  // ----------------------------------------------------
  // Transaction Persistence & Sync
  // ----------------------------------------------------
  public recordTransaction(tx: {
    id: string;
    userId: string;
    type: string;
    amount: number;
    balanceAfter: number;
    reason: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  }): DbTransaction {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (tx.idempotencyKey) {
        const existing = this.db.prepare(
          'SELECT * FROM transactions WHERE idempotency_key = ? LIMIT 1'
        ).get(tx.idempotencyKey) as DbTransaction | undefined;
        if (existing) {
          this.db.exec('COMMIT');
          return existing;
        }
      }
      const existingById = this.db.prepare(
        'SELECT * FROM transactions WHERE id = ? LIMIT 1'
      ).get(tx.id) as DbTransaction | undefined;
      if (existingById) {
        this.db.exec('COMMIT');
        return existingById;
      }

      const state = this.getUserCreditState(tx.userId);
      const previousBalance = state ? state.credits_available : tx.balanceAfter - tx.amount;
      const balanceAfter = previousBalance + tx.amount;
      if (balanceAfter < 0) throw new Error('Credit balance would become negative.');
      const persistedTx = { ...tx, balanceAfter };
      const now = tx.createdAt || new Date().toISOString();
      const metadataStr = tx.metadata ? JSON.stringify(tx.metadata) : null;

      this.insertTransaction(persistedTx, metadataStr, now);
      this.updateUserCreditState(tx.userId, balanceAfter, tx.type === 'initial_grant');
      this.db.exec('COMMIT');

      return {
        id: tx.id,
        user_id: tx.userId,
        type: tx.type,
        amount: tx.amount,
        balance_after: balanceAfter,
        reason: tx.reason,
        idempotency_key: tx.idempotencyKey || null,
        metadata_json: metadataStr,
        created_at: now,
      };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  private insertTransaction(
    tx: {
      id: string;
      userId: string;
      type: string;
      amount: number;
      balanceAfter: number;
      reason: string;
      idempotencyKey?: string;
    },
    metadataStr: string | null,
    createdAt: string
  ): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO transactions (
        id, user_id, type, amount, balance_after, reason, idempotency_key, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tx.id,
      tx.userId,
      tx.type,
      tx.amount,
      tx.balanceAfter,
      tx.reason,
      tx.idempotencyKey || null,
      metadataStr,
      createdAt
    );
  }

  private updateUserCreditState(userId: string, balance: number, receivedFreeGrant: boolean): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO credit_balances (user_id, balance, has_received_free_grant, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        balance = excluded.balance,
        has_received_free_grant = CASE WHEN excluded.has_received_free_grant = 1
          THEN 1 ELSE credit_balances.has_received_free_grant END,
        updated_at = excluded.updated_at
    `).run(userId, balance, receivedFreeGrant ? 1 : 0, now);
    this.db.prepare(`
      UPDATE users
      SET credits_available = ?,
          has_received_free_grant = CASE WHEN ? THEN 1 ELSE has_received_free_grant END,
          updated_at = ?
      WHERE id = ?
    `).run(balance, receivedFreeGrant ? 1 : 0, now, userId);
  }

  public getUserCreditState(userId: string): DbUserCreditState | null {
    const rows = this.db.prepare(`
      SELECT user_id, balance AS credits_available, has_received_free_grant
      FROM credit_balances WHERE user_id = ? LIMIT 1
    `).all(userId) as unknown as DbUserCreditState[];
    if (rows[0]) return rows[0];
    const users = this.db.prepare(`
      SELECT id AS user_id, credits_available, has_received_free_grant
      FROM users WHERE id = ? LIMIT 1
    `).all(userId) as unknown as DbUserCreditState[];
    return users[0] || null;
  }

  public getAllUserCreditStates(): DbUserCreditState[] {
    return this.db.prepare(`
      SELECT user_id, balance AS credits_available, has_received_free_grant FROM credit_balances
    `).all() as unknown as DbUserCreditState[];
  }

  public hasAnonymousCreditMigration(anonymousUserId: string): boolean {
    const rows = this.db.prepare(`
      SELECT 1 FROM anonymous_credit_migrations WHERE anonymous_user_id = ? LIMIT 1
    `).all(anonymousUserId);
    return rows.length > 0;
  }

  public recordAnonymousCreditMigration(
    anonymousUserId: string,
    authenticatedUserId: string,
    transactions: Array<{
      id: string;
      userId: string;
      type: string;
      amount: number;
      balanceAfter: number;
      reason: string;
      idempotencyKey?: string;
      metadata?: Record<string, unknown>;
      createdAt?: string;
    }>
  ): boolean {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.db.prepare(`
        INSERT OR IGNORE INTO anonymous_credit_migrations (
          anonymous_user_id, authenticated_user_id, created_at
        ) VALUES (?, ?, ?)
      `).run(anonymousUserId, authenticatedUserId, new Date().toISOString());
      if (result.changes === 0) {
        this.db.exec('COMMIT');
        return false;
      }

      for (const tx of transactions) {
        const createdAt = tx.createdAt || new Date().toISOString();
        this.insertTransaction(tx, tx.metadata ? JSON.stringify(tx.metadata) : null, createdAt);
        this.updateUserCreditState(tx.userId, tx.balanceAfter, tx.type === 'initial_grant');
      }
      this.db.exec('COMMIT');
      return true;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public getTransactionsByUser(userId: string, limit: number = 50): DbTransaction[] {
    const query = this.db.prepare(`
      SELECT * FROM transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return query.all(userId, limit) as unknown as DbTransaction[];
  }

  public getAllTransactions(): DbTransaction[] {
    const query = this.db.prepare('SELECT * FROM transactions ORDER BY created_at ASC');
    return query.all() as unknown as DbTransaction[];
  }

  public clearAllTransactions(): void {
    this.db.exec(`
      DELETE FROM transactions;
      DELETE FROM anonymous_credit_migrations;
      DELETE FROM credit_balances;
      UPDATE users SET credits_available = 0, has_received_free_grant = 0;
    `);
  }

  public getDatabasePath(): string {
    return this.dbPath;
  }

  // ----------------------------------------------------
  // Anonymous to Authenticated Data Migration
  // ----------------------------------------------------
  public migrateAnonymousData(anonymousUserId: string, authenticatedUserId: string): void {
    if (!anonymousUserId || !authenticatedUserId || anonymousUserId === authenticatedUserId) return;

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE analyses SET user_id = ? WHERE user_id = ?')
        .run(authenticatedUserId, anonymousUserId);
      this.db.prepare('UPDATE transactions SET user_id = ? WHERE user_id = ?')
        .run(authenticatedUserId, anonymousUserId);
      this.db.exec('COMMIT');
      safeLogger.info(`Migrated data from anonymous user ${anonymousUserId} to authenticated user ${authenticatedUserId}`);
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // ignore
    }
  }
}

// Global singleton instance for App Router
declare global {
  // eslint-disable-next-line no-var
  var __satyam_app_db__: AppDatabase | undefined;
}

export const defaultDb: AppDatabase | TursoDatabase =
  process.env.VERCEL === '1' ||
  process.env.TURSO_DATABASE_URL ||
  process.env.NEXT_PHASE === 'phase-production-build'
    ? new TursoDatabase()
    : globalThis.__satyam_app_db__ ?? (globalThis.__satyam_app_db__ = new AppDatabase());

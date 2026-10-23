import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DbUser, DbSession, DbAnalysis, DbTransaction } from './schema';
import { safeLogger } from '../security/logger';

export class AppDatabase {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath;
    } else if (process.env.NODE_ENV === 'test' && !process.env.PERSIST_TEST_DB) {
      this.dbPath = ':memory:';
    } else {
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), '.data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.dbPath = path.join(dataDir, 'satyam.sqlite');
    }

    try {
      this.db = new DatabaseSync(this.dbPath);
      if (this.dbPath !== ':memory:') {
        this.db.exec('PRAGMA journal_mode = WAL;');
      }
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.initTables();
      safeLogger.info(`SQLite Database initialized successfully at: ${this.dbPath}`);
    } catch (err: unknown) {
      safeLogger.warn(`SQLite initialization error (${(err as Error)?.message}). Falling back to :memory:`);
      this.dbPath = ':memory:';
      this.db = new DatabaseSync(':memory:');
      this.initTables();
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
    `);
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
      INSERT INTO users (id, email, password_hash, password_salt, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(userId, cleanEmail, hash, salt, name, now, now);

    return {
      id: userId,
      email: cleanEmail,
      password_hash: hash,
      password_salt: salt,
      display_name: name,
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
    const now = tx.createdAt || new Date().toISOString();
    const metadataStr = tx.metadata ? JSON.stringify(tx.metadata) : null;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO transactions (
        id, user_id, type, amount, balance_after, reason, idempotency_key, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      tx.id,
      tx.userId,
      tx.type,
      tx.amount,
      tx.balanceAfter,
      tx.reason,
      tx.idempotencyKey || null,
      metadataStr,
      now
    );

    return {
      id: tx.id,
      user_id: tx.userId,
      type: tx.type,
      amount: tx.amount,
      balance_after: tx.balanceAfter,
      reason: tx.reason,
      idempotency_key: tx.idempotencyKey || null,
      metadata_json: metadataStr,
      created_at: now,
    };
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

  // ----------------------------------------------------
  // Anonymous to Authenticated Data Migration
  // ----------------------------------------------------
  public migrateAnonymousData(anonymousUserId: string, authenticatedUserId: string): void {
    if (!anonymousUserId || !authenticatedUserId || anonymousUserId === authenticatedUserId) return;

    try {
      // Re-assign past analyses
      const updateAnalyses = this.db.prepare(`
        UPDATE analyses SET user_id = ? WHERE user_id = ?
      `);
      updateAnalyses.run(authenticatedUserId, anonymousUserId);

      // Re-assign transactions
      const updateTx = this.db.prepare(`
        UPDATE transactions SET user_id = ? WHERE user_id = ?
      `);
      updateTx.run(authenticatedUserId, anonymousUserId);

      safeLogger.info(`Migrated data from anonymous user ${anonymousUserId} to authenticated user ${authenticatedUserId}`);
    } catch (err: unknown) {
      safeLogger.warn(`Failed to migrate anonymous data: ${(err as Error)?.message}`);
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

export const defaultDb: AppDatabase =
  globalThis.__satyam_app_db__ ?? (globalThis.__satyam_app_db__ = new AppDatabase());

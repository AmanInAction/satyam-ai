import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../src/lib/db/database';
import { NextRequest } from 'next/server';
import { POST as registerHandler } from '../app/api/v1/auth/register/route';
import { POST as loginHandler } from '../app/api/v1/auth/login/route';
import { GET as meHandler } from '../app/api/v1/auth/me/route';
import { GET as historyGetHandler, DELETE as historyDeleteHandler } from '../app/api/v1/history/route';
import { CreditLedgerService, defaultCreditLedger } from '../src/lib/payments/ledger';
import fs from 'fs';
import path from 'path';

describe('SQLite Database & Auth Service', () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = new AppDatabase(':memory:');
    defaultCreditLedger.reset();
  });

  it('creates user with salted password hash and retrieves user by email', () => {
    const user = db.createUser('investor@example.com', 'securePass123', 'Investor Demo');
    expect(user.id).toMatch(/^usr_/);
    expect(user.email).toBe('investor@example.com');
    expect(user.display_name).toBe('Investor Demo');
    expect(user.password_hash).toBeDefined();
    expect(user.password_salt).toBeDefined();

    const fetched = db.findUserByEmail('investor@example.com');
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(user.id);
  });

  it('verifies valid passwords and rejects invalid passwords', () => {
    const user = db.createUser('test@example.com', 'mypassword');
    const valid = db.verifyPassword('mypassword', user.password_hash, user.password_salt);
    const invalid = db.verifyPassword('wrongpassword', user.password_hash, user.password_salt);

    expect(valid).toBe(true);
    expect(invalid).toBe(false);
  });

  it('prevents duplicate user registration with same email', () => {
    db.createUser('duplicate@example.com', 'password123');
    expect(() => {
      db.createUser('duplicate@example.com', 'anotherPass');
    }).toThrow(/already exists/i);
  });

  it('creates and validates active sessions, rejects non-existent tokens', () => {
    const user = db.createUser('session@example.com', 'password123');
    const session = db.createSession(user.id, 60000);

    expect(session.token).toMatch(/^sess_/);
    const retrieved = db.getSession(session.token);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.user.email).toBe('session@example.com');

    const fakeSession = db.getSession('sess_nonexistent_token_123');
    expect(fakeSession).toBeNull();
  });

  it('deletes session upon logout', () => {
    const user = db.createUser('logout@example.com', 'password123');
    const session = db.createSession(user.id);

    expect(db.getSession(session.token)).not.toBeNull();
    db.deleteSession(session.token);
    expect(db.getSession(session.token)).toBeNull();
  });

  it('persists analysis records and retrieves by user with search', () => {
    const user = db.createUser('scanner@example.com', 'password123');

    db.saveAnalysis({
      id: 'analysis_electricity_001',
      userId: user.id,
      inputType: 'text',
      inputPreview: 'Dear consumer electricity power will be cut tonight call 9876543210',
      verdict: 'likely_scam',
      scamRisk: 'high',
      claimVerdict: 'unverified',
      confidenceScore: 0.94,
      reasonsSummary: 'Impersonation of utility board with urgent disconnection threat',
      fullResult: {
        analysis_id: 'analysis_electricity_001',
        scam_assessment: { verdict: 'likely_scam', risk_level: 'high' },
        reasons: ['Impersonation of utility board'],
      },
    });

    db.saveAnalysis({
      id: 'analysis_benign_002',
      userId: user.id,
      inputType: 'text',
      inputPreview: 'Meeting scheduled for tomorrow 10am',
      verdict: 'no_obvious_risk_found',
      scamRisk: 'none_detected',
      claimVerdict: 'not_applicable',
      confidenceScore: 0.88,
      reasonsSummary: 'Standard communication',
      fullResult: { analysis_id: 'analysis_benign_002' },
    });

    const allRecords = db.getAnalysesByUser(user.id);
    expect(allRecords.length).toBe(2);

    const searchElectricity = db.getAnalysesByUser(user.id, 10, 0, 'electricity');
    expect(searchElectricity.length).toBe(1);
    expect(searchElectricity[0].id).toBe('analysis_electricity_001');

    // Delete single item
    db.deleteAnalysis('analysis_electricity_001', user.id);
    const remaining = db.getAnalysesByUser(user.id);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('analysis_benign_002');

    // Clear all
    db.clearAnalyses(user.id);
    expect(db.getAnalysesByUser(user.id).length).toBe(0);
  });

  it('migrates anonymous user analyses and transactions to newly authenticated user', () => {
    const anonId = 'usr_anon_999';
    db.saveAnalysis({
      id: 'analysis_anon_1',
      userId: anonId,
      inputType: 'url',
      inputPreview: 'https://fake-bank-login.xyz',
      verdict: 'likely_scam',
      scamRisk: 'high',
      claimVerdict: 'unverified',
      confidenceScore: 0.99,
      reasonsSummary: 'Deceptive phishing link',
      fullResult: { analysis_id: 'analysis_anon_1' },
    });

    const registeredUser = db.createUser('upgraded@example.com', 'password123');
    db.migrateAnonymousData(anonId, registeredUser.id);

    const anonRecords = db.getAnalysesByUser(anonId);
    expect(anonRecords.length).toBe(0);

    const userRecords = db.getAnalysesByUser(registeredUser.id);
    expect(userRecords.length).toBe(1);
    expect(userRecords[0].id).toBe('analysis_anon_1');
  });

  it('migrates legacy credit_ledger.jsonl into SQLite and unlinks the file', async () => {
    const tempDir = path.join(process.cwd(), '.temp-migration-test');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const legacyFile = path.join(tempDir, 'credit_ledger.jsonl');
    const sampleTx = {
      id: 'tx_legacy_101',
      userId: 'usr_legacy_user',
      timestamp: new Date().toISOString(),
      type: 'initial_grant',
      amount: 3,
      balanceAfter: 3,
      reason: 'Freemium Welcome Bonus',
      idempotencyKey: 'legacy_grant_101',
    };
    fs.writeFileSync(legacyFile, JSON.stringify(sampleTx) + '\n', 'utf8');
    expect(fs.existsSync(legacyFile)).toBe(true);

    const migrationLedger = new CreditLedgerService(tempDir);

    // Verify file unlinked
    expect(fs.existsSync(legacyFile)).toBe(false);

    // Verify transaction loaded in SQLite and ledger
    const balance = await migrationLedger.getBalance('usr_legacy_user');
    expect(balance.balance).toBe(3);

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

describe('Auth & History API Route Handlers', () => {
  beforeEach(() => {
    defaultCreditLedger.reset();
  });

  it('registers a user, sets session cookie, and returns initial balance', async () => {
    const uniqueEmail = `test_${Date.now()}@example.com`;
    const req = new NextRequest('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'Password123!',
        displayName: 'Test Runner',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe(uniqueEmail);
    expect(data.balance).toBe(3); // 3 free checks granted
    expect(data.token).toBeDefined();

    // Verify cookie set
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('satyam_session_token=');
  });

  it('rejects duplicate email with 409 conflict', async () => {
    const duplicateEmail = `dupe_${Date.now()}@example.com`;
    const req1 = new NextRequest('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: duplicateEmail, password: 'password123' }),
    });
    const res1 = await registerHandler(req1);
    expect(res1.status).toBe(200);

    const req2 = new NextRequest('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: duplicateEmail, password: 'password123' }),
    });
    const res2 = await registerHandler(req2);
    expect(res2.status).toBe(409);
  });

  it('logs in user with valid credentials and rejects bad passwords', async () => {
    const email = `login_${Date.now()}@example.com`;
    // Register
    await registerHandler(
      new NextRequest('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'CorrectPassword' }),
      })
    );

    // Bad password
    const badLoginReq = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'WrongPassword' }),
    });
    const badRes = await loginHandler(badLoginReq);
    expect(badRes.status).toBe(401);

    // Good password
    const goodLoginReq = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'CorrectPassword' }),
    });
    const goodRes = await loginHandler(goodLoginReq);
    expect(goodRes.status).toBe(200);
    const goodData = await goodRes.json();
    expect(goodData.success).toBe(true);
    expect(goodData.token).toBeDefined();
  });

  it('retrieves profile via /api/v1/auth/me for authenticated user', async () => {
    const email = `me_${Date.now()}@example.com`;
    const regRes = await registerHandler(
      new NextRequest('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password123' }),
      })
    );
    const regData = await regRes.json();

    const meReq = new NextRequest('http://localhost:3000/api/v1/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${regData.token}`,
      },
    });

    const meRes = await meHandler(meReq);
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.isAuthenticated).toBe(true);
    expect(meData.user.email).toBe(email);
    expect(meData.available).toBe(3);
  });

  it('allows querying and clearing user history via /api/v1/history', async () => {
    const email = `hist_${Date.now()}@example.com`;
    const regRes = await registerHandler(
      new NextRequest('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password123' }),
      })
    );
    const regData = await regRes.json();

    const histReq = new NextRequest('http://localhost:3000/api/v1/history', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${regData.token}`,
      },
    });
    const histRes = await historyGetHandler(histReq);
    expect(histRes.status).toBe(200);
    const histData = await histRes.json();
    expect(histData.analyses).toBeInstanceOf(Array);

    // Delete all
    const delReq = new NextRequest('http://localhost:3000/api/v1/history', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${regData.token}`,
      },
    });
    const delRes = await historyDeleteHandler(delReq);
    expect(delRes.status).toBe(200);
  });
});

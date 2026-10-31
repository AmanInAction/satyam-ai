import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { CreditLedgerService } from '../src/lib/payments/ledger';
import { PayPalClient } from '../src/lib/payments/paypalClient';
import { CREDIT_PACKAGES, CREDIT_COSTS, FREE_INITIAL_CREDITS } from '../src/lib/payments/config';
import { GET as handleCreditsGet } from '../app/api/v1/payments/credits/route';
import { GET as handleTransactionsGet } from '../app/api/v1/payments/transactions/route';
import { POST as handleCreateOrderPost } from '../app/api/v1/payments/create-order/route';
import { POST as handleCaptureOrderPost } from '../app/api/v1/payments/capture-order/route';
import { POST as handleWebhookPost } from '../app/api/v1/payments/webhook/route';
import { POST as handleAnalyzeTextPost } from '../app/api/v1/analyze/text/route';
import { defaultCreditLedger } from '../src/lib/payments/ledger';
import fs from 'fs';
import path from 'path';

describe('Phase 9: PayPal Sandbox & Credit Monetization Engine', () => {
  const testDataDir = path.join(process.cwd(), '.data-test');
  let testLedger: CreditLedgerService;

  beforeEach(async () => {
    testLedger = new CreditLedgerService(testDataDir);
    await testLedger.reset();
    await defaultCreditLedger.reset();
  });

  afterEach(async () => {
    await testLedger.reset();
    await defaultCreditLedger.reset();
    if (fs.existsSync(testDataDir)) {
      try {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  describe('1. Freemium Initial Grant & Idempotency', () => {
    it('grants exactly 3 free credits to a new user upon initial request', async () => {
      const balance = await testLedger.getOrCreateUser('usr_alice_1');
      expect(balance.balance).toBe(FREE_INITIAL_CREDITS);
      expect(balance.available).toBe(FREE_INITIAL_CREDITS);
      expect(balance.reserved).toBe(0);
      expect(balance.hasReceivedFreeGrant).toBe(true);

      const txs = await testLedger.getTransactions('usr_alice_1');
      expect(txs).toHaveLength(1);
      expect(txs[0].type).toBe('initial_grant');
      expect(txs[0].amount).toBe(3);
    });

    it('ensures repeated initializations, browser refreshes, or sign-ins never grant free credits twice', async () => {
      const b1 = await testLedger.getOrCreateUser('usr_bob_2');
      const b2 = await testLedger.getOrCreateUser('usr_bob_2');
      const b3 = await testLedger.getBalance('usr_bob_2');

      expect(b1.balance).toBe(3);
      expect(b2.balance).toBe(3);
      expect(b3.balance).toBe(3);

      const txs = await testLedger.getTransactions('usr_bob_2');
      expect(txs).toHaveLength(1); // exactly one initial_grant transaction
    });

    it('returns credit balance and packages via GET /api/v1/payments/credits', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/payments/credits', {
        headers: {
          'x-user-id': 'usr_charlie_3',
        },
      });

      const res = await handleCreditsGet(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.balance).toBe(3);
      expect(data.available).toBe(3);
      expect(data.costs.text).toBe(1);
      expect(data.costs.url).toBe(1);
      expect(data.costs.image).toBe(2);
      expect(data.packages).toHaveLength(3);
      expect(data.packages[0].id).toBe('starter');
      expect(data.packages[1].id).toBe('plus');
    });
  });

  describe('2. Credit Reservation, Commit & Failure Release Lifecycle', () => {
    it('reserves credits atomically, reducing available balance without prematurely altering total balance', async () => {
      await testLedger.getOrCreateUser('usr_david_4');

      const reservation = await testLedger.reserveCredits('usr_david_4', 1, 'text');
      expect(reservation.status).toBe('pending');
      expect(reservation.amount).toBe(1);

      const midBalance = await testLedger.getBalance('usr_david_4');
      expect(midBalance.balance).toBe(3); // total unchanged until committed
      expect(midBalance.reserved).toBe(1);
      expect(midBalance.available).toBe(2); // available is reduced

      // Commit reservation upon successful analysis
      const tx = await testLedger.commitReservation(reservation.reservationId, 'analysis_xyz');
      expect(tx?.type).toBe('analysis_debit');
      expect(tx?.amount).toBe(-1);
      expect(tx?.balanceAfter).toBe(2);

      const finalBalance = await testLedger.getBalance('usr_david_4');
      expect(finalBalance.balance).toBe(2);
      expect(finalBalance.available).toBe(2);
      expect(finalBalance.reserved).toBe(0);
    });

    it('releases reserved credits immediately when an analysis fails or aborts', async () => {
      await testLedger.getOrCreateUser('usr_eva_5');

      const reservation = await testLedger.reserveCredits('usr_eva_5', 2, 'image');
      const midBalance = await testLedger.getBalance('usr_eva_5');
      expect(midBalance.available).toBe(1);

      // Release reservation due to simulated provider error
      const released = await testLedger.releaseReservation(reservation.reservationId, 'provider_timeout');
      expect(released).toBe(true);

      const finalBalance = await testLedger.getBalance('usr_eva_5');
      expect(finalBalance.balance).toBe(3); // restored
      expect(finalBalance.available).toBe(3);
      expect(finalBalance.reserved).toBe(0);
    });
  });

  describe('3. Concurrency Safety & Negative Balance Prevention', () => {
    it('prevents concurrent requests from double-spending credits below zero', async () => {
      await testLedger.getOrCreateUser('usr_frank_6'); // 3 credits

      // Launch 5 concurrent 1-credit reservation requests
      const attempts = await Promise.allSettled([
        testLedger.reserveCredits('usr_frank_6', 1, 'text'),
        testLedger.reserveCredits('usr_frank_6', 1, 'text'),
        testLedger.reserveCredits('usr_frank_6', 1, 'text'),
        testLedger.reserveCredits('usr_frank_6', 1, 'text'),
        testLedger.reserveCredits('usr_frank_6', 1, 'text'),
      ]);

      const successes = attempts.filter((r) => r.status === 'fulfilled');
      const failures = attempts.filter((r) => r.status === 'rejected');

      expect(successes).toHaveLength(3); // only 3 can succeed
      expect(failures).toHaveLength(2); // remaining 2 must be rejected with insufficient credits

      const balance = await testLedger.getBalance('usr_frank_6');
      expect(balance.balance).toBe(3);
      expect(balance.reserved).toBe(3);
      expect(balance.available).toBe(0);
    });
  });

  describe('4. Insufficient Credits Enforcement (HTTP 402)', () => {
    it('returns HTTP 402 with structured details when user has 0 credits for text analysis', async () => {
      // Create user with 0 credits
      const exhaustedUser = 'usr_exhausted_7';
      await defaultCreditLedger.getOrCreateUser(exhaustedUser);

      // Spend all 3 credits
      const r1 = await defaultCreditLedger.reserveCredits(exhaustedUser, 1, 'text');
      await defaultCreditLedger.commitReservation(r1.reservationId, 'ana_1');
      const r2 = await defaultCreditLedger.reserveCredits(exhaustedUser, 1, 'text');
      await defaultCreditLedger.commitReservation(r2.reservationId, 'ana_2');
      const r3 = await defaultCreditLedger.reserveCredits(exhaustedUser, 1, 'text');
      await defaultCreditLedger.commitReservation(r3.reservationId, 'ana_3');

      const check = await defaultCreditLedger.getBalance(exhaustedUser);
      expect(check.available).toBe(0);

      // Submit new text analysis
      const req = new NextRequest('http://localhost:3000/api/v1/analyze/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': exhaustedUser,
        },
        body: JSON.stringify({
          text: 'Verify this message please',
        }),
      });

      const res = await handleAnalyzeTextPost(req);
      expect(res.status).toBe(402);

      const data = await res.json();
      expect(data.error.code).toBe('INSUFFICIENT_CREDITS');
      expect(data.error.details.required).toBe(1);
      expect(data.error.details.available).toBe(0);
    });
  });

  describe('5. PayPal Sandbox Order Creation & Capture', () => {
    it('creates a PayPal order for the Plus Package via POST /api/v1/payments/create-order', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'usr_buyer_8',
        },
        body: JSON.stringify({
          packageId: 'plus',
        }),
      });

      const res = await handleCreateOrderPost(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.orderId).toBeDefined();
      expect(data.package.id).toBe('plus');
      expect(data.package.credits).toBe(30);
      expect(data.package.price).toBe('5.00');
      expect(data.links).toBeDefined();
    });

    it('rejects order creation for non-existent package IDs with HTTP 404', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'usr_buyer_8',
        },
        body: JSON.stringify({
          packageId: 'invalid_super_vip_tier',
        }),
      });

      const res = await handleCreateOrderPost(req);
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error.code).toBe('PACKAGE_NOT_FOUND');
    });

    it('captures an approved PayPal order and idempotently credits user account', async () => {
      const userId = 'usr_buyer_9';

      const req = new NextRequest('http://localhost:3000/api/v1/payments/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          orderId: 'SIM_ORDER_TEST_123',
          packageId: 'starter', // 10 credits
        }),
      });

      const res = await handleCaptureOrderPost(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.creditsGranted).toBe(10);
      expect(data.currentBalance).toBe(13); // 3 initial + 10 purchased
      expect(data.alreadyRedeemed).toBe(false);

      // Repeat capture call with same orderId -> strict idempotency
      const req2 = new NextRequest('http://localhost:3000/api/v1/payments/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          orderId: 'SIM_ORDER_TEST_123',
          packageId: 'starter',
        }),
      });
      const res2 = await handleCaptureOrderPost(req2);
      const data2 = await res2.json();
      expect(data2.alreadyRedeemed).toBe(true);
      expect(data2.currentBalance).toBe(13); // NOT 23!
    });
  });

  describe('6. PayPal Webhook Processing & Refund Reversal', () => {
    it('processes PAYMENT.CAPTURE.COMPLETED webhook event idempotently', async () => {
      const userId = 'usr_webhook_10';
      const webhookPayload = {
        id: 'WH_EVT_1001',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        create_time: new Date().toISOString(),
        resource: {
          id: 'CAP_WH_123',
          status: 'COMPLETED',
          custom_id: `${userId}:plus`, // 30 credits
          amount: {
            value: '5.00',
            currency_code: 'USD',
          },
        },
      };

      const req = new NextRequest('http://localhost:3000/api/v1/payments/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      const res = await handleWebhookPost(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.acknowledged).toBe(true);
      expect(data.event).toBe('PAYMENT.CAPTURE.COMPLETED');

      const balance = await defaultCreditLedger.getBalance(userId);
      expect(balance.balance).toBe(33); // 3 free + 30 purchased

      // Replay same webhook event -> idempotent, no additional credits
      await handleWebhookPost(req);
      const balanceAfterReplay = await defaultCreditLedger.getBalance(userId);
      expect(balanceAfterReplay.balance).toBe(33);
    });

    it('processes a completed INR payment webhook using INR package pricing', async () => {
      const userId = 'usr_webhook_inr';
      const webhookPayload = {
        id: 'WH_EVT_INR_1001',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        create_time: new Date().toISOString(),
        resource: {
          id: 'CAP_WH_INR_123',
          status: 'COMPLETED',
          custom_id: `${userId}:plus:INR`,
          amount: {
            value: '419.00',
            currency_code: 'INR',
          },
        },
      };
      const req = new NextRequest('http://localhost:3000/api/v1/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      const res = await handleWebhookPost(req);
      expect(res.status).toBe(200);
      const balance = await defaultCreditLedger.getBalance(userId);
      expect(balance.balance).toBe(33);
    });

    it('does not credit a webhook when the captured currency differs from the order currency', async () => {
      const userId = 'usr_webhook_currency_mismatch';
      const webhookPayload = {
        id: 'WH_EVT_CURRENCY_MISMATCH',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        create_time: new Date().toISOString(),
        resource: {
          id: 'CAP_WH_CURRENCY_MISMATCH',
          status: 'COMPLETED',
          custom_id: `${userId}:plus:INR`,
          amount: {
            value: '5.00',
            currency_code: 'USD',
          },
        },
      };
      const req = new NextRequest('http://localhost:3000/api/v1/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      await handleWebhookPost(req);
      const balance = await defaultCreditLedger.getBalance(userId);
      expect(balance.balance).toBe(3);
    });

    it('processes PAYMENT.CAPTURE.REFUNDED and deducts credits without going below zero', async () => {
      const userId = 'usr_refund_11';
      // Grant credits first via testLedger
      await testLedger.addPurchaseCredits(
        userId,
        10,
        'ORDER_REFUND_TEST',
        'CAP_REFUND_1',
        'starter',
        '2.00',
        'USD'
      );

      const balanceBefore = await testLedger.getBalance(userId);
      expect(balanceBefore.balance).toBe(13); // 3 free + 10 purchased

      // Process refund reversal
      const refundTx = await testLedger.reconcileRefund(userId, 'CAP_REFUND_1', 'REF_999', 10);
      expect(refundTx?.type).toBe('refund_reversal');
      expect(refundTx?.amount).toBe(-10);

      const balanceAfter = await testLedger.getBalance(userId);
      expect(balanceAfter.balance).toBe(3); // restored to baseline
    });

    it('reconciles refund safely when user has already spent their credits, bounding balance at 0', async () => {
      const userId = 'usr_spent_refund_12';
      await testLedger.addPurchaseCredits(
        userId,
        10,
        'ORDER_SPENT_TEST',
        'CAP_SPENT_1',
        'starter',
        '2.00',
        'USD'
      );

      // User spends all credits
      const r = await testLedger.reserveCredits(userId, 13, 'image');
      await testLedger.commitReservation(r.reservationId, 'spent_analysis');

      const balanceBefore = await testLedger.getBalance(userId);
      expect(balanceBefore.balance).toBe(0);

      // Refund occurs after credits were already spent
      const refundTx = await testLedger.reconcileRefund(userId, 'CAP_SPENT_1', 'REF_SPENT_99', 10);
      expect(refundTx?.amount).toBe(0); // cannot deduct below 0

      const balanceAfter = await testLedger.getBalance(userId);
      expect(balanceAfter.balance).toBe(0); // never negative
    });
  });

  describe('7. Transaction Ledger History & Auditing', () => {
    it('returns chronological transaction history for a user via GET /api/v1/payments/transactions', async () => {
      const userId = 'usr_history_13';
      await defaultCreditLedger.getOrCreateUser(userId);

      const req = new NextRequest('http://localhost:3000/api/v1/payments/transactions', {
        headers: {
          'x-user-id': userId,
        },
      });

      const res = await handleTransactionsGet(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.userId).toBe(userId);
      expect(Array.isArray(data.transactions)).toBe(true);
      expect(data.transactions.length).toBeGreaterThanOrEqual(1);
      expect(data.transactions[0].type).toBe('initial_grant');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { defaultPayPalClient, PayPalClient, PayPalApiError } from '../src/lib/payments/paypalClient';
import { defaultCreditLedger, CreditLedgerService } from '../src/lib/payments/ledger';
import { POST as handleCreateOrderPost } from '../app/api/v1/payments/create-order/route';
import { POST as handleCaptureOrderPost } from '../app/api/v1/payments/capture-order/route';
import { POST as handleWebhookPost } from '../app/api/v1/payments/webhook/route';
import fs from 'fs';
import path from 'path';

describe('PayPal Sandbox Approval and Capture Lifecycle', () => {
  const testDataDir = path.join(process.cwd(), '.data-test-paypal');
  let testLedger: CreditLedgerService;

  beforeEach(() => {
    testLedger = new CreditLedgerService(testDataDir);
    testLedger.reset();
    defaultCreditLedger.reset();
    defaultPayPalClient.resetSimulatedOrders();
  });

  afterEach(() => {
    testLedger.reset();
    defaultCreditLedger.reset();
    defaultPayPalClient.resetSimulatedOrders();
    if (fs.existsSync(testDataDir)) {
      try {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  describe('1. Create Order & Approval Link Preservation', () => {
    it('creates an order and returns the approval URL with rel="approve"', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'usr_test_buyer_1',
        },
        body: JSON.stringify({
          packageId: 'plus',
          returnUrl: 'http://localhost:3000/analyze?paypal_return=true&package_id=plus',
          cancelUrl: 'http://localhost:3000/analyze?paypal_cancel=true&package_id=plus',
        }),
      });

      const res = await handleCreateOrderPost(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.orderId).toBeDefined();
      expect(data.status).toBe('CREATED');
      expect(data.approveUrl).toBeDefined();
      expect(data.approvalUrl).toBe(data.approveUrl);

      // Verify the approval link is present in links array
      const approveLink = data.links?.find((l: { rel: string; href: string }) => l.rel === 'approve');
      expect(approveLink).toBeDefined();
      expect(approveLink.href).toBe(data.approveUrl);
    });

    it('creates and captures an INR order with the configured INR price', async () => {
      const userId = 'usr_inr_buyer';
      const createReq = new NextRequest('http://localhost:3000/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          packageId: 'plus',
          currency: 'INR',
        }),
      });

      const createRes = await handleCreateOrderPost(createReq);
      expect(createRes.status).toBe(200);
      const orderData = await createRes.json();
      expect(orderData.package.price).toBe('419.00');
      expect(orderData.package.currency).toBe('INR');
      defaultPayPalClient.approveOrder(orderData.orderId);

      const captureReq = new NextRequest('http://localhost:3000/api/v1/payments/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          orderId: orderData.orderId,
          packageId: 'plus',
          currency: 'INR',
        }),
      });
      const captureRes = await handleCaptureOrderPost(captureReq);

      expect(captureRes.status).toBe(200);
      const captureData = await captureRes.json();
      expect(captureData.package.price).toBe('419.00');
      expect(captureData.package.currency).toBe('INR');
      expect(captureData.transaction.metadata.price).toBe('419.00');
      expect(captureData.transaction.metadata.currency).toBe('INR');
    });

    it('rejects order creation for non-existent package with HTTP 404', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'usr_test_buyer_1',
        },
        body: JSON.stringify({
          packageId: 'non_existent_package_id',
        }),
      });

      const res = await handleCreateOrderPost(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error.code).toBe('PACKAGE_NOT_FOUND');
    });
  });

  describe('2. ORDER_NOT_APPROVED Rejection on Pre-Approval Capture', () => {
    it('returns HTTP 422 with ORDER_NOT_APPROVED for order 8BV01433166897441', async () => {
      const userId = 'usr_unapproved_buyer';
      const req = new NextRequest('http://localhost:3000/api/v1/payments/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          orderId: '8BV01433166897441',
          packageId: 'plus',
        }),
      });

      const res = await handleCaptureOrderPost(req);
      expect(res.status).toBe(422);

      const data = await res.json();
      expect(data.error.code).toBe('ORDER_NOT_APPROVED');
      expect(data.error.message).toContain('not been approved by the buyer');

      // Verify that NO credits were granted
      const balance = await defaultCreditLedger.getBalance(userId);
      expect(balance.balance).toBe(3); // only initial 3, no purchase credits added
    });

    it('returns HTTP 422 when attempting to capture a freshly created order before buyer approval', async () => {
      const userId = 'usr_early_capture_test';

      // 1. Create order
      const createReq = new NextRequest('http://localhost:3000/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          packageId: 'starter',
        }),
      });
      const createRes = await handleCreateOrderPost(createReq);
      const { orderId } = await createRes.json();

      // 2. Attempt capture before buyer approval
      const captureReq = new NextRequest('http://localhost:3000/api/v1/payments/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          orderId,
          packageId: 'starter',
        }),
      });

      const captureRes = await handleCaptureOrderPost(captureReq);
      expect(captureRes.status).toBe(422);

      const data = await captureRes.json();
      expect(data.error.code).toBe('ORDER_NOT_APPROVED');

      // Verify balance is untouched
      const balance = await defaultCreditLedger.getBalance(userId);
      expect(balance.balance).toBe(3);
    });
  });

  describe('3. Successful Approval → Capture Flow', () => {
    it('successfully captures after buyer approval and grants credits', async () => {
      const userId = 'usr_happy_path_buyer';

      // 1. Create order
      const createReq = new NextRequest('http://localhost:3000/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          packageId: 'plus', // 30 credits
        }),
      });
      const createRes = await handleCreateOrderPost(createReq);
      const { orderId } = await createRes.json();

      // 2. Buyer approves order at PayPal
      defaultPayPalClient.approveOrder(orderId);

      // 3. Capture approved order
      const captureReq = new NextRequest('http://localhost:3000/api/v1/payments/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          orderId,
          packageId: 'plus',
        }),
      });

      const captureRes = await handleCaptureOrderPost(captureReq);
      expect(captureRes.status).toBe(200);

      const data = await captureRes.json();
      expect(data.success).toBe(true);
      expect(data.creditsGranted).toBe(30);
      expect(data.currentBalance).toBe(33); // 3 initial + 30
      expect(data.alreadyRedeemed).toBe(false);

      const balance = await defaultCreditLedger.getBalance(userId);
      expect(balance.balance).toBe(33);
      expect(balance.available).toBe(33);
    });
  });

  describe('4. Cancellation Handling', () => {
    it('gracefully rejects capture if the order was cancelled', async () => {
      const userId = 'usr_cancelled_buyer';

      // 1. Create order
      const createReq = new NextRequest('http://localhost:3000/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          packageId: 'pro',
        }),
      });
      const createRes = await handleCreateOrderPost(createReq);
      const { orderId } = await createRes.json();

      // 2. Buyer cancels at PayPal
      defaultPayPalClient.cancelOrder(orderId);

      // 3. Attempt capture
      const captureReq = new NextRequest('http://localhost:3000/api/v1/payments/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          orderId,
          packageId: 'pro',
        }),
      });

      const captureRes = await handleCaptureOrderPost(captureReq);
      expect(captureRes.status).toBe(422);

      const data = await captureRes.json();
      expect(data.error.code).toBe('ORDER_CANCELLED');

      // Ensure no credits were granted
      const balance = await defaultCreditLedger.getBalance(userId);
      expect(balance.balance).toBe(3);
    });
  });

  describe('5. Duplicate Capture Attempts & Strict Idempotency', () => {
    it('handles duplicate capture calls idempotently without granting duplicate credits', async () => {
      const userId = 'usr_idempotent_test';

      // 1. Create order
      const createReq = new NextRequest('http://localhost:3000/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          packageId: 'starter', // 10 credits
        }),
      });
      const createRes = await handleCreateOrderPost(createReq);
      const { orderId } = await createRes.json();

      // 2. Buyer approves
      defaultPayPalClient.approveOrder(orderId);

      // 3. First capture
      const captureReq1 = new NextRequest('http://localhost:3000/api/v1/payments/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          orderId,
          packageId: 'starter',
        }),
      });
      const res1 = await handleCaptureOrderPost(captureReq1);
      const data1 = await res1.json();
      expect(data1.success).toBe(true);
      expect(data1.alreadyRedeemed).toBe(false);
      expect(data1.currentBalance).toBe(13); // 3 + 10

      // 4. Second capture call with the exact same orderId
      const captureReq2 = new NextRequest('http://localhost:3000/api/v1/payments/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          orderId,
          packageId: 'starter',
        }),
      });
      const res2 = await handleCaptureOrderPost(captureReq2);
      const data2 = await res2.json();
      expect(res2.status).toBe(200);
      expect(data2.success).toBe(true);
      expect(data2.alreadyRedeemed).toBe(true);
      expect(data2.currentBalance).toBe(13); // Must NOT be 23!

      // Verify ledger final balance
      const balance = await defaultCreditLedger.getBalance(userId);
      expect(balance.balance).toBe(13);
    });

    it('ledger directly prevents duplicate credit grants for the same captureId or orderId', async () => {
      const userId = 'usr_ledger_direct_idempotency';

      const res1 = await testLedger.addPurchaseCredits(
        userId,
        10,
        'ORDER_DUP_1',
        'CAP_DUP_1',
        'starter',
        '2.00',
        'USD'
      );
      expect(res1.alreadyRedeemed).toBe(false);

      const res2 = await testLedger.addPurchaseCredits(
        userId,
        10,
        'ORDER_DUP_1',
        'CAP_DUP_1',
        'starter',
        '2.00',
        'USD'
      );
      expect(res2.alreadyRedeemed).toBe(true);

      const balance = await testLedger.getBalance(userId);
      expect(balance.balance).toBe(13); // 3 initial + 10, NOT 23
    });
  });

  describe('6. Webhook Protection for Non-Completed & Manipulated Payments', () => {
    it('never grants credits for non-completed webhook capture events (e.g. PENDING)', async () => {
      const userId = 'usr_webhook_pending_test';
      const webhookPayload = {
        id: 'WH_EVT_PENDING_1',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        create_time: new Date().toISOString(),
        resource: {
          id: 'CAP_PENDING_1',
          status: 'PENDING', // NOT COMPLETED!
          custom_id: `${userId}:plus`,
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

      const res = await handleWebhookPost(req);
      expect(res.status).toBe(200);

      // Verify no credits were granted
      const balance = await defaultCreditLedger.getBalance(userId);
      expect(balance.balance).toBe(3); // only initial 3
    });

    it('rejects webhook capture with price/amount manipulation', async () => {
      const userId = 'usr_webhook_tamper_test';
      const webhookPayload = {
        id: 'WH_EVT_TAMPER_1',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        create_time: new Date().toISOString(),
        resource: {
          id: 'CAP_TAMPER_1',
          status: 'COMPLETED',
          custom_id: `${userId}:plus`, // plus costs 5.00
          amount: {
            value: '0.01', // manipulated price!
            currency_code: 'USD',
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

      // Verify no credits were granted
      const balance = await defaultCreditLedger.getBalance(userId);
      expect(balance.balance).toBe(3);
    });
  });
});

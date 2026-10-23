import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { defaultPayPalClient, PayPalApiError } from '@/src/lib/payments/paypalClient';
import { defaultCreditLedger } from '@/src/lib/payments/ledger';
import { getCreditPackageById } from '@/src/lib/payments/config';
import { getUserIdFromRequest, attachUserSessionHeaders } from '@/src/lib/payments/userSession';
import { defaultRateLimiter } from '@/src/lib/security/rateLimiter';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';
import { safeLogger } from '@/src/lib/security/logger';

const CaptureOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required.'),
  packageId: z.string().min(1, 'Package ID is required.'),
});

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-User-Id',
    },
  });
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  // Rate Limiting Check
  const rateLimitCheck = defaultRateLimiter.handleRateLimit(req);
  if (rateLimitCheck.isRateLimited && rateLimitCheck.response) {
    return rateLimitCheck.response;
  }

  const sessionInfo = getUserIdFromRequest(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(
      400,
      'INVALID_JSON',
      'The request body must be valid JSON.',
      requestId
    );
  }

  const parseResult = CaptureOrderSchema.safeParse(body);
  if (!parseResult.success) {
    return createErrorResponse(
      400,
      'INVALID_INPUT',
      parseResult.error.issues[0]?.message || 'Invalid parameters.',
      requestId
    );
  }

  const { orderId, packageId } = parseResult.data;
  const pkg = getCreditPackageById(packageId);
  if (!pkg) {
    return createErrorResponse(
      404,
      'PACKAGE_NOT_FOUND',
      `Credit package "${packageId}" does not exist.`,
      requestId
    );
  }

  try {
    // 1. Capture Order via PayPal API
    const captureData = await defaultPayPalClient.captureOrder(orderId, packageId);

    // 2. Verify Capture Status
    if (captureData.status !== 'COMPLETED') {
      safeLogger.warn(`PayPal order ${orderId} capture not completed (status: ${captureData.status})`);
      return createErrorResponse(
        400,
        'PAYMENT_NOT_COMPLETED',
        `Payment was not completed by PayPal (Status: ${captureData.status}).`,
        requestId
      );
    }

    // 3. Extract capture details
    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id || `cap_${orderId}`;
    const capturedAmount = capture?.amount?.value;
    const capturedCurrency = capture?.amount?.currency_code;

    // 4. Verify Amount & Currency match expected purchase
    if (capturedAmount && parseFloat(capturedAmount) < parseFloat(pkg.price)) {
      safeLogger.error(
        `Amount manipulation detected: order ${orderId} captured ${capturedAmount} ${capturedCurrency}, expected ${pkg.price} ${pkg.currency}`
      );
      return createErrorResponse(
        400,
        'AMOUNT_MISMATCH',
        'Captured payment amount does not match the package price.',
        requestId
      );
    }

    if (capturedCurrency && capturedCurrency !== pkg.currency) {
      safeLogger.error(
        `Currency manipulation detected: order ${orderId} captured ${capturedCurrency}, expected ${pkg.currency}`
      );
      return createErrorResponse(
        400,
        'CURRENCY_MISMATCH',
        'Captured payment currency does not match the package currency.',
        requestId
      );
    }

    // 5. Idempotently add purchased credits to ledger
    const creditResult = await defaultCreditLedger.addPurchaseCredits(
      sessionInfo.userId,
      pkg.credits,
      orderId,
      captureId,
      pkg.id,
      pkg.price,
      pkg.currency
    );

    const balanceInfo = await defaultCreditLedger.getBalance(sessionInfo.userId);

    const response = NextResponse.json({
      success: true,
      orderId,
      captureId,
      package: pkg,
      creditsGranted: pkg.credits,
      alreadyRedeemed: creditResult.alreadyRedeemed,
      currentBalance: balanceInfo.balance,
      available: balanceInfo.available,
      transaction: creditResult.transaction,
    });

    return attachUserSessionHeaders(response, sessionInfo);
  } catch (err: unknown) {
    if (err instanceof PayPalApiError) {
      safeLogger.warn(
        `PayPal API error during capture: status=${err.statusCode}, issue=${err.issueCode}, message=${err.message}`
      );

      if (err.issueCode === 'ORDER_CANCELLED') {
        return createErrorResponse(
          422,
          'ORDER_CANCELLED',
          'Order was cancelled by the buyer.',
          requestId
        );
      }

      if (err.issueCode === 'ORDER_NOT_APPROVED' || err.statusCode === 422) {
        return createErrorResponse(
          422,
          'ORDER_NOT_APPROVED',
          'Order has not been approved by the buyer. Please complete approval at PayPal before capturing.',
          requestId
        );
      }

      if (err.issueCode === 'RESOURCE_NOT_FOUND' || err.statusCode === 404) {
        return createErrorResponse(
          404,
          'ORDER_NOT_FOUND',
          'PayPal order not found.',
          requestId
        );
      }

      return createErrorResponse(
        err.statusCode || 400,
        err.issueCode || 'PAYMENT_CAPTURE_ERROR',
        err.message || 'PayPal payment capture failed.',
        requestId
      );
    }

    safeLogger.error(`Error capturing PayPal order ${orderId}: ${(err as Error)?.message}`, {
      requestId,
    });
    return createErrorResponse(
      500,
      'CAPTURE_FAILED',
      'Failed to capture and verify PayPal order.',
      requestId
    );
  }
}

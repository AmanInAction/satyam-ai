import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { defaultPayPalClient } from '@/src/lib/payments/paypalClient';
import { getCreditPackageById } from '@/src/lib/payments/config';
import { getUserIdFromRequest, attachUserSessionHeaders } from '@/src/lib/payments/userSession';
import { defaultRateLimiter } from '@/src/lib/security/rateLimiter';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';
import { safeLogger } from '@/src/lib/security/logger';

const CreateOrderSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required.'),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
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

  const parseResult = CreateOrderSchema.safeParse(body);
  if (!parseResult.success) {
    return createErrorResponse(
      400,
      'INVALID_INPUT',
      parseResult.error.issues[0]?.message || 'Invalid parameters.',
      requestId
    );
  }

  const { packageId, returnUrl, cancelUrl } = parseResult.data;
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
    const order = await defaultPayPalClient.createOrder(
      packageId,
      sessionInfo.userId,
      returnUrl,
      cancelUrl
    );

    safeLogger.info(`Created PayPal order ${order.id} for user ${sessionInfo.userId} (package ${packageId})`);

    const response = NextResponse.json({
      orderId: order.id,
      status: order.status,
      links: order.links,
      package: pkg,
      isSandbox: !defaultPayPalClient.isConfigured() || process.env.PAYPAL_ENV !== 'production',
    });

    return attachUserSessionHeaders(response, sessionInfo);
  } catch (err: unknown) {
    safeLogger.error(`Error in create-order endpoint: ${(err as Error)?.message}`, { requestId });
    return createErrorResponse(
      500,
      'ORDER_CREATION_FAILED',
      'Failed to create PayPal order. Please verify PayPal Sandbox configuration.',
      requestId
    );
  }
}

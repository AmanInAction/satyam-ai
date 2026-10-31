import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { defaultPayPalClient } from '@/src/lib/payments/paypalClient';
import { getCreditPackageById } from '@/src/lib/payments/config';
import { getUserIdFromRequest, attachUserSessionHeaders } from '@/src/lib/payments/userSession';
import { defaultRateLimiter } from '@/src/lib/security/rateLimiter';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';
import { safeLogger } from '@/src/lib/security/logger';
import { SUPPORTED_PAYMENT_CURRENCIES } from '@/src/lib/payments/types';

const CreateOrderSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required.'),
  currency: z.enum(SUPPORTED_PAYMENT_CURRENCIES).default('USD'),
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

  const sessionInfo = await getUserIdFromRequest(req);

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

  const { packageId, currency, returnUrl, cancelUrl } = parseResult.data;
  const pkg = getCreditPackageById(packageId, currency);
  if (!pkg) {
    return createErrorResponse(
      404,
      'PACKAGE_NOT_FOUND',
      `Credit package "${packageId}" does not exist.`,
      requestId
    );
  }

  // Derive default return and cancel URLs if not provided
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const origin = `${proto}://${host}`;
  const effectiveReturnUrl =
    returnUrl || `${origin}/analyze?paypal_return=true&package_id=${packageId}&currency=${currency}`;
  const effectiveCancelUrl =
    cancelUrl || `${origin}/analyze?paypal_cancel=true&package_id=${packageId}&currency=${currency}`;

  try {
    const order = await defaultPayPalClient.createOrder(
      packageId,
      sessionInfo.userId,
      effectiveReturnUrl,
      effectiveCancelUrl,
      currency
    );

    const approveLink = order.links?.find((l) => l.rel === 'approve');
    const approveUrl = order.approvalUrl || order.approveUrl || approveLink?.href || null;

    safeLogger.info(
      `Created PayPal order ${order.id} for user ${sessionInfo.userId} (package ${packageId}, approveUrl: ${approveUrl ? 'present' : 'none'})`
    );

    const response = NextResponse.json({
      orderId: order.id,
      status: order.status,
      links: order.links,
      approveUrl,
      approvalUrl: approveUrl,
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

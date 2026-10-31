import { NextRequest, NextResponse } from 'next/server';
import { defaultCreditLedger } from '@/src/lib/payments/ledger';
import { getUserIdFromRequest, attachUserSessionHeaders } from '@/src/lib/payments/userSession';
import { CREDIT_PACKAGES, CREDIT_COSTS, getPayPalConfig } from '@/src/lib/payments/config';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-User-Id',
    },
  });
}

export async function GET(req: NextRequest) {
  const requestId = generateRequestId();
  const sessionInfo = await getUserIdFromRequest(req);

  try {
    // Idempotently get or initialize user with 3 free credits
    const balanceInfo = await defaultCreditLedger.getOrCreateUser(sessionInfo.userId);
    const paypalConfig = getPayPalConfig();

    const response = NextResponse.json({
      ...balanceInfo,
      costs: CREDIT_COSTS,
      packages: CREDIT_PACKAGES,
      paypal: {
        isConfigured: paypalConfig.isConfigured,
        isSandbox: !paypalConfig.isLive,
        clientId: paypalConfig.isConfigured ? paypalConfig.clientId : undefined,
      },
    });

    return attachUserSessionHeaders(response, sessionInfo);
  } catch {
    return createErrorResponse(
      500,
      'INTERNAL_ERROR',
      'Unable to retrieve credit balance.',
      requestId
    );
  }
}

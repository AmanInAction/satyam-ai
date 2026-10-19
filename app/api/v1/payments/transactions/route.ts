import { NextRequest, NextResponse } from 'next/server';
import { defaultCreditLedger } from '@/src/lib/payments/ledger';
import { getUserIdFromRequest, attachUserSessionHeaders } from '@/src/lib/payments/userSession';
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
  const sessionInfo = getUserIdFromRequest(req);

  try {
    const transactions = await defaultCreditLedger.getTransactions(sessionInfo.userId);
    const balanceInfo = await defaultCreditLedger.getBalance(sessionInfo.userId);

    const response = NextResponse.json({
      userId: sessionInfo.userId,
      balance: balanceInfo.balance,
      available: balanceInfo.available,
      transactions,
    });

    return attachUserSessionHeaders(response, sessionInfo);
  } catch {
    return createErrorResponse(
      500,
      'INTERNAL_ERROR',
      'Unable to retrieve transaction ledger history.',
      requestId
    );
  }
}

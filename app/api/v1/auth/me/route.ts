import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, attachUserSessionHeaders } from '@/src/lib/payments/userSession';
import { defaultCreditLedger } from '@/src/lib/payments/ledger';
import { defaultDb } from '@/src/lib/db/database';

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
  const sessionInfo = await getUserIdFromRequest(req);
  const balanceInfo = await defaultCreditLedger.getBalance(sessionInfo.userId);
  const recentAnalyses = await defaultDb.getAnalysesByUser(sessionInfo.userId, 5);

  const response = NextResponse.json({
    userId: sessionInfo.userId,
    isAuthenticated: Boolean(sessionInfo.isAuthenticated),
    user: sessionInfo.isAuthenticated
      ? {
          id: sessionInfo.userId,
          email: sessionInfo.userEmail,
          displayName: sessionInfo.displayName,
        }
      : null,
    balance: balanceInfo.balance,
    available: balanceInfo.available,
    reserved: balanceInfo.reserved,
    recentAnalysesCount: recentAnalyses.length,
  });

  return attachUserSessionHeaders(response, sessionInfo);
}

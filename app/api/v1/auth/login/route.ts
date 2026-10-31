import { NextRequest, NextResponse } from 'next/server';
import { defaultDb } from '@/src/lib/db/database';
import { defaultCreditLedger } from '@/src/lib/payments/ledger';
import { getUserIdFromRequest, attachUserSessionHeaders } from '@/src/lib/payments/userSession';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';
import { defaultRateLimiter } from '@/src/lib/security/rateLimiter';

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

  // Rate Limiting
  const rateLimitCheck = defaultRateLimiter.handleRateLimit(req);
  if (rateLimitCheck.isRateLimited && rateLimitCheck.response) {
    return rateLimitCheck.response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON.', requestId);
  }

  const { email, password } = body || {};

  if (!email || !password) {
    return createErrorResponse(
      400,
      'INVALID_INPUT',
      'Both email and password are required.',
      requestId
    );
  }

  try {
    const user = await defaultDb.findUserByEmail(email);
    if (!user) {
      return createErrorResponse(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
        requestId
      );
    }

    const isValid = defaultDb.verifyPassword(password, user.password_hash, user.password_salt);
    if (!isValid) {
      return createErrorResponse(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
        requestId
      );
    }

    // Migrate anonymous credits if any
    const priorSession = await getUserIdFromRequest(req);
    if (priorSession.userId && priorSession.userId !== user.id && !priorSession.isAuthenticated) {
      await defaultCreditLedger.migrateUser(priorSession.userId, user.id);
    }

    const session = await defaultDb.createSession(user.id);
    const balanceInfo = await defaultCreditLedger.getBalance(user.id);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        createdAt: user.created_at,
      },
      balance: balanceInfo.balance,
      available: balanceInfo.available,
      token: session.token,
    });

    return attachUserSessionHeaders(response, {
      userId: user.id,
      isNewUser: false,
      isAuthenticated: true,
      userEmail: user.email,
      displayName: user.display_name,
      sessionToken: session.token,
    });
  } catch {
    return createErrorResponse(500, 'LOGIN_FAILED', 'Unable to log in at this time.', requestId);
  }
}

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

  const { email, password, displayName } = body || {};

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return createErrorResponse(400, 'INVALID_EMAIL', 'A valid email address is required.', requestId);
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return createErrorResponse(
      400,
      'WEAK_PASSWORD',
      'Password must be at least 6 characters long.',
      requestId
    );
  }

  try {
    // 1. Identify any prior anonymous session to seamlessly migrate credits & scans
    const priorSession = getUserIdFromRequest(req);

    // 2. Create the user in SQLite
    const user = defaultDb.createUser(email, password, displayName);

    // 3. Migrate credits from anonymous user if present, or initialize free credits
    if (priorSession.userId && priorSession.userId !== user.id) {
      await defaultCreditLedger.migrateUser(priorSession.userId, user.id);
    } else {
      await defaultCreditLedger.getOrCreateUser(user.id);
    }

    // 4. Create persistent session token
    const session = defaultDb.createSession(user.id);
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
  } catch (err: unknown) {
    if ((err as any)?.code === 'EMAIL_EXISTS') {
      return createErrorResponse(
        409,
        'EMAIL_EXISTS',
        'An account with this email address already exists. Please log in.',
        requestId
      );
    }
    return createErrorResponse(500, 'REGISTER_FAILED', 'Unable to create user account.', requestId);
  }
}

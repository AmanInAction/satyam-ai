import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { defaultDb } from '@/src/lib/db/database';
import { getUserIdFromRequest } from '@/src/lib/payments/userSession';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';
import { safeLogger } from '@/src/lib/security/logger';

const LINK_CODE_TTL_MS = 10 * 60 * 1000;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const session = await getUserIdFromRequest(req);

  if (!session.isAuthenticated) {
    return createErrorResponse(
      401,
      'AUTHENTICATION_REQUIRED',
      'Sign in to your SatyamAI account before linking Telegram.',
      requestId
    );
  }

  const code = crypto.randomBytes(32).toString('base64url');
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');

  try {
    await defaultDb.createTelegramLinkCode(
      session.userId,
      codeHash,
      Date.now() + LINK_CODE_TTL_MS
    );
    return NextResponse.json({ code, expiresInSeconds: LINK_CODE_TTL_MS / 1000 });
  } catch (err: unknown) {
    safeLogger.error(`Unable to create Telegram link code: ${(err as Error)?.message}`, {
      requestId,
    });
    return createErrorResponse(
      500,
      'TELEGRAM_LINK_CODE_FAILED',
      'Unable to create a Telegram link code. Please try again.',
      requestId
    );
  }
}

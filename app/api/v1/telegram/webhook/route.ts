import { NextRequest, NextResponse } from 'next/server';
import { defaultTelegramBotService } from '@/src/lib/telegram/botService';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';
import { safeLogger } from '@/src/lib/security/logger';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token',
    },
  });
}

/**
 * Health / Diagnostics endpoint for Telegram Webhook
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'satyam-ai-telegram-webhook',
    version: 'v1',
    bot_token_configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    webhook_secret_configured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Main Webhook endpoint for Telegram updates
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  // 1. Authenticate webhook secret token if configured
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  if (!defaultTelegramBotService.validateWebhookSecret(secretHeader)) {
    safeLogger.warn('Telegram webhook received with invalid secret token', { requestId });
    return createErrorResponse(
      401,
      'UNAUTHORIZED_WEBHOOK',
      'The webhook secret token is invalid or missing.',
      requestId
    );
  }

  // 2. Parse incoming JSON update
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(
      400,
      'INVALID_JSON',
      'Telegram update body must be valid JSON.',
      requestId
    );
  }

  if (!body || typeof body !== 'object') {
    return createErrorResponse(
      400,
      'INVALID_UPDATE',
      'Telegram update payload must be an object.',
      requestId
    );
  }

  try {
    // 3. Process update through SatyamAI bot service
    const replyPayload = await defaultTelegramBotService.processUpdate(body as any);

    if (replyPayload) {
      // Return direct webhook sendMessage response payload
      return NextResponse.json(replyPayload, { status: 200 });
    }

    // Acknowledge non-message or duplicate updates with HTTP 200
    return NextResponse.json({ status: 'ok', acknowledged: true }, { status: 200 });
  } catch (err: unknown) {
    safeLogger.error(`Unexpected error handling Telegram webhook: ${(err as Error)?.message}`, {
      requestId,
    });
    // Return 200 to Telegram so it does not endlessly retry fatal payload errors
    return NextResponse.json({ status: 'error', request_id: requestId }, { status: 200 });
  }
}

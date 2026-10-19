import { NextRequest, NextResponse } from 'next/server';
import { UrlAnalysisRequestSchema } from '@/src/lib/validation/schemas';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';
import { defaultOrchestrator } from '@/src/lib/analysis/orchestrator';
import { defaultRateLimiter } from '@/src/lib/security/rateLimiter';
import { checkAndReserveCredits, finalizeCreditUsage, CreditGuardResult } from '@/src/lib/payments/creditGuard';
import { attachUserSessionHeaders } from '@/src/lib/payments/userSession';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  const parseResult = UrlAnalysisRequestSchema.safeParse(body);
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    const message = issue ? issue.message : 'Invalid URL provided.';
    return createErrorResponse(
      400,
      'INVALID_INPUT',
      message,
      requestId,
      parseResult.error.flatten()
    );
  }

  // Credit Authorization & Reservation Check (1 credit)
  let creditGuardResult: CreditGuardResult | null = null;
  try {
    creditGuardResult = await checkAndReserveCredits(req, 'url');
  } catch (creditErr: unknown) {
    if ((creditErr as any)?.code === 'INSUFFICIENT_CREDITS') {
      return createErrorResponse(
        402,
        'INSUFFICIENT_CREDITS',
        'You do not have enough credits to analyze this URL. Please top up your credits to continue.',
        requestId,
        {
          required: (creditErr as any).required,
          available: (creditErr as any).available,
          purchaseUrl: '/api/v1/payments/credits',
        }
      );
    }
    return createErrorResponse(
      500,
      'CREDIT_AUTHORIZATION_FAILED',
      'Unable to authorize credits for analysis.',
      requestId
    );
  }

  try {
    const analysis = await defaultOrchestrator.analyzeUrl(parseResult.data.url);

    // Commit credit deduction upon successful analysis
    const remainingCredits = await finalizeCreditUsage(
      creditGuardResult.reservation,
      analysis.analysis_id,
      true
    );

    const response = NextResponse.json({
      ...analysis,
      credits: {
        cost: creditGuardResult.cost,
        remaining: remainingCredits,
      },
    });

    response.headers.set('X-Credits-Remaining', remainingCredits.toString());

    if (rateLimitCheck.headers) {
      for (const [key, val] of Object.entries(rateLimitCheck.headers)) {
        response.headers.set(key, val);
      }
    }
    return attachUserSessionHeaders(response, creditGuardResult.sessionInfo);
  } catch (err: unknown) {
    // Release credit reservation on failure so user is not charged
    if (creditGuardResult?.reservation) {
      await finalizeCreditUsage(
        creditGuardResult.reservation,
        'failed',
        false,
        (err as Error)?.message
      );
    }

    const message = (err as Error)?.message || 'An unexpected error occurred while analyzing the URL.';
    const isSsrf = message.includes('SSRF protection');
    const isValidation =
      isSsrf ||
      message.includes('Unsupported protocol') ||
      message.includes('Port ') ||
      message.includes('URL exceeds') ||
      message.includes('Invalid');

    if (isValidation) {
      return createErrorResponse(
        400,
        isSsrf ? 'SSRF_BLOCKED' : 'INVALID_INPUT',
        message,
        requestId
      );
    }

    return createErrorResponse(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred while analyzing the URL.',
      requestId
    );
  }
}

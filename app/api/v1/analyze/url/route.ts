import { NextRequest, NextResponse } from 'next/server';
import { UrlAnalysisRequestSchema } from '@/src/lib/validation/schemas';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';
import { defaultOrchestrator } from '@/src/lib/analysis/orchestrator';
import { defaultRateLimiter } from '@/src/lib/security/rateLimiter';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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

  try {
    const analysis = await defaultOrchestrator.analyzeUrl(parseResult.data.url);
    const response = NextResponse.json(analysis);
    if (rateLimitCheck.headers) {
      for (const [key, val] of Object.entries(rateLimitCheck.headers)) {
        response.headers.set(key, val);
      }
    }
    return response;
  } catch (err: unknown) {
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

import { NextRequest, NextResponse } from 'next/server';
import { UrlAnalysisRequestSchema } from '@/src/lib/validation/schemas';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';
import { defaultOrchestrator } from '@/src/lib/analysis/orchestrator';

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

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
    return NextResponse.json(analysis);
  } catch {
    return createErrorResponse(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred while analyzing the URL.',
      requestId
    );
  }
}

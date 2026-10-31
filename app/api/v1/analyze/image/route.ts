import { NextRequest, NextResponse } from 'next/server';
import { ImageAnalysisRequestSchema } from '@/src/lib/validation/schemas';
import { createErrorResponse, generateRequestId, ApiError } from '@/src/lib/errors/apiError';
import { defaultOrchestrator } from '@/src/lib/analysis/orchestrator';
import { defaultRateLimiter } from '@/src/lib/security/rateLimiter';
import { checkAndReserveCredits, finalizeCreditUsage, CreditGuardResult } from '@/src/lib/payments/creditGuard';
import { attachUserSessionHeaders } from '@/src/lib/payments/userSession';
import { defaultDb } from '@/src/lib/db/database';
import { safeLogger } from '@/src/lib/security/logger';

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

  const contentType = req.headers.get('content-type') || '';

  let imageBuffer: Buffer;
  let declaredMimeType: string | undefined;
  let languageHint: string = 'auto';

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await req.formData();
      const fileEntry = formData.get('file') || formData.get('image');

      if (!fileEntry || !(fileEntry instanceof Blob)) {
        return createErrorResponse(
          400,
          'MISSING_FILE',
          'A screenshot image file must be provided under the "file" or "image" field.',
          requestId
        );
      }

      declaredMimeType = fileEntry.type;
      const hint = formData.get('language_hint');
      if (typeof hint === 'string' && ['auto', 'en', 'hi', 'hinglish'].includes(hint)) {
        languageHint = hint;
      }

      const arrayBuffer = await fileEntry.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } catch {
      return createErrorResponse(
        400,
        'MALFORMED_FORM_DATA',
        'Could not parse multipart/form-data payload.',
        requestId
      );
    }
  } else if (contentType.includes('application/json')) {
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

    const parseResult = ImageAnalysisRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? issue.message : 'Invalid request parameters.';
      return createErrorResponse(
        400,
        'INVALID_INPUT',
        message,
        requestId,
        parseResult.error.flatten()
      );
    }

    const base64Data = (parseResult.data as any).image_data || (parseResult.data as any).image_base64 || '';
    const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    try {
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    } catch {
      return createErrorResponse(
        400,
        'INVALID_BASE64',
        'Could not decode base64 image data.',
        requestId
      );
    }

    declaredMimeType = parseResult.data.mime_type;
    languageHint = parseResult.data.language_hint || 'auto';
  } else {
    return createErrorResponse(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Requests must be submitted as multipart/form-data or application/json.',
      requestId
    );
  }

  // Credit Authorization & Reservation Check (2 credits for screenshot OCR analysis)
  let creditGuardResult: CreditGuardResult | null = null;
  try {
    creditGuardResult = await checkAndReserveCredits(req, 'image');
  } catch (creditErr: unknown) {
    if ((creditErr as any)?.code === 'INSUFFICIENT_CREDITS') {
      return createErrorResponse(
        402,
        'INSUFFICIENT_CREDITS',
        'You do not have enough credits to analyze this screenshot. Screenshot analysis requires 2 credits.',
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
      'Unable to authorize credits for screenshot analysis.',
      requestId
    );
  }

  try {
    const analysis = await defaultOrchestrator.analyzeImage(
      imageBuffer,
      declaredMimeType,
      languageHint
    );

    // Commit credit deduction upon successful analysis
    const remainingCredits = await finalizeCreditUsage(
      creditGuardResult.reservation,
      analysis.analysis_id,
      true
    );

    // Save to SQLite database for persistent user history
    try {
      const extractedSummary = analysis.extracted_text?.slice(0, 200) || 'Screenshot / Image scan';
      await defaultDb.saveAnalysis({
        id: analysis.analysis_id,
        userId: creditGuardResult.sessionInfo.userId,
        inputType: 'image',
        inputPreview: extractedSummary,
        verdict: analysis.classification.scam_risk.verdict,
        scamRisk: analysis.classification.scam_risk.risk_level,
        claimVerdict: analysis.classification.claim_verification.verdict,
        confidenceScore: 0.9,
        reasonsSummary:
          analysis.reasons?.map((r) => r.title || r.explanation).slice(0, 2).join('; ') ||
          'Screenshot OCR and threat analysis completed',
        fullResult: analysis,
      });
    } catch (error) {
      safeLogger.error('Failed to persist image analysis history.', {
        analysisId: analysis.analysis_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

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

    if (err instanceof ApiError) {
      return createErrorResponse(
        err.statusCode,
        err.code,
        err.message,
        requestId,
        err.details
      );
    }

    return createErrorResponse(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred while processing the screenshot analysis.',
      requestId
    );
  }
}

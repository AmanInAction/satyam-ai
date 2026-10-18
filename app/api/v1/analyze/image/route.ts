import { NextRequest, NextResponse } from 'next/server';
import { ImageAnalysisRequestSchema } from '@/src/lib/validation/schemas';
import { createErrorResponse, generateRequestId, ApiError } from '@/src/lib/errors/apiError';
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
      return createErrorResponse(
        400,
        'INVALID_INPUT',
        issue?.message || 'Invalid image request parameters.',
        requestId,
        parseResult.error.flatten()
      );
    }

    declaredMimeType = parseResult.data.mime_type;
    languageHint = parseResult.data.language_hint || 'auto';

    // Strip data URL scheme prefix if present (e.g. "data:image/png;base64,...")
    let rawBase64 = parseResult.data.image_data;
    if (rawBase64.includes(';base64,')) {
      rawBase64 = rawBase64.split(';base64,')[1];
    }

    try {
      imageBuffer = Buffer.from(rawBase64, 'base64');
    } catch {
      return createErrorResponse(
        400,
        'INVALID_BASE64',
        'Image data must be a valid base64-encoded string.',
        requestId
      );
    }
  } else {
    return createErrorResponse(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Requests must be submitted as multipart/form-data or application/json.',
      requestId
    );
  }

  try {
    const analysis = await defaultOrchestrator.analyzeImage(
      imageBuffer,
      declaredMimeType,
      languageHint
    );
    const response = NextResponse.json(analysis);
    if (rateLimitCheck.headers) {
      for (const [key, val] of Object.entries(rateLimitCheck.headers)) {
        response.headers.set(key, val);
      }
    }
    return response;
  } catch (err: unknown) {
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

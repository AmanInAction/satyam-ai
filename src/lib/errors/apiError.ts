import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    request_id: string;
    details?: unknown;
  };
}

export function generateRequestId(): string {
  return `req_${crypto.randomBytes(8).toString('hex')}`;
}

export function createErrorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string = generateRequestId(),
  details?: unknown
): NextResponse<ApiErrorShape> {
  const body: ApiErrorShape = {
    error: {
      code,
      message,
      request_id: requestId,
      ...(details ? { details } : {}),
    },
  };
  return NextResponse.json(body, { status });
}

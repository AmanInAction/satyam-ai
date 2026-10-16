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

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
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

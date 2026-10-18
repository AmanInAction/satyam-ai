import { NextRequest } from 'next/server';
import { createErrorResponse, generateRequestId } from '../errors/apiError';

export interface RateLimitConfig {
  maxRequests: number; // Max requests per window
  windowMs: number;    // Window size in ms
}

interface ClientRecord {
  timestamps: number[];
}

export class InMemoryRateLimiter {
  private clients: Map<string, ClientRecord> = new Map();
  private maxRequests: number;
  private windowMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig = { maxRequests: 60, windowMs: 60 * 1000 }) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;

    // Prune stale records every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 2 * 60 * 1000);

    // Unref cleanup timer so it does not block node exit
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Identifies client IP from headers or connection
   */
  getClientIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers.get('x-real-ip');
    if (realIp) {
      return realIp.trim();
    }
    const cfIp = req.headers.get('cf-connecting-ip');
    if (cfIp) {
      return cfIp.trim();
    }
    return '127.0.0.1';
  }

  /**
   * Checks whether the request is within rate limit
   */
  check(req: NextRequest, customLimit?: number): {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetSeconds: number;
  } {
    // In test environment, bypass unless testing rate limit specifically
    if (process.env.VITEST && !process.env.TEST_RATE_LIMITER) {
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        resetSeconds: 60,
      };
    }

    const ip = this.getClientIp(req);
    const now = Date.now();
    const limit = customLimit ?? this.maxRequests;

    let record = this.clients.get(ip);
    if (!record) {
      record = { timestamps: [] };
      this.clients.set(ip, record);
    }

    // Filter out timestamps outside current sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < this.windowMs);

    const count = record.timestamps.length;
    const remaining = Math.max(0, limit - count - 1);
    const oldestTimestamp = record.timestamps[0] || now;
    const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + this.windowMs - now) / 1000));

    if (count >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSeconds,
      };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      limit,
      remaining,
      resetSeconds,
    };
  }

  /**
   * Creates a 429 response if rate limit is exceeded
   */
  handleRateLimit(req: NextRequest, customLimit?: number) {
    const result = this.check(req, customLimit);
    if (!result.allowed) {
      const requestId = generateRequestId();
      const response = createErrorResponse(
        429,
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded. Maximum ${result.limit} requests per minute allowed. Please wait before retrying.`,
        requestId
      );
      response.headers.set('X-RateLimit-Limit', result.limit.toString());
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', result.resetSeconds.toString());
      response.headers.set('Retry-After', result.resetSeconds.toString());
      return { isRateLimited: true, response };
    }

    return {
      isRateLimited: false,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetSeconds.toString(),
      },
    };
  }

  /**
   * Resets rate limit records (useful for test resets)
   */
  reset(): void {
    this.clients.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, record] of this.clients.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < this.windowMs);
      if (record.timestamps.length === 0) {
        this.clients.delete(ip);
      }
    }
  }
}

export const defaultRateLimiter = new InMemoryRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000,
});

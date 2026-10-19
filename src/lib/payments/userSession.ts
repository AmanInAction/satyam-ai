import { NextRequest, NextResponse } from 'next/server';

/**
 * Helper to identify users consistently across HTTP requests and attach
 * anonymous persistent session cookies when needed.
 */

export const USER_COOKIE_NAME = 'satyam_user_id';
export const USER_HEADER_NAME = 'x-user-id';

export interface UserSessionInfo {
  userId: string;
  isNewUser: boolean;
}

export function getUserIdFromRequest(req: NextRequest): UserSessionInfo {
  // 1. Check custom client header
  const headerUserId = req.headers.get(USER_HEADER_NAME);
  if (headerUserId && headerUserId.trim().length > 0) {
    return {
      userId: sanitizeUserId(headerUserId.trim()),
      isNewUser: false,
    };
  }

  // 2. Check HTTP cookie
  const cookieUserId = req.cookies.get(USER_COOKIE_NAME)?.value;
  if (cookieUserId && cookieUserId.trim().length > 0) {
    return {
      userId: sanitizeUserId(cookieUserId.trim()),
      isNewUser: false,
    };
  }

  // 3. Generate new user ID
  const newUserId = `usr_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
  return {
    userId: newUserId,
    isNewUser: true,
  };
}

export function attachUserSessionHeaders(
  res: NextResponse,
  sessionInfo: UserSessionInfo
): NextResponse {
  // Always set X-User-Id header for client visibility
  res.headers.set(USER_HEADER_NAME, sessionInfo.userId);

  // Set persistent session cookie if newly generated
  if (sessionInfo.isNewUser) {
    res.cookies.set({
      name: USER_COOKIE_NAME,
      value: sessionInfo.userId,
      path: '/',
      httpOnly: false, // Accessible by client JS so frontend knows its userId
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60, // 1 year
    });
  }

  return res;
}

function sanitizeUserId(userId: string): string {
  // Allow alphanumeric, underscores, hyphens, and telegram prefixes
  return userId.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
}

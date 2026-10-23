import { NextRequest, NextResponse } from 'next/server';
import { defaultDb } from '../db/database';

/**
 * Helper to identify users consistently across HTTP requests, supporting both
 * authenticated sessions (via SQLite) and anonymous persistent session cookies.
 */

export const USER_COOKIE_NAME = 'satyam_user_id';
export const USER_HEADER_NAME = 'x-user-id';
export const SESSION_COOKIE_NAME = 'satyam_session_token';

export interface UserSessionInfo {
  userId: string;
  isNewUser: boolean;
  isAuthenticated?: boolean;
  userEmail?: string;
  displayName?: string;
  sessionToken?: string;
}

export function getUserIdFromRequest(req: NextRequest): UserSessionInfo {
  // 1. Check for authenticated session token (via cookie or Authorization header)
  let sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      sessionToken = authHeader.slice(7).trim();
    }
  }

  if (sessionToken) {
    try {
      const session = defaultDb.getSession(sessionToken);
      if (session) {
        return {
          userId: session.user_id,
          isNewUser: false,
          isAuthenticated: true,
          userEmail: session.user.email,
          displayName: session.user.display_name,
          sessionToken,
        };
      }
    } catch {
      // If DB error, fall back to anonymous identifiers
    }
  }

  // 2. Check custom client header for anonymous user
  const headerUserId = req.headers.get(USER_HEADER_NAME);
  if (headerUserId && headerUserId.trim().length > 0) {
    return {
      userId: sanitizeUserId(headerUserId.trim()),
      isNewUser: false,
      isAuthenticated: false,
    };
  }

  // 3. Check HTTP cookie for anonymous user
  const cookieUserId = req.cookies.get(USER_COOKIE_NAME)?.value;
  if (cookieUserId && cookieUserId.trim().length > 0) {
    return {
      userId: sanitizeUserId(cookieUserId.trim()),
      isNewUser: false,
      isAuthenticated: false,
    };
  }

  // 4. Generate new anonymous user ID
  const newUserId = `usr_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
  return {
    userId: newUserId,
    isNewUser: true,
    isAuthenticated: false,
  };
}

export function attachUserSessionHeaders(
  res: NextResponse,
  sessionInfo: UserSessionInfo
): NextResponse {
  // Always set X-User-Id header for client visibility
  res.headers.set(USER_HEADER_NAME, sessionInfo.userId);

  // Set persistent session cookie if newly generated anonymous user
  if (sessionInfo.isNewUser && !sessionInfo.isAuthenticated) {
    res.cookies.set({
      name: USER_COOKIE_NAME,
      value: sessionInfo.userId,
      path: '/',
      httpOnly: false, // Accessible by client JS so frontend knows its userId
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60, // 1 year
    });
  }

  // Set authenticated session cookie if sessionToken is present
  if (sessionInfo.sessionToken) {
    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionInfo.sessionToken,
      path: '/',
      httpOnly: true, // Secure httpOnly cookie for session token
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
  }

  return res;
}

export function sanitizeUserId(userId: string): string {
  // Allow alphanumeric, underscores, hyphens, and telegram prefixes
  return userId.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
}

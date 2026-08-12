import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

// Server-only — never import from a "use client" component. Same FIREBASE_ADMIN_*
// env vars as apps/admin/src/lib/firebase-admin.ts (one Firebase project, two apps).
function getAdminApp(): App {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

// 14-day session cookie lifetime (build spec §3.3).
export const SESSION_COOKIE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// Verify the short-lived ID token the client sends once at sign-in.
export async function verifyIdToken(idToken: string): Promise<DecodedIdToken | null> {
  try {
    return await adminAuth().verifyIdToken(idToken, true);
  } catch {
    return null;
  }
}

// Exchange that ID token for a long-lived httpOnly session cookie.
export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_COOKIE_MAX_AGE_MS });
}

// Verify a session cookie. checkRevoked=true so a refresh token revoked at
// logout (DELETE /api/auth/session) can no longer authenticate.
export async function verifySessionCookie(cookie: string): Promise<DecodedIdToken | null> {
  try {
    return await adminAuth().verifySessionCookie(cookie, true);
  } catch {
    return null;
  }
}

// Revoke all refresh tokens for a uid — called on logout so a stolen session
// cookie can't outlive the sign-out.
export async function revokeUser(uid: string): Promise<void> {
  try {
    await adminAuth().revokeRefreshTokens(uid);
  } catch {
    // Best-effort — the cookie is cleared regardless.
  }
}

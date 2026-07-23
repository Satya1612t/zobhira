import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Server-only — never import this from a "use client" component. Verifies
// the Firebase ID token API routes receive in their Authorization header,
// so admin access is enforced on the server, not just hidden behind a
// client-side redirect on the login page.
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

export function getAllowedAdminEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verifies the bearer token on a request and confirms the caller's email is
 * on the admin allowlist. Returns the decoded token on success, or a Response
 * to send back immediately (401/403) on failure.
 */
export async function requireAdmin(
  request: Request
): Promise<{ email: string } | Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
    const email = (decoded.email ?? "").toLowerCase();
    if (!email || !getAllowedAdminEmails().includes(email)) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    return { email };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyIdToken,
  verifySessionCookie,
  createSessionCookie,
  revokeUser,
  SESSION_COOKIE_MAX_AGE_MS,
} from "@/lib/firebase-admin";
import { SESSION_COOKIE } from "@/lib/session";

// firebase-admin is Node-only — this route can't run on Edge.
export const runtime = "nodejs";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// POST — client signed in with the Firebase client SDK and hands us the ID
// token once. We verify it, upsert the users row (uid/email from the VERIFIED
// token only, never client input), mint a 14-day session cookie.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const idToken = body && typeof body.idToken === "string" ? body.idToken : null;
  if (!idToken) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });

  const decoded = await verifyIdToken(idToken);
  if (!decoded) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const email = (decoded.email ?? "").toLowerCase();
  if (!email) return NextResponse.json({ error: "No email on token" }, { status: 400 });

  await prisma.user.upsert({
    where: { firebaseUid: decoded.uid },
    update: { lastLoginAt: new Date(), emailVerified: Boolean(decoded.email_verified) },
    create: {
      firebaseUid: decoded.uid,
      email,
      fullName: (decoded.name as string | undefined) ?? null,
      emailVerified: Boolean(decoded.email_verified),
      lastLoginAt: new Date(),
    },
  });

  const sessionCookie = await createSessionCookie(idToken);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionCookie, {
    ...COOKIE_OPTS,
    maxAge: Math.floor(SESSION_COOKIE_MAX_AGE_MS / 1000),
  });
  return res;
}

// DELETE — sign out. Clear the cookie AND revoke the refresh token, or a
// stolen cookie outlives the logout (build spec §3.3).
export async function DELETE(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie) {
    const decoded = await verifySessionCookie(cookie);
    if (decoded) await revokeUser(decoded.uid);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
  return res;
}

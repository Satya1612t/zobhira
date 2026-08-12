import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionCookie } from "@/lib/firebase-admin";

// httpOnly cookie name — distinct from the analytics cookies (zb_vid/zb_sid/
// zb_src) the middleware already sets. Never readable from JS.
export const SESSION_COOKIE = "zb_auth";

export type CurrentUser = {
  id: string;
  email: string;
  firebaseUid: string;
  fullName: string | null;
  emailVerified: boolean;
};

// The single "who is this request" entry point for Server Components and
// protected routes. Reads zb_auth, verifies it with firebase-admin, and
// resolves the users row (creating it on first sign-in). Returns null for a
// missing/invalid/tampered cookie — callers 401 or redirect, never 500.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  const decoded = await verifySessionCookie(cookie);
  if (!decoded) return null;

  const firebaseUid = decoded.uid;
  const email = (decoded.email ?? "").toLowerCase();
  if (!firebaseUid || !email) return null;

  const existing = await prisma.user.findUnique({
    where: { firebaseUid },
    select: { id: true, email: true, firebaseUid: true, fullName: true, emailVerified: true },
  });
  if (existing) return existing;

  // First sign-in for this uid — create the row. The uid/email come only from
  // the verified cookie, never from client input.
  return prisma.user.create({
    data: {
      firebaseUid,
      email,
      fullName: (decoded.name as string | undefined) ?? null,
      emailVerified: Boolean(decoded.email_verified),
      lastLoginAt: new Date(),
    },
    select: { id: true, email: true, firebaseUid: true, fullName: true, emailVerified: true },
  });
}

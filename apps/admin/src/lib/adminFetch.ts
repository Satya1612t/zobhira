"use client";

import { auth } from "@/lib/firebase";

// Thin wrapper around fetch that attaches the signed-in user's Firebase ID
// token as a Bearer header — every admin API route now calls requireAdmin()
// server-side (see lib/firebase-admin.ts) and rejects requests without one.
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const idToken = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (idToken) headers.set("Authorization", `Bearer ${idToken}`);
  return fetch(input, { ...init, headers });
}

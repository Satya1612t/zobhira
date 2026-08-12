"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

// DELETE clears the cookie AND revokes the refresh token server-side; the
// client signOut() clears local Firebase state. Full navigation afterward so
// the now-absent cookie is reflected server-side.
export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  async function handle() {
    setBusy(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(auth).catch(() => {});
    } finally {
      window.location.assign("/");
    }
  }
  return (
    <button type="button" className="btn btn-secondary" onClick={handle} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { deleteUser, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

type AuthState = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  rejectUnauthorizedUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  // Google sign-in itself always succeeds and leaves a Firebase Auth user
  // record behind, even for accounts that aren't on ADMIN_ALLOWED_EMAILS —
  // a plain signOut() would leave that record sitting in the Firebase
  // console forever. deleteUser() actually removes it (allowed since it's
  // the account that JUST signed in, so Firebase's recent-login requirement
  // for delete is already satisfied); signOut is only a fallback for the
  // rare case delete itself fails.
  const rejectUnauthorizedUser = async () => {
    const current = auth.currentUser;
    if (!current) return;
    try {
      await deleteUser(current);
    } catch {
      await signOut(auth);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOutUser, rejectUnauthorizedUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastType = "error" | "success" | "info";
type ToastItem = { id: number; type: ToastType; message: string };

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE: Record<ToastType, { bg: string; fg: string }> = {
  error: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  success: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  info: { bg: "var(--surface-hover)", fg: "var(--ink)" },
};

// One shared toast stack for the whole admin app — every page reaches it
// through useToast() instead of ad-hoc inline <p> error text, so failures
// (bad sign-in, a failed toggle/delete, etc.) all look and behave the same
// way everywhere.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 360,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              background: TONE[t.type].bg,
              color: TONE[t.type].fg,
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              boxShadow: "var(--shadow-raised)",
              animation: "toast-in 0.15s ease",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

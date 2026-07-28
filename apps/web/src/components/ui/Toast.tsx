"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

type ToastVariant = "default" | "success" | "error";
type ToastItem = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<((message: string, variant?: ToastVariant) => void) | null>(null);

const VARIANT_COLOR: Record<ToastVariant, string> = {
  default: "var(--color-ink-900)",
  success: "var(--color-success)",
  error: "var(--color-error)",
};

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 4000;

function ToastItemView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  function start() {
    timerRef.current = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
  }
  function pause() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  return (
    <motion.div
      role="status"
      aria-live="polite"
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] as const }}
      onAnimationComplete={start}
      onHoverStart={pause}
      onHoverEnd={start}
      className="toast-item"
      style={{ borderLeft: `3px solid ${VARIANT_COLOR[toast.variant]}` }}
    >
      {toast.message}
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  // Portal content must not exist on the very first client render — that
  // render is still part of hydration, and inserting a real DOM node there
  // (unlike Modal, whose portal content is empty until a user opens it)
  // trips a hydration mismatch. Deferring to a post-mount effect guarantees
  // the first hydration pass renders nothing, same as the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const showToast = useCallback((message: string, variant: ToastVariant = "default") => {
    const id = idRef.current++;
    setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, variant }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {mounted &&
        createPortal(
          <div className="toast-stack">
            <AnimatePresence>
              {toasts.map((toast) => (
                <ToastItemView key={toast.id} toast={toast} onDismiss={dismiss} />
              ))}
            </AnimatePresence>
          </div>,
          document.getElementById("toast-root") ?? document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

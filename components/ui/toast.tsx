"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

/**
 * Wilson's-branded toast + confirm system.
 *
 *   const { toast, confirm } = useToast();
 *
 *   toast.success("Draft saved");
 *   toast.error("Save failed — try again");
 *   toast.info("Heads up — attachments still pending");
 *
 *   const ok = await confirm({
 *     title: "Submit for approval?",
 *     description: "The client will get a notification.",
 *     confirmLabel: "Submit",
 *   });
 *
 * Toasts slide in at the top of the screen and self-dismiss after 4s.
 * Confirms render a centered modal with brand styling and return a
 * Promise<boolean>.
 */

type Variant = "success" | "error" | "info";

type ToastItem = { id: number; variant: Variant; message: string };

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ToastApi = {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
};

type Ctx = {
  toast: ToastApi;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ToastCtx = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Soft fallback for any tree that hasn't been wrapped yet — keeps the
    // app from crashing during incremental rollout.
    return {
      toast: {
        success: (m) => console.log("[toast/success]", m),
        error: (m) => console.error("[toast/error]", m),
        info: (m) => console.log("[toast/info]", m),
      },
      confirm: async (opts) => window.confirm(opts.description ?? opts.title),
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);
  const idRef = useRef(0);

  const push = useCallback((variant: Variant, message: string) => {
    const id = ++idRef.current;
    setToasts((arr) => [...arr, { id, variant, message }]);
    setTimeout(() => {
      setToasts((arr) => arr.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const toast: ToastApi = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  };

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...opts, resolve });
      }),
    []
  );

  function closeConfirm(value: boolean) {
    confirmState?.resolve(value);
    setConfirmState(null);
  }

  // Esc closes the confirm; Enter accepts.
  useEffect(() => {
    if (!confirmState) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeConfirm(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        closeConfirm(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmState]);

  return (
    <ToastCtx.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast stack — top-center, brand styled */}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <ToastBubble
            key={t.id}
            variant={t.variant}
            message={t.message}
            onClose={() =>
              setToasts((arr) => arr.filter((x) => x.id !== t.id))
            }
          />
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--color-charcoal)]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            // Click outside the panel cancels
            if (e.target === e.currentTarget) closeConfirm(false);
          }}
        >
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
            <h2 className="app-heading text-lg leading-tight text-[var(--color-charcoal)]">
              {confirmState.title}
            </h2>
            {confirmState.description ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-charcoal-500)]">
                {confirmState.description}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => closeConfirm(false)}
              >
                {confirmState.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                type="button"
                variant={confirmState.destructive ? "destructive" : "accent"}
                onClick={() => closeConfirm(true)}
                autoFocus
              >
                {confirmState.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ToastCtx.Provider>
  );
}

function ToastBubble({
  variant,
  message,
  onClose,
}: {
  variant: Variant;
  message: string;
  onClose: () => void;
}) {
  const styles: Record<Variant, string> = {
    success:
      "border-[var(--color-forest)]/30 bg-[var(--color-forest)] text-[var(--color-virgil)]",
    error:
      "border-[var(--color-raspberry)]/30 bg-[var(--color-raspberry)] text-white",
    info:
      "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-charcoal)]",
  };
  const Icon =
    variant === "success" ? Check : variant === "error" ? AlertCircle : Info;

  return (
    <div
      className={cn(
        "pointer-events-auto flex min-w-[260px] max-w-[440px] items-start gap-2 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-sm font-medium shadow-[var(--shadow-card)] animate-in fade-in slide-in-from-top-2 duration-200",
        styles[variant]
      )}
      role="status"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1 leading-snug">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 opacity-70 transition hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

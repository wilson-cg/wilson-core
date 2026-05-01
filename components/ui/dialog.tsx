"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal, dependency-free dialog. Wraps the native <dialog> element so we
 * get accessible focus-trapping, ESC-to-close, and backdrop-dismiss for
 * free. No new packages.
 *
 * Usage:
 *   <Dialog open={open} onClose={() => setOpen(false)} title="Members">
 *     ...content...
 *   </Dialog>
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    function handleClose() {
      onClose();
    }
    function handleClick(e: MouseEvent) {
      if (e.target === dlg) {
        // Click on the dialog element itself (the backdrop, since children
        // sit inside an inner wrapper) — dismiss.
        onClose();
      }
    }
    dlg.addEventListener("close", handleClose);
    dlg.addEventListener("click", handleClick);
    return () => {
      dlg.removeEventListener("close", handleClose);
      dlg.removeEventListener("click", handleClick);
    };
  }, [onClose]);

  const widthClass = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
  }[size];

  return (
    <dialog
      ref={ref}
      className={cn(
        "m-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-0 shadow-[var(--shadow-lifted)] backdrop:bg-[var(--color-charcoal)]/40 backdrop:backdrop-blur-sm",
        widthClass,
        "w-full"
      )}
    >
      {/* Inner wrapper so backdrop click vs content click can be distinguished */}
      <div className={cn("flex max-h-[85vh] flex-col", className)}>
        {(title || description) && (
          <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
            <div className="min-w-0">
              {title ? (
                <h2 className="app-heading text-lg text-[var(--color-charcoal)]">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-md p-1 text-[var(--color-charcoal-300)] hover:bg-[var(--color-virgil)] hover:text-[var(--color-charcoal)]"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}

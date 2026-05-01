"use client";

import { useOptimistic, useTransition } from "react";
import { setApproverDecision } from "@/lib/actions";

type Decision = "PENDING" | "APPROVED" | "DECLINED";

const OPTIONS: { value: Decision; label: string; tone: string }[] = [
  {
    value: "PENDING",
    label: "Pending",
    tone: "border-[var(--color-border)] bg-[var(--color-virgil)] text-[var(--color-charcoal-500)]",
  },
  {
    value: "APPROVED",
    label: "Approved",
    tone: "border-[var(--color-forest)] bg-[var(--color-lime)]/40 text-[var(--color-forest-950)]",
  },
  {
    value: "DECLINED",
    label: "Declined",
    tone: "border-[var(--color-raspberry)] bg-[var(--color-raspberry)]/15 text-[var(--color-raspberry)]",
  },
];

export function DecisionRadio({
  prospectId,
  initial,
}: {
  prospectId: string;
  initial: Decision;
}) {
  const [optimistic, setOptimistic] = useOptimistic(initial);
  const [, startTransition] = useTransition();

  function pick(value: Decision) {
    if (value === optimistic) return;
    startTransition(() => {
      setOptimistic(value);
      const fd = new FormData();
      fd.set("prospectId", prospectId);
      fd.set("decision", value);
      setApproverDecision(fd).catch((err) =>
        console.error("Decision write failed", err)
      );
    });
  }

  return (
    <section className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        Approver decision
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map((o) => {
          const active = o.value === optimistic;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              className={`rounded-[var(--radius-sm)] border px-2 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? o.tone
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-charcoal-500)] hover:border-[var(--color-border-strong)]"
              }`}
              aria-pressed={active}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

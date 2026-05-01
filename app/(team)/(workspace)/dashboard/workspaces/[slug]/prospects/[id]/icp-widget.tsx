"use client";

import { useOptimistic, useTransition } from "react";
import { setIcpField } from "@/lib/actions";
import { Check } from "lucide-react";

type Field =
  | "icpCompanyFit"
  | "icpSeniorityFit"
  | "icpContextFit"
  | "icpGeographyFit";

type Props = {
  prospectId: string;
  icpCompanyFit: boolean;
  icpSeniorityFit: boolean;
  icpContextFit: boolean;
  icpGeographyFit: boolean;
};

const FIELDS: { key: Field; label: string }[] = [
  { key: "icpCompanyFit", label: "Company" },
  { key: "icpSeniorityFit", label: "Seniority" },
  { key: "icpContextFit", label: "Context" },
  { key: "icpGeographyFit", label: "Geography" },
];

/**
 * 4 ICP-fit toggles with a live X/4 score badge. Each click is optimistic
 * and writes a ProspectEvent server-side.
 */
export function IcpWidget(props: Props) {
  const initial = {
    icpCompanyFit: props.icpCompanyFit,
    icpSeniorityFit: props.icpSeniorityFit,
    icpContextFit: props.icpContextFit,
    icpGeographyFit: props.icpGeographyFit,
  };
  const [optimistic, applyOptimistic] = useOptimistic(
    initial,
    (state, change: { field: Field; value: boolean }) => ({
      ...state,
      [change.field]: change.value,
    })
  );
  const [, startTransition] = useTransition();

  const score =
    (optimistic.icpCompanyFit ? 1 : 0) +
    (optimistic.icpSeniorityFit ? 1 : 0) +
    (optimistic.icpContextFit ? 1 : 0) +
    (optimistic.icpGeographyFit ? 1 : 0);

  function toggle(field: Field) {
    const next = !optimistic[field];
    startTransition(() => {
      applyOptimistic({ field, value: next });
      const fd = new FormData();
      fd.set("prospectId", props.prospectId);
      fd.set("field", field);
      fd.set("value", next ? "true" : "false");
      setIcpField(fd).catch((err) => console.error("ICP toggle failed", err));
    });
  }

  return (
    <section className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          ICP fit
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            score >= 4
              ? "bg-[var(--color-lime)] text-[var(--color-forest-950)]"
              : score >= 2
                ? "bg-[var(--color-bee)]/40 text-[var(--color-charcoal)]"
                : "bg-[var(--color-raspberry)]/20 text-[var(--color-raspberry)]"
          }`}
        >
          {score}/4
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {FIELDS.map((f) => {
          const on = optimistic[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => toggle(f.key)}
              className={`flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-xs transition-colors ${
                on
                  ? "border-[var(--color-forest)] bg-[var(--color-forest)]/10 text-[var(--color-forest)]"
                  : "border-[var(--color-border)] bg-[var(--color-virgil)] text-[var(--color-charcoal-500)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              <span>{f.label}</span>
              {on ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

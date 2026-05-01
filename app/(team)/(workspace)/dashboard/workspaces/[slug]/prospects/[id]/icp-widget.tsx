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
  /** When false, the toggles + ring render read-only. */
  canEdit?: boolean;
};

const FIELDS: { key: Field; label: string }[] = [
  { key: "icpCompanyFit", label: "Company" },
  { key: "icpSeniorityFit", label: "Seniority" },
  { key: "icpContextFit", label: "Context" },
  { key: "icpGeographyFit", label: "Geography" },
];

/**
 * ICP fit widget — V1 UX overhaul.
 *
 * Big 64px score ring on the LEFT (4-segment SVG, segments filled = score)
 * with the toggles to the right. Each click is optimistic and writes a
 * ProspectEvent server-side. Read-only when `canEdit === false`.
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

  const editable = props.canEdit !== false;

  function toggle(field: Field) {
    if (!editable) return;
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
    <section className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-4">
        <ScoreRing score={score} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            ICP fit
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-charcoal-500)]">
            Toggle each criterion. The score updates as you go.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {FIELDS.map((f) => {
              const on = optimistic[f.key];
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggle(f.key)}
                  disabled={!editable}
                  className={`flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-xs transition-colors ${
                    on
                      ? "border-[var(--color-forest)] bg-[var(--color-forest)]/10 text-[var(--color-forest)]"
                      : "border-[var(--color-border)] bg-[var(--color-virgil)] text-[var(--color-charcoal-500)] hover:border-[var(--color-border-strong)]"
                  } ${!editable ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <span>{f.label}</span>
                  {on ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 64px score ring. Renders 4 SVG arc segments — `score` of them filled
 * (forest), the rest empty (virgil-dark stroke). The score number sits in
 * the middle.
 */
function ScoreRing({ score }: { score: number }) {
  // 4 arcs of 90deg each, with a small gap. Stroke center radius 28, total
  // size 64. For each segment compute the dasharray endpoints.
  const size = 64;
  const cx = size / 2;
  const cy = size / 2;
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const segLen = circumference / 4;
  const gap = 2; // visual gap between segments

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`ICP score ${score} out of 4`}
    >
      {/* Each segment is its own circle with a dasharray that draws only
          its own quarter, rotated by index*90deg. This gives clean gaps
          between filled and unfilled arcs. */}
      {[0, 1, 2, 3].map((i) => {
        const filled = i < score;
        const dashArray = `${segLen - gap} ${circumference - (segLen - gap)}`;
        const rotate = i * 90 - 90; // start at top
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={filled ? "var(--color-forest)" : "var(--color-virgil-dark)"}
            strokeWidth={filled ? 5 : 4}
            strokeDasharray={dashArray}
            strokeLinecap="round"
            transform={`rotate(${rotate} ${cx} ${cy})`}
          />
        );
      })}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="18"
        fontWeight="700"
        fill="var(--color-charcoal)"
        fontFamily="var(--font-sans)"
      >
        {score}/4
      </text>
    </svg>
  );
}

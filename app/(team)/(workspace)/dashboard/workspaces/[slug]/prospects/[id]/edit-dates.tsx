"use client";

import { useRef } from "react";
import { updateProspectContactDates } from "@/lib/actions";

/**
 * Two inline date pickers — LinkedIn connection date + last contacted date.
 * Auto-submits via the containing form when either value changes.
 */
export function EditDatesIsland({
  prospectId,
  linkedinConnectedAt,
  lastContactedAt,
}: {
  prospectId: string;
  linkedinConnectedAt: string | null; // yyyy-mm-dd
  lastContactedAt: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={updateProspectContactDates}
      className="contents"
    >
      <input type="hidden" name="prospectId" value={prospectId} />
      <FieldRow label="Connected on LinkedIn">
        <input
          type="date"
          name="linkedinConnectedAt"
          defaultValue={linkedinConnectedAt ?? ""}
          onChange={() => formRef.current?.requestSubmit()}
          className="w-full bg-transparent text-right text-xs text-[var(--color-charcoal)] outline-none focus:text-[var(--color-forest)]"
        />
      </FieldRow>
      <FieldRow label="Last contacted">
        <input
          type="date"
          name="lastContactedAt"
          defaultValue={lastContactedAt ?? ""}
          onChange={() => formRef.current?.requestSubmit()}
          className="w-full bg-transparent text-right text-xs text-[var(--color-charcoal)] outline-none focus:text-[var(--color-forest)]"
        />
      </FieldRow>
    </form>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-3 py-2 first:border-t-0">
      <span className="text-[11px] text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <div className="min-w-0 flex-1 max-w-[55%]">{children}</div>
    </div>
  );
}

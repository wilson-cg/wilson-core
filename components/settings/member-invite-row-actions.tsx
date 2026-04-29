"use client";

import { useTransition } from "react";
import { revokeInvite, resendInvite } from "@/lib/invites";

export function MemberInviteRowActions({ inviteId }: { inviteId: string }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex shrink-0 items-center gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => resendInvite(inviteId))}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-medium text-[var(--color-charcoal)] hover:border-[var(--color-forest)] hover:text-[var(--color-forest)] disabled:opacity-50"
      >
        Resend
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Revoke this invite?")) return;
          start(() => revokeInvite(inviteId));
        }}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-medium text-[var(--color-raspberry)] hover:border-[var(--color-raspberry)] disabled:opacity-50"
      >
        Revoke
      </button>
    </div>
  );
}

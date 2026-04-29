"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { inviteToWorkspace } from "@/lib/invites";

type State = { error?: string; success?: boolean };

export function InviteMemberForm({ workspaceSlug }: { workspaceSlug: string }) {
  async function submit(_prev: State, formData: FormData): Promise<State> {
    try {
      await inviteToWorkspace({
        workspaceSlug,
        email: String(formData.get("email") ?? ""),
        workspaceRole: String(formData.get("workspaceRole") ?? "CLIENT") as
          | "ADMIN"
          | "TEAM_MEMBER"
          | "CLIENT",
      });
      return { success: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not invite." };
    }
  }

  const [state, action, pending] = useActionState<State, FormData>(submit, {});

  return (
    <form action={action} className="space-y-3" noValidate>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_140px]">
        <input
          type="email"
          name="email"
          required
          placeholder="client@company.com"
          autoComplete="off"
          className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm shadow-[var(--shadow-soft)] outline-none focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20"
        />
        <select
          name="workspaceRole"
          defaultValue="CLIENT"
          className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm shadow-[var(--shadow-soft)] outline-none focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20"
        >
          <option value="CLIENT">Client</option>
          <option value="TEAM_MEMBER">Team member</option>
          <option value="ADMIN">Admin</option>
        </select>
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={pending}
        >
          <Send className="h-4 w-4" />
          {pending ? "Sending…" : "Invite"}
        </Button>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] border border-[var(--color-raspberry)]/30 bg-[var(--color-raspberry)]/5 px-3 py-2 text-xs text-[var(--color-raspberry)]"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-[var(--radius-sm)] border border-[var(--color-forest)]/30 bg-[var(--color-forest)]/5 px-3 py-2 text-xs text-[var(--color-forest)]">
          Invite sent.
        </p>
      ) : null}
    </form>
  );
}

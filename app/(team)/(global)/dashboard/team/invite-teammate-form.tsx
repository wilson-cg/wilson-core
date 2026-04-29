"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { createInvite } from "@/lib/invites";
import { Send } from "lucide-react";

type SystemRole = "ADMIN" | "TEAM_MEMBER";
type WorkspaceRole = "ADMIN" | "TEAM_MEMBER" | "CLIENT";

type WorkspaceOption = { id: string; name: string; slug: string };

type State = { error?: string; success?: boolean };

async function submit(_prev: State, formData: FormData): Promise<State> {
  try {
    const email = String(formData.get("email") ?? "");
    const systemRole = String(formData.get("systemRole") ?? "TEAM_MEMBER") as SystemRole;

    // Build workspaceAccesses from per-workspace checkbox + role select pairs.
    // Only include for TEAM_MEMBER invites — ADMIN already has implicit
    // access to every workspace, so the picker is irrelevant.
    const workspaceAccesses: { workspaceId: string; workspaceRole: WorkspaceRole }[] = [];
    if (systemRole === "TEAM_MEMBER") {
      // FormData entries() preserves insertion order, but we don't rely on
      // that — we look up checked workspaces by their checkbox name prefix.
      const ids = formData.getAll("workspaceAccessId").map((v) => String(v));
      for (const workspaceId of ids) {
        const role = String(
          formData.get(`workspaceAccessRole_${workspaceId}`) ?? "EDITOR",
        ) as WorkspaceRole;
        workspaceAccesses.push({ workspaceId, workspaceRole: role });
      }
    }

    await createInvite({
      email,
      systemRole,
      workspaceAccesses: workspaceAccesses.length ? workspaceAccesses : undefined,
    });
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not invite." };
  }
}

export function InviteTeammateForm({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const [state, action, pending] = useActionState<State, FormData>(submit, {});
  const [systemRole, setSystemRole] = useState<SystemRole>("TEAM_MEMBER");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_140px]">
        <input
          type="email"
          name="email"
          required
          placeholder="teammate@wilsons.com"
          autoComplete="off"
          className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm shadow-[var(--shadow-soft)] outline-none focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20"
        />
        <select
          name="systemRole"
          value={systemRole}
          onChange={(e) => setSystemRole(e.target.value as SystemRole)}
          className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm shadow-[var(--shadow-soft)] outline-none focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20"
        >
          <option value="ADMIN">ADMIN</option>
          <option value="TEAM_MEMBER">TEAM_MEMBER</option>
        </select>
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={pending}
        >
          <Send className="h-4 w-4" />
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>

      {systemRole === "TEAM_MEMBER" ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-virgil-dark)]/20 p-4">
          <p className="text-xs font-medium text-[var(--color-charcoal)]">
            Client access
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            Choose which clients this teammate can access. Skip if they only
            need to be added later.
          </p>
          {workspaces.length === 0 ? (
            <p className="mt-3 text-xs italic text-[var(--color-muted-foreground)]">
              No clients yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {workspaces.map((ws) => {
                const isChecked = !!checked[ws.id];
                return (
                  <li
                    key={ws.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <label className="flex flex-1 items-center gap-2 text-sm text-[var(--color-charcoal)]">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(ws.id)}
                        className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-forest)] focus:ring-[var(--color-forest)]/20"
                      />
                      {/* Carry the workspaceId in form data only when checked. */}
                      {isChecked ? (
                        <input
                          type="hidden"
                          name="workspaceAccessId"
                          value={ws.id}
                        />
                      ) : null}
                      <span>{ws.name}</span>
                    </label>
                    <select
                      name={`workspaceAccessRole_${ws.id}`}
                      defaultValue="TEAM_MEMBER"
                      disabled={!isChecked}
                      className="w-[140px] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs shadow-[var(--shadow-soft)] outline-none disabled:opacity-50 focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="TEAM_MEMBER">Team member</option>
                      <option value="CLIENT">Client</option>
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

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

"use client";

import { useState, useTransition } from "react";
import { Users, Lock } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  inviteToWorkspace,
  updateMembershipPermissions,
  removeMembership,
} from "@/lib/invites";

/**
 * Workspace Members modal.
 *
 * Tabs: Invite / Members / Permissions / Notifications. Invite + Permissions
 * + member-remove require canAdmin (passed in via `viewerCanAdmin`).
 *
 * Permissions matrix columns: View (locked-on) / Approve / Edit / Send /
 * Admin. View is implicit on every Membership and not editable. Toggling
 * any other column fires updateMembershipPermissions immediately.
 */

export type MemberRow = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  systemRole: "ADMIN" | "TEAM_MEMBER" | "CLIENT";
  workspaceRole: "ADMIN" | "TEAM_MEMBER" | "CLIENT";
  canApprove: boolean;
  canEdit: boolean;
  canSend: boolean;
  canAdmin: boolean;
  notifyOnApprovalRequested: boolean;
};

type Tab = "invite" | "members" | "permissions" | "notifications";

export function MembersModal({
  open,
  onClose,
  workspaceSlug,
  viewerCanAdmin,
  members,
}: {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  viewerCanAdmin: boolean;
  members: MemberRow[];
}) {
  const [tab, setTab] = useState<Tab>(viewerCanAdmin ? "invite" : "members");

  return (
    <Dialog open={open} onClose={onClose} title="Members" size="lg">
      <div className="flex border-b border-[var(--color-border)] bg-[var(--color-virgil)] px-5">
        {(
          [
            ["invite", "Invite", viewerCanAdmin],
            ["members", "Members", true],
            ["permissions", "Permissions", viewerCanAdmin],
            ["notifications", "Notifications", true],
          ] as [Tab, string, boolean][]
        )
          .filter(([, , show]) => show)
          .map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === key
                  ? "text-[var(--color-forest)]"
                  : "text-[var(--color-charcoal-300)] hover:text-[var(--color-charcoal)]"
              }`}
            >
              {label}
              {tab === key ? (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-t bg-[var(--color-forest)]" />
              ) : null}
            </button>
          ))}
      </div>

      <div className="p-5">
        {tab === "invite" ? (
          <InviteTab workspaceSlug={workspaceSlug} />
        ) : tab === "members" ? (
          <MembersTab members={members} viewerCanAdmin={viewerCanAdmin} />
        ) : tab === "permissions" ? (
          <PermissionsTab members={members} />
        ) : (
          <NotificationsTab members={members} viewerCanAdmin={viewerCanAdmin} />
        )}
      </div>
    </Dialog>
  );
}

/* ─── Invite tab ────────────────────────────────────────────── */

const PRESET_FLAGS = {
  client: { canApprove: true, canEdit: false, canSend: false, canAdmin: false },
  team: { canApprove: true, canEdit: true, canSend: true, canAdmin: true },
  custom: null,
} as const;

function InviteTab({ workspaceSlug }: { workspaceSlug: string }) {
  const [email, setEmail] = useState("");
  const [systemRole, setSystemRole] = useState<"CLIENT" | "TEAM_MEMBER">(
    "CLIENT"
  );
  const [preset, setPreset] = useState<"client" | "team" | "custom">("client");
  const [flags, setFlags] = useState({
    canApprove: true,
    canEdit: false,
    canSend: false,
    canAdmin: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applyPreset(next: "client" | "team" | "custom") {
    setPreset(next);
    if (next !== "custom") {
      setFlags(PRESET_FLAGS[next]!);
    }
  }

  function submit() {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      try {
        const flagsToSend = preset === "custom" ? flags : PRESET_FLAGS[preset]!;
        await inviteToWorkspace({
          workspaceSlug,
          email,
          // workspaceRole maps to the systemRole — keeps the legacy column in sync.
          workspaceRole: systemRole,
          systemRole,
          permissions: flagsToSend,
        });
        setOkMsg(`Invite sent to ${email}.`);
        setEmail("");
      } catch (err) {
        setError((err as Error).message ?? "Failed to send invite.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          aria-label="Email"
        />
        <select
          value={systemRole}
          onChange={(e) => {
            const v = e.target.value as "CLIENT" | "TEAM_MEMBER";
            setSystemRole(v);
            applyPreset(v === "CLIENT" ? "client" : "team");
          }}
          className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm"
        >
          <option value="CLIENT">Client user</option>
          <option value="TEAM_MEMBER">Team member</option>
        </select>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Permission preset
        </div>
        <div className="flex gap-2">
          {(["client", "team", "custom"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium ${
                preset === p
                  ? "border-[var(--color-forest)] bg-[var(--color-forest)]/10 text-[var(--color-forest)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-charcoal-500)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              {p === "client" ? "Client (view + approve)" : p === "team" ? "Team (full access)" : "Custom"}
            </button>
          ))}
        </div>
      </div>

      {preset === "custom" ? (
        <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-virgil)] p-3">
          <FlagCheckbox
            label="Approve"
            on={flags.canApprove}
            onChange={(v) => setFlags({ ...flags, canApprove: v })}
          />
          <FlagCheckbox
            label="Edit"
            on={flags.canEdit}
            onChange={(v) => setFlags({ ...flags, canEdit: v })}
          />
          <FlagCheckbox
            label="Send"
            on={flags.canSend}
            onChange={(v) => setFlags({ ...flags, canSend: v })}
          />
          <FlagCheckbox
            label="Admin"
            on={flags.canAdmin}
            onChange={(v) => setFlags({ ...flags, canAdmin: v })}
          />
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-[var(--color-raspberry)]">{error}</p>
      ) : null}
      {okMsg ? (
        <p className="text-xs text-[var(--color-forest)]">{okMsg}</p>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={pending || !email}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </div>
  );
}

function FlagCheckbox({
  label,
  on,
  onChange,
  locked = false,
}: {
  label: string;
  on: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-xs ${
        locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={on}
        disabled={locked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-[var(--color-border-strong)] accent-[var(--color-forest)]"
      />
      <span className="text-[var(--color-charcoal-500)]">{label}</span>
      {locked ? <Lock className="h-3 w-3 text-[var(--color-charcoal-300)]" /> : null}
    </label>
  );
}

/* ─── Members tab ───────────────────────────────────────────── */

function MembersTab({
  members,
  viewerCanAdmin,
}: {
  members: MemberRow[];
  viewerCanAdmin: boolean;
}) {
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
      {members.map((m) => (
        <MemberRowItem
          key={m.membershipId}
          member={m}
          viewerCanAdmin={viewerCanAdmin}
        />
      ))}
    </ul>
  );
}

function MemberRowItem({
  member,
  viewerCanAdmin,
}: {
  member: MemberRow;
  viewerCanAdmin: boolean;
}) {
  const [removing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`Remove ${member.name} from this workspace?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeMembership(member.membershipId);
      } catch (err) {
        setError((err as Error).message ?? "Failed to remove.");
      }
    });
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-forest)] text-[10px] font-semibold text-[var(--color-lime)]">
        {member.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.image}
            alt={member.name}
            className="h-full w-full object-cover"
          />
        ) : (
          initials(member.name)
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-[var(--color-charcoal)]">
          {member.name}
        </div>
        <div className="truncate text-xs text-[var(--color-muted-foreground)]">
          {member.email}
        </div>
        {error ? (
          <div className="text-[11px] text-[var(--color-raspberry)]">{error}</div>
        ) : null}
      </div>
      <span className="rounded-full bg-[var(--color-virgil-dark)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-charcoal-500)]">
        {member.systemRole === "CLIENT" ? "Client" : "Team"}
      </span>
      {viewerCanAdmin ? (
        <button
          type="button"
          onClick={remove}
          disabled={removing}
          className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-raspberry)] hover:bg-[var(--color-raspberry)]/10"
        >
          {removing ? "…" : "Remove"}
        </button>
      ) : null}
    </li>
  );
}

/* ─── Permissions matrix tab ─────────────────────────────────── */

function PermissionsTab({ members }: { members: MemberRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-virgil)] text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            <th className="px-3 py-2 text-left">Member</th>
            <th className="px-2 py-2 text-center">View</th>
            <th className="px-2 py-2 text-center">Approve</th>
            <th className="px-2 py-2 text-center">Edit</th>
            <th className="px-2 py-2 text-center">Send</th>
            <th className="px-2 py-2 text-center">Admin</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <PermissionsRow key={m.membershipId} member={m} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PermissionsRow({ member }: { member: MemberRow }) {
  // Local optimistic state — the matrix flips immediately on click and the
  // server action revalidates the page underneath us.
  const [flags, setFlags] = useState({
    canApprove: member.canApprove,
    canEdit: member.canEdit,
    canSend: member.canSend,
    canAdmin: member.canAdmin,
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(field: keyof typeof flags) {
    const next = { ...flags, [field]: !flags[field] };
    setFlags(next);
    setError(null);
    startTransition(async () => {
      try {
        await updateMembershipPermissions({
          membershipId: member.membershipId,
          [field]: next[field],
        });
      } catch (err) {
        // Rollback on failure
        setFlags(flags);
        setError((err as Error).message ?? "Update failed.");
      }
    });
  }

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="px-3 py-2">
        <div className="font-medium text-[var(--color-charcoal)]">
          {member.name}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted-foreground)]">
          <span className="rounded-full bg-[var(--color-virgil-dark)] px-1.5 py-px font-semibold text-[var(--color-charcoal-500)]">
            {member.systemRole === "CLIENT" ? "Client" : "Team"}
          </span>
          {pending ? <span>saving…</span> : null}
          {error ? (
            <span className="text-[var(--color-raspberry)]">{error}</span>
          ) : null}
        </div>
      </td>
      <td className="px-2 py-2 text-center">
        <Lock className="mx-auto h-3.5 w-3.5 text-[var(--color-charcoal-300)]" />
      </td>
      <td className="px-2 py-2 text-center">
        <Cell on={flags.canApprove} onClick={() => toggle("canApprove")} />
      </td>
      <td className="px-2 py-2 text-center">
        <Cell on={flags.canEdit} onClick={() => toggle("canEdit")} />
      </td>
      <td className="px-2 py-2 text-center">
        <Cell on={flags.canSend} onClick={() => toggle("canSend")} />
      </td>
      <td className="px-2 py-2 text-center">
        <Cell on={flags.canAdmin} onClick={() => toggle("canAdmin")} />
      </td>
    </tr>
  );
}

function Cell({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`mx-auto inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${
        on
          ? "border-[var(--color-forest)] bg-[var(--color-forest)] text-[var(--color-lime)]"
          : "border-[var(--color-border-strong)] bg-[var(--color-surface)]"
      }`}
    >
      {on ? "✓" : ""}
    </button>
  );
}

/* ─── Notifications tab ─────────────────────────────────────── */

function NotificationsTab({
  members,
  viewerCanAdmin,
}: {
  members: MemberRow[];
  viewerCanAdmin: boolean;
}) {
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
      {members.map((m) => (
        <NotifRow
          key={m.membershipId}
          member={m}
          viewerCanAdmin={viewerCanAdmin}
        />
      ))}
    </ul>
  );
}

function NotifRow({
  member,
  viewerCanAdmin,
}: {
  member: MemberRow;
  viewerCanAdmin: boolean;
}) {
  const [on, setOn] = useState(member.notifyOnApprovalRequested);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!viewerCanAdmin) return;
    const next = !on;
    setOn(next);
    startTransition(async () => {
      try {
        await updateMembershipPermissions({
          membershipId: member.membershipId,
          notifyOnApprovalRequested: next,
        });
      } catch {
        setOn(!next);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
      <Users className="h-3.5 w-3.5 text-[var(--color-charcoal-300)]" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-[var(--color-charcoal)]">
          {member.name}
        </div>
        <div className="truncate text-[11px] text-[var(--color-muted-foreground)]">
          Email me when prospects need approval
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={!viewerCanAdmin || pending}
        aria-pressed={on}
        className={`relative h-5 w-9 rounded-full border transition-colors ${
          on
            ? "border-[var(--color-forest)] bg-[var(--color-forest)]"
            : "border-[var(--color-border-strong)] bg-[var(--color-virgil-dark)]"
        } ${!viewerCanAdmin ? "opacity-60" : ""}`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-[var(--color-surface)] transition-transform ${
            on ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </li>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

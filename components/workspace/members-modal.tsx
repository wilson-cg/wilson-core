"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Copy,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Send,
  User as UserIcon,
  UserPlus,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  inviteToWorkspace,
  createInviteLink,
  removeMembership,
  resendInvite,
  revokeInvite,
  searchExistingUsers,
  updateMembershipNotifications,
  updateMembershipPermissions,
} from "@/lib/invites";
import {
  derivePermissionLabel,
  permissionPreset,
  defaultNotificationFlags,
  type PermissionPresetName,
} from "@/lib/permissions";

/**
 * Workspace Members modal — Plannable-style restructure (Plan #1).
 *
 * Tabs:
 *   1. Invite — autocomplete email + permission preset + Membership type
 *   2. Members — unified list of accepted memberships + pending invites
 *   3. Permissions — 5-column matrix (View / Approve / Edit / Send / Admin)
 *   4. Notifications — 4-column matrix (New prospect / Needs approval /
 *      Status / Comment) — admin edits anyone, self-edits own row
 *
 * Entry points:
 *   - "+ Share" button (top bar, admin-only) -> defaultTab="invite"
 *   - Members button (workspace switcher dropdown) -> defaultTab="members"
 */

export type MemberRow = {
  kind: "member";
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  systemRole: "ADMIN" | "TEAM_MEMBER" | "CLIENT";
  workspaceRole: "ADMIN" | "TEAM_MEMBER" | "CLIENT";
  isWorkspaceOwner: boolean;
  canApprove: boolean;
  canEdit: boolean;
  canSend: boolean;
  canAdmin: boolean;
  notifyOnApprovalRequested: boolean;
  notifyOnNewProspect: boolean;
  notifyOnStatusChange: boolean;
  notifyOnComment: boolean;
  createdAt: Date;
};

export type PendingInviteRow = {
  kind: "invite";
  inviteId: string;
  email: string;
  systemRole: "ADMIN" | "TEAM_MEMBER" | "CLIENT";
  workspaceRole: "ADMIN" | "TEAM_MEMBER" | "CLIENT" | null;
  canApprove: boolean;
  canEdit: boolean;
  canSend: boolean;
  canAdmin: boolean;
  notifyOnApprovalRequested: boolean;
  notifyOnNewProspect: boolean;
  notifyOnStatusChange: boolean;
  notifyOnComment: boolean;
  createdAt: Date;
  expiresAt: Date;
};

export type ModalMembers = {
  members: MemberRow[];
  pending: PendingInviteRow[];
};

type Tab = "invite" | "members" | "permissions" | "notifications";

export function MembersModal({
  open,
  defaultTab,
  onClose,
  workspaceSlug,
  viewerCanAdmin,
  members,
}: {
  open: boolean;
  defaultTab?: Tab;
  onClose: () => void;
  workspaceSlug: string;
  viewerCanAdmin: boolean;
  members: ModalMembers;
}) {
  const initialTab: Tab = defaultTab ?? (viewerCanAdmin ? "invite" : "members");
  const [tab, setTab] = useState<Tab>(initialTab);

  // When the modal is reopened with a different defaultTab (e.g. user clicks
  // Share after just closing the modal), honor the new tab.
  useEffect(() => {
    if (open) setTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTab]);

  return (
    <Dialog open={open} onClose={onClose} title="Members" size="lg">
      <div className="flex border-b border-[var(--color-border)] bg-[var(--color-virgil)] px-5">
        {(
          [
            ["invite", "Invite", viewerCanAdmin],
            ["members", "Members", true],
            ["permissions", "Permissions", true],
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

      <div className="max-h-[70vh] overflow-y-auto p-5">
        {tab === "invite" && viewerCanAdmin ? (
          <InviteTab
            workspaceSlug={workspaceSlug}
            members={members.members}
            onSwitchToPermissions={() => setTab("permissions")}
          />
        ) : tab === "members" ? (
          <MembersTab
            members={members}
            viewerCanAdmin={viewerCanAdmin}
            onSwitchToPermissions={() => setTab("permissions")}
          />
        ) : tab === "permissions" ? (
          <PermissionsTab
            members={members.members}
            viewerCanAdmin={viewerCanAdmin}
          />
        ) : (
          <NotificationsTab members={members.members} />
        )}
      </div>

      <div className="border-t border-[var(--color-border)] bg-[var(--color-virgil)] px-5 py-2 text-[10px] text-[var(--color-muted-foreground)]">
        Email delivery for new-prospect, status, and comment notifications
        ships in the next release.
      </div>
    </Dialog>
  );
}

/* ─── Invite tab ────────────────────────────────────────────── */

const PRESETS: PermissionPresetName[] = [
  "Approver",
  "Contributor",
  "Sender",
  "Administrator",
  "Custom",
];

function InviteTab({
  workspaceSlug,
  members,
  onSwitchToPermissions,
}: {
  workspaceSlug: string;
  members: MemberRow[];
  onSwitchToPermissions: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<PermissionPresetName>("Approver");
  const [membershipKind, setMembershipKind] = useState<"CLIENT" | "TEAM_MEMBER">(
    "CLIENT"
  );
  const [pending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<
    Array<{
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      alreadyInWorkspace: boolean;
    }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const alreadyAMember = members.some(
    (m) => m.email.toLowerCase() === email.trim().toLowerCase()
  );

  function runSearch(q: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchExistingUsers({
          workspaceSlug,
          query: q,
        });
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        // Silent — search failure shouldn't block the form.
      }
    }, 200);
  }

  function onEmailChange(v: string) {
    setEmail(v);
    if (v.trim().length >= 2) runSearch(v.trim());
    else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function pickSuggestion(s: (typeof suggestions)[number]) {
    if (s.alreadyInWorkspace) return;
    setEmail(s.email);
    if (s.name) setName(s.name);
    setShowSuggestions(false);
  }

  async function submit(opts: { sendEmail: boolean }) {
    if (!emailValid || alreadyAMember) return;
    const flags = permissionPreset(preset);
    if (preset === "Custom") {
      // Custom flips users to the Permissions tab — they tick what they
      // want and use the per-row checkbox actions there. The invite isn't
      // submitted from this button in Custom mode.
      onSwitchToPermissions();
      return;
    }
    if (!flags) return;

    const notifications = defaultNotificationFlags({
      preset,
      systemRole: membershipKind,
    });

    startTransition(async () => {
      try {
        if (opts.sendEmail) {
          await inviteToWorkspace({
            workspaceSlug,
            email: email.trim(),
            workspaceRole: membershipKind,
            systemRole: membershipKind,
            permissions: flags,
            notifications,
            sendEmail: true,
          });
          toast.success(`Invite emailed to ${email.trim()}.`);
        } else {
          const url = await createInviteLink({
            workspaceSlug,
            email: email.trim(),
            workspaceRole: membershipKind,
            systemRole: membershipKind,
            permissions: flags,
            notifications,
          });
          try {
            await navigator.clipboard.writeText(url);
            toast.success("Invite link copied to clipboard.");
          } catch {
            toast.info(`Invite link: ${url}`);
          }
        }
        setEmail("");
        setName("");
      } catch (err) {
        toast.error((err as Error).message ?? "Couldn't create invite.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest)] text-sm font-semibold text-[var(--color-lime)]">
          {name.trim() ? initials(name) : <UserIcon className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Invite to workspace
          </div>
          <div className="truncate text-sm text-[var(--color-charcoal-500)]">
            {email.trim() || "Type or search an email"}
          </div>
        </div>
      </div>

      <div className="relative">
        <label className="mb-1 block text-xs font-medium text-[var(--color-charcoal-500)]">
          Email
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Type or search email"
          aria-label="Email"
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lifted)]">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pickSuggestion(s)}
                  disabled={s.alreadyInWorkspace}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    s.alreadyInWorkspace
                      ? "cursor-not-allowed opacity-60"
                      : "hover:bg-[var(--color-virgil)]"
                  }`}
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest)] text-[9px] font-semibold text-[var(--color-lime)]">
                    {initials(s.name ?? s.email)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-[var(--color-charcoal)]">
                      {s.name ?? s.email}
                    </div>
                    <div className="truncate text-[10px] text-[var(--color-muted-foreground)]">
                      {s.email}
                    </div>
                  </div>
                  {s.alreadyInWorkspace ? (
                    <span className="rounded-full bg-[var(--color-virgil-dark)] px-1.5 py-px text-[9px] font-semibold text-[var(--color-charcoal-500)]">
                      Already a member
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-charcoal-500)]">
          Name (optional)
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lyndsey"
          aria-label="Name"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-charcoal-500)]">
            Permissions
          </label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as PermissionPresetName)}
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm"
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {p === "Custom" ? "Custom..." : p}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
            {presetDescription(preset)}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-charcoal-500)]">
            Membership
          </label>
          <select
            value={membershipKind}
            onChange={(e) =>
              setMembershipKind(e.target.value as "CLIENT" | "TEAM_MEMBER")
            }
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm"
          >
            <option value="TEAM_MEMBER">Team (Wilson&rsquo;s staff)</option>
            <option value="CLIENT">Client (external)</option>
          </select>
        </div>
      </div>

      {alreadyAMember ? (
        <p className="rounded-[var(--radius-sm)] border border-[var(--color-bee)]/30 bg-[var(--color-bee)]/10 px-3 py-2 text-xs text-[var(--color-charcoal)]">
          {email} is already a member of this workspace.
        </p>
      ) : null}

      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={() => submit({ sendEmail: false })}
          disabled={pending || !emailValid || alreadyAMember || preset === "Custom"}
        >
          <Copy className="h-3.5 w-3.5" /> Create invite link
        </Button>
        <Button
          variant="primary"
          onClick={() => submit({ sendEmail: true })}
          disabled={pending || !emailValid || alreadyAMember}
        >
          <Send className="h-3.5 w-3.5" />
          {preset === "Custom" ? "Set permissions →" : pending ? "Sending..." : "Send email invite"}
        </Button>
      </div>
    </div>
  );
}

function presetDescription(p: PermissionPresetName): string {
  switch (p) {
    case "Approver":
      return "View + approve. Default for clients.";
    case "Contributor":
      return "View + approve + edit prospect data.";
    case "Sender":
      return "View + approve + edit + mark sent / replied.";
    case "Administrator":
      return "Full access including workspace settings + members.";
    case "Custom":
      return "Pick exactly which actions to allow on the Permissions tab.";
  }
}

/* ─── Members tab ───────────────────────────────────────────── */

function MembersTab({
  members,
  viewerCanAdmin,
  onSwitchToPermissions,
}: {
  members: ModalMembers;
  viewerCanAdmin: boolean;
  onSwitchToPermissions: () => void;
}) {
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
      {members.members.map((m) => (
        <MemberLine
          key={m.membershipId}
          row={m}
          viewerCanAdmin={viewerCanAdmin}
          onChangePermissions={onSwitchToPermissions}
        />
      ))}
      {members.pending.map((p) => (
        <PendingLine
          key={p.inviteId}
          row={p}
          viewerCanAdmin={viewerCanAdmin}
        />
      ))}
      {members.members.length === 0 && members.pending.length === 0 ? (
        <li className="px-3 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
          No members yet.
        </li>
      ) : null}
    </ul>
  );
}

function MemberLine({
  row,
  viewerCanAdmin,
  onChangePermissions,
}: {
  row: MemberRow;
  viewerCanAdmin: boolean;
  onChangePermissions: () => void;
}) {
  const { confirm, toast } = useToast();
  const [pending, startTransition] = useTransition();
  const label = derivePermissionLabel(row);

  async function remove() {
    const ok = await confirm({
      title: `Remove ${row.name}?`,
      description: "They lose access to this workspace immediately.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await removeMembership(row.membershipId);
        toast.success(`${row.name} removed.`);
      } catch (err) {
        toast.error((err as Error).message ?? "Couldn't remove member.");
      }
    });
  }

  // No menu for owner row, or for self when not admin.
  const showMenu = viewerCanAdmin && !row.isWorkspaceOwner;

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
      <Avatar name={row.name} image={row.image} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-[var(--color-charcoal)]">
            {row.name}
          </span>
          <RoleChip systemRole={row.systemRole} />
        </div>
        <div className="truncate text-xs text-[var(--color-muted-foreground)]">
          {row.email}
          {" · "}
          {relativeTime(row.createdAt)}
        </div>
      </div>
      <span className="rounded-full bg-[var(--color-virgil-dark)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-charcoal-500)]">
        {label}
      </span>
      {showMenu ? (
        <RowMenu
          items={[
            { label: "Change permissions", onClick: onChangePermissions },
            {
              label: "Remove from workspace",
              onClick: remove,
              destructive: true,
              disabled: pending,
            },
          ]}
        />
      ) : (
        <span className="w-7" />
      )}
    </li>
  );
}

function PendingLine({
  row,
  viewerCanAdmin,
}: {
  row: PendingInviteRow;
  viewerCanAdmin: boolean;
}) {
  const { confirm, toast } = useToast();
  const [pending, startTransition] = useTransition();

  async function resend() {
    startTransition(async () => {
      try {
        await resendInvite(row.inviteId);
        toast.success(`Invite to ${row.email} re-sent.`);
      } catch (err) {
        toast.error((err as Error).message ?? "Couldn't resend invite.");
      }
    });
  }

  async function revoke() {
    const ok = await confirm({
      title: "Revoke invite?",
      description: `${row.email} won't be able to use the existing link.`,
      confirmLabel: "Revoke",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await revokeInvite(row.inviteId);
        toast.success("Invite revoked.");
      } catch (err) {
        toast.error((err as Error).message ?? "Couldn't revoke invite.");
      }
    });
  }

  const label = derivePermissionLabel({ ...row, isWorkspaceOwner: false });

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
      <Avatar name={row.email} image={null} dimmed />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-[var(--color-charcoal-500)]">
            {row.email}
          </span>
          <RoleChip systemRole={row.systemRole} />
        </div>
        <div className="truncate text-xs italic text-[var(--color-muted-foreground)]">
          Pending invite · {relativeTime(row.createdAt, "Invited")}
        </div>
      </div>
      <span className="rounded-full bg-[var(--color-virgil-dark)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-charcoal-500)]">
        {label}
      </span>
      {viewerCanAdmin ? (
        <RowMenu
          items={[
            {
              label: "Resend invite",
              onClick: resend,
              disabled: pending,
            },
            {
              label: "Revoke invite",
              onClick: revoke,
              destructive: true,
              disabled: pending,
            },
          ]}
        />
      ) : (
        <span className="w-7" />
      )}
    </li>
  );
}

/* ─── Permissions tab ───────────────────────────────────────── */

function PermissionsTab({
  members,
  viewerCanAdmin,
}: {
  members: MemberRow[];
  viewerCanAdmin: boolean;
}) {
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
            <PermissionsRow
              key={m.membershipId}
              member={m}
              members={members}
              viewerCanAdmin={viewerCanAdmin}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PermissionsRow({
  member,
  members,
  viewerCanAdmin,
}: {
  member: MemberRow;
  members: MemberRow[];
  viewerCanAdmin: boolean;
}) {
  const { toast } = useToast();
  const [flags, setFlags] = useState({
    canApprove: member.canApprove,
    canEdit: member.canEdit,
    canSend: member.canSend,
    canAdmin: member.canAdmin,
  });
  const [pending, startTransition] = useTransition();
  const editable = viewerCanAdmin && !member.isWorkspaceOwner;

  function adminCount(): number {
    return members.reduce((n, m) => (m.canAdmin ? n + 1 : n), 0);
  }

  function toggle(field: keyof typeof flags) {
    if (!editable) return;
    const next = { ...flags, [field]: !flags[field] };

    // Last-admin client guard. Mirror the server check so the user gets a
    // friendly toast instead of an action throw.
    if (
      field === "canAdmin" &&
      flags.canAdmin && // currently on, about to flip off
      adminCount() <= 1
    ) {
      toast.error("At least one administrator must remain in the workspace.");
      return;
    }

    setFlags(next);
    startTransition(async () => {
      try {
        await updateMembershipPermissions({
          membershipId: member.membershipId,
          [field]: next[field],
        });
      } catch (err) {
        setFlags(flags);
        toast.error((err as Error).message ?? "Update failed.");
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
          <RoleChip systemRole={member.systemRole} />
          {pending ? <span>saving...</span> : null}
        </div>
      </td>
      <td className="px-2 py-2 text-center">
        <Lock className="mx-auto h-3.5 w-3.5 text-[var(--color-charcoal-300)]" />
      </td>
      <td className="px-2 py-2 text-center">
        <Cell
          on={flags.canApprove}
          locked={!editable}
          onClick={() => toggle("canApprove")}
        />
      </td>
      <td className="px-2 py-2 text-center">
        <Cell
          on={flags.canEdit}
          locked={!editable}
          onClick={() => toggle("canEdit")}
        />
      </td>
      <td className="px-2 py-2 text-center">
        <Cell
          on={flags.canSend}
          locked={!editable}
          onClick={() => toggle("canSend")}
        />
      </td>
      <td className="px-2 py-2 text-center">
        <Cell
          on={flags.canAdmin}
          locked={!editable || member.isWorkspaceOwner}
          ownerLocked={member.isWorkspaceOwner}
          onClick={() => toggle("canAdmin")}
        />
      </td>
    </tr>
  );
}

function Cell({
  on,
  locked,
  ownerLocked,
  onClick,
}: {
  on: boolean;
  locked?: boolean;
  ownerLocked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      aria-pressed={on}
      title={ownerLocked ? "Company Owner — locked" : undefined}
      className={`mx-auto inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${
        on
          ? "border-[var(--color-forest)] bg-[var(--color-forest)] text-[var(--color-lime)]"
          : "border-[var(--color-border-strong)] bg-[var(--color-surface)]"
      } ${locked ? "cursor-not-allowed opacity-70" : ""}`}
    >
      {on ? "✓" : ""}
    </button>
  );
}

/* ─── Notifications tab ─────────────────────────────────────── */

function NotificationsTab({ members }: { members: MemberRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-virgil)] text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            <th className="px-3 py-2 text-left">Member</th>
            <th className="px-2 py-2 text-center">
              <UserPlus className="mx-auto h-3.5 w-3.5" />
              <div>New prospect</div>
            </th>
            <th className="px-2 py-2 text-center">
              <CheckCircle2 className="mx-auto h-3.5 w-3.5" />
              <div>Needs approval</div>
            </th>
            <th className="px-2 py-2 text-center">
              <Activity className="mx-auto h-3.5 w-3.5" />
              <div>Status changes</div>
            </th>
            <th className="px-2 py-2 text-center">
              <MessageSquare className="mx-auto h-3.5 w-3.5" />
              <div>Comments</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <NotificationsRow key={m.membershipId} member={m} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotificationsRow({ member }: { member: MemberRow }) {
  const { toast } = useToast();
  const [flags, setFlags] = useState({
    notifyOnNewProspect: member.notifyOnNewProspect,
    notifyOnApprovalRequested: member.notifyOnApprovalRequested,
    notifyOnStatusChange: member.notifyOnStatusChange,
    notifyOnComment: member.notifyOnComment,
  });
  const [pending, startTransition] = useTransition();

  function toggle(field: keyof typeof flags) {
    const next = { ...flags, [field]: !flags[field] };
    setFlags(next);
    startTransition(async () => {
      try {
        await updateMembershipNotifications({
          membershipId: member.membershipId,
          [field]: next[field],
        });
      } catch (err) {
        setFlags(flags);
        toast.error((err as Error).message ?? "Update failed.");
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
          <RoleChip systemRole={member.systemRole} />
          {pending ? <span>saving...</span> : null}
        </div>
      </td>
      <td className="px-2 py-2 text-center">
        <Cell on={flags.notifyOnNewProspect} onClick={() => toggle("notifyOnNewProspect")} />
      </td>
      <td className="px-2 py-2 text-center">
        <Cell
          on={flags.notifyOnApprovalRequested}
          onClick={() => toggle("notifyOnApprovalRequested")}
        />
      </td>
      <td className="px-2 py-2 text-center">
        <Cell on={flags.notifyOnStatusChange} onClick={() => toggle("notifyOnStatusChange")} />
      </td>
      <td className="px-2 py-2 text-center">
        <Cell on={flags.notifyOnComment} onClick={() => toggle("notifyOnComment")} />
      </td>
    </tr>
  );
}

/* ─── Shared row primitives ──────────────────────────────────── */

function Avatar({
  name,
  image,
  dimmed = false,
}: {
  name: string;
  image: string | null;
  dimmed?: boolean;
}) {
  const cls = `inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-forest)] text-[10px] font-semibold text-[var(--color-lime)] ${
    dimmed ? "opacity-60" : ""
  }`;
  return (
    <span className={cls}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

function RoleChip({
  systemRole,
}: {
  systemRole: "ADMIN" | "TEAM_MEMBER" | "CLIENT";
}) {
  // Team = forest (green); Client = bee (yellow). Admin reads as Team for
  // chip purposes — Wilson's staff vs. external is the distinction here.
  const isClient = systemRole === "CLIENT";
  const color = isClient
    ? "bg-[var(--color-bee)] text-[var(--color-charcoal)]"
    : "bg-[var(--color-forest)] text-[var(--color-virgil)]";
  return (
    <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${color}`}>
      {isClient ? "Client" : "Team"}
    </span>
  );
}

function RowMenu({
  items,
}: {
  items: Array<{
    label: string;
    onClick: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1.5 text-[var(--color-charcoal-300)] hover:bg-[var(--color-virgil-dark)] hover:text-[var(--color-charcoal)]"
        aria-label="Member actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <ul
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[170px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lifted)]"
        >
          {items.map((it) => (
            <li key={it.label}>
              <button
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={`block w-full px-3 py-2 text-left text-xs ${
                  it.destructive
                    ? "text-[var(--color-raspberry)] hover:bg-[var(--color-raspberry)]/10"
                    : "text-[var(--color-charcoal-500)] hover:bg-[var(--color-virgil)]"
                } ${it.disabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/[\s@]/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function relativeTime(d: Date, prefix: string = ""): string {
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.floor(ms / 60_000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const out =
    min < 1
      ? "just now"
      : min < 60
      ? `${min} min ago`
      : hr < 24
      ? `${hr} hr ago`
      : day < 7
      ? `${day} day${day === 1 ? "" : "s"} ago`
      : `${Math.floor(day / 7)} wk ago`;
  return prefix ? `${prefix} ${out}` : out;
}

function getDropdownChevron() {
  // Re-export ChevronDown so callers don't need lucide-react if they import
  // it via this module. Currently unused — kept for future tab pivots.
  return ChevronDown;
}
void getDropdownChevron;

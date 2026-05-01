"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  History,
  LogOut,
  Plus,
  Settings,
  Users,
  UserPlus,
} from "lucide-react";
import { WorkspaceLogo } from "@/components/settings/workspace-logo";
import { MarkW } from "@/components/brand/wordmark";
import { MembersModal, type MemberRow } from "./members-modal";
import { logout } from "@/app/(auth)/login/actions";

/**
 * Shared workspace dropdown — used by both the picker home (no active
 * workspace) and the in-workspace top bar (active workspace).
 *
 * Pattern (matches new Plannable reference):
 *   ┌─────────────────────────────────────┐
 *   │ [W] Wilson's                        │
 *   │     {viewer name}                   │
 *   │                                     │
 *   │  ⚙ Settings    ⚇ Members            │  ← only in workspace context
 *   │                                     │
 *   │ ─── Workspaces ────────────────────│
 *   │  [ ] Workspace A             ✓     │
 *   │  [ ] Workspace B                   │
 *   │  [+ ] New workspace                │  ← ADMIN only
 *   │                                     │
 *   │ ↻ Audit log                         │  ← ADMIN only
 *   │ ⤴ Sign out                     [V]│
 *   └─────────────────────────────────────┘
 */

export type SwitcherWorkspace = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
};

type CommonProps = {
  viewer: {
    name: string;
    email: string;
    image: string | null;
    role: "ADMIN" | "TEAM_MEMBER" | "CLIENT";
  };
  workspaces: SwitcherWorkspace[];
  /** id of the currently-active workspace, or null on the picker. */
  activeWorkspaceId: string | null;
};

type InWorkspaceProps = CommonProps & {
  context: "in-workspace";
  activeWorkspace: SwitcherWorkspace;
  members: MemberRow[];
  viewerCanAdmin: boolean;
};

type PickerProps = CommonProps & {
  context: "picker";
};

export function WorkspaceSwitcher(props: InWorkspaceProps | PickerProps) {
  const [open, setOpen] = useState(false);
  // null = closed; "invite"/"members" = which tab to open at.
  const [membersTab, setMembersTab] = useState<
    "invite" | "members" | "permissions" | "notifications" | null
  >(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click + Escape.
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

  const isInWorkspace = props.context === "in-workspace";
  const triggerLabel = isInWorkspace ? props.activeWorkspace.name : "Wilson's";
  const triggerLogo = isInWorkspace ? (
    <WorkspaceLogo
      name={props.activeWorkspace.name}
      logoUrl={props.activeWorkspace.logoUrl}
      accentColor={props.activeWorkspace.accentColor}
      size="sm"
    />
  ) : (
    <MarkW tone="forest" className="h-5 w-5 shrink-0" />
  );

  const firstName = (props.viewer.name ?? props.viewer.email ?? "")
    .split(" ")[0]
    ?.trim();
  const showNewWorkspace = props.viewer.role === "ADMIN";
  const showAuditLog = props.viewer.role === "ADMIN";

  return (
    <>
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-virgil-dark)] px-3 py-1.5 text-sm font-semibold text-[var(--color-charcoal)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-virgil)]"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {triggerLogo}
          <span className="max-w-[180px] truncate">{triggerLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--color-charcoal-300)]" />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute left-0 top-full z-40 mt-1.5 w-80 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-lifted)]"
          >
            {/* Top: agency wordmark + signed-in user name */}
            <div className="flex items-center gap-2 px-1 py-1">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-forest)] text-[var(--color-lime)]">
                <MarkW tone="lime" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--color-charcoal)]">
                  Wilson&rsquo;s
                </div>
                <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                  {firstName ?? props.viewer.email}
                </div>
              </div>
            </div>

            {/* Settings + Members buttons (only in workspace context) */}
            {isInWorkspace ? (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Link
                  href={`/dashboard/workspaces/${props.activeWorkspace.slug}/settings`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs font-medium text-[var(--color-charcoal-500)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-virgil)] hover:text-[var(--color-charcoal)]"
                >
                  <Settings className="h-3.5 w-3.5" /> Settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setMembersTab("members");
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs font-medium text-[var(--color-charcoal-500)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-virgil)] hover:text-[var(--color-charcoal)]"
                >
                  <Users className="h-3.5 w-3.5" /> Members
                </button>
              </div>
            ) : null}

            {/* Workspace list */}
            <div className="mt-3 mb-1 flex items-center justify-between px-1 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <span>Workspaces</span>
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {props.workspaces.map((w) => {
                const active = w.id === props.activeWorkspaceId;
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/dashboard/workspaces/${w.slug}/prospects`);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--color-charcoal-500)] hover:bg-[var(--color-virgil)]"
                    >
                      <WorkspaceLogo
                        name={w.name}
                        logoUrl={w.logoUrl}
                        accentColor={w.accentColor}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {w.name}
                      </span>
                      {active ? (
                        <Check className="h-3.5 w-3.5 text-[var(--color-forest)]" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
              {showNewWorkspace ? (
                <li>
                  <Link
                    href="/dashboard/new-client"
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--color-charcoal-300)] hover:bg-[var(--color-virgil)] hover:text-[var(--color-forest)]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-[var(--color-border)]">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">New workspace</span>
                  </Link>
                </li>
              ) : null}
            </ul>

            {/* Footer: audit log + sign out */}
            <div className="mt-2 border-t border-[var(--color-border)] pt-2">
              {showAuditLog ? (
                <Link
                  href="/dashboard/audit"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--color-charcoal-500)] hover:bg-[var(--color-virgil)] hover:text-[var(--color-forest)]"
                >
                  <History className="h-3.5 w-3.5" /> Audit log
                </Link>
              ) : null}
              <form action={logout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--color-charcoal-500)] hover:bg-[var(--color-virgil)] hover:text-[var(--color-raspberry)]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left">Sign out</span>
                  <span className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-[var(--color-forest)] text-[9px] font-semibold text-[var(--color-lime)]">
                    {props.viewer.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={props.viewer.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials(props.viewer.name ?? props.viewer.email ?? "")
                    )}
                  </span>
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>

      {isInWorkspace ? (
        <MembersModal
          open={membersTab !== null}
          defaultTab={membersTab ?? "members"}
          onClose={() => setMembersTab(null)}
          workspaceSlug={props.activeWorkspace.slug}
          viewerCanAdmin={props.viewerCanAdmin}
          members={props.members}
        />
      ) : null}
    </>
  );
}

/**
 * Standalone "+ Share" button — placed in the top bar (admin-only) and
 * opens the Members modal at the Invite tab. Forms its own island so the
 * switcher dropdown state stays local.
 */
export function ShareButton({
  workspaceSlug,
  viewerCanAdmin,
  members,
}: {
  workspaceSlug: string;
  viewerCanAdmin: boolean;
  members: MemberRow[];
}) {
  const [open, setOpen] = useState(false);
  if (!viewerCanAdmin) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-forest)] px-3 py-1.5 text-xs font-semibold text-[var(--color-virgil)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-forest-900)]"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Share
      </button>
      <MembersModal
        open={open}
        defaultTab="invite"
        onClose={() => setOpen(false)}
        workspaceSlug={workspaceSlug}
        viewerCanAdmin={viewerCanAdmin}
        members={members}
      />
    </>
  );
}

function initials(s: string): string {
  return s
    .split(/[\s@]/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

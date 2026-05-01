"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  WorkspaceSwitcher,
  ShareButton,
  type SwitcherWorkspace,
} from "./workspace-switcher";
import type { ModalMembers } from "./members-modal";

/**
 * In-workspace top bar (V1 UX overhaul rev 2).
 *
 * Plannable-style: a single workspace pill on the left that opens the
 * dropdown popover. The popover holds Settings/Members buttons, the
 * full workspace list, and the audit-log/sign-out footer (see
 * <WorkspaceSwitcher>). Below the bar: a horizontal tab strip
 * (Prospects / Archive / ICP / Settings).
 */

export type TopBarWorkspace = SwitcherWorkspace;

export function WorkspaceTopBar({
  workspace,
  workspaces,
  members,
  viewer,
  viewerCanAdmin,
  pendingCount,
}: {
  workspace: TopBarWorkspace;
  workspaces: TopBarWorkspace[];
  members: ModalMembers;
  viewer: {
    name: string;
    email: string;
    image: string | null;
    role: "ADMIN" | "TEAM_MEMBER" | "CLIENT";
  };
  viewerCanAdmin: boolean;
  pendingCount: number;
}) {
  const pathname = usePathname();
  const baseSlug = `/dashboard/workspaces/${workspace.slug}`;
  const tabs: {
    href: string;
    label: string;
    badge?: string;
    matcher: (p: string) => boolean;
  }[] = [
    {
      href: `${baseSlug}/prospects`,
      label: "Prospects",
      badge: pendingCount > 0 ? String(pendingCount) : undefined,
      matcher: (p) =>
        p.startsWith(`${baseSlug}/prospects`) &&
        !p.startsWith(`${baseSlug}/prospects/archive`),
    },
    {
      href: `${baseSlug}/prospects/archive`,
      label: "Archive",
      matcher: (p) => p.startsWith(`${baseSlug}/prospects/archive`),
    },
    {
      href: `${baseSlug}/icp`,
      label: "ICP reference",
      matcher: (p) => p.startsWith(`${baseSlug}/icp`),
    },
    {
      href: `${baseSlug}/settings`,
      label: "Settings",
      matcher: (p) => p.startsWith(`${baseSlug}/settings`),
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-3 px-6 py-3">
        <WorkspaceSwitcher
          context="in-workspace"
          activeWorkspace={workspace}
          activeWorkspaceId={workspace.id}
          workspaces={workspaces}
          viewer={viewer}
          viewerCanAdmin={viewerCanAdmin}
          members={members}
        />
        <div className="ml-auto">
          <ShareButton
            workspaceSlug={workspace.slug}
            viewerCanAdmin={viewerCanAdmin}
            members={members}
          />
        </div>
      </div>

      {/* Tab strip */}
      <nav className="flex items-end gap-1 border-t border-[var(--color-border)] bg-[var(--color-virgil)] px-6">
        {tabs.map((tab) => {
          const active = tab.matcher(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "text-[var(--color-forest)]"
                  : "text-[var(--color-charcoal-300)] hover:text-[var(--color-charcoal)]"
              }`}
            >
              {tab.label === "ICP reference" ? (
                <Sparkles className="h-3 w-3" />
              ) : null}
              {tab.label}
              {tab.badge ? (
                <span className="rounded-full bg-[var(--color-bee)] px-1.5 py-px text-[9px] font-semibold text-[var(--color-charcoal)]">
                  {tab.badge}
                </span>
              ) : null}
              {active ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-[var(--color-forest)]" />
              ) : null}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

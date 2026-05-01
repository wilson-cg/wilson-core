"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, ChevronDown, Settings, Users, Sparkles } from "lucide-react";
import { WorkspaceLogo } from "@/components/settings/workspace-logo";
import { MembersModal, type MemberRow } from "./members-modal";

/**
 * In-workspace top bar (V1 UX overhaul). Replaces the cross-workspace
 * sidebar. Three sections:
 *   - left: ← All clients
 *   - middle: workspace name + dropdown of the user's other workspaces
 *   - right: Members button (avatar overlap → modal), Settings cog
 *
 * Below the bar: a horizontal tab strip (Prospects / Archive / Settings).
 *
 * The dropdown is uncontrolled — clicking outside closes it.
 */

export type TopBarWorkspace = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
};

export function WorkspaceTopBar({
  workspace,
  otherWorkspaces,
  members,
  viewerCanAdmin,
  pendingCount,
}: {
  workspace: TopBarWorkspace;
  otherWorkspaces: TopBarWorkspace[];
  members: MemberRow[];
  viewerCanAdmin: boolean;
  pendingCount: number;
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(e.target as Node)
      ) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const baseSlug = `/dashboard/workspaces/${workspace.slug}`;
  const tabs: { href: string; label: string; badge?: string; matcher: (p: string) => boolean }[] = [
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
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-3 px-6 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
          >
            <ArrowLeft className="h-3 w-3" /> All clients
          </Link>

          <div className="mx-2 h-4 w-px bg-[var(--color-border)]" />

          {/* Workspace switcher dropdown */}
          <div className="relative" ref={switcherRef}>
            <button
              type="button"
              onClick={() => setSwitcherOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--color-charcoal)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-virgil)]"
            >
              <WorkspaceLogo
                name={workspace.name}
                logoUrl={workspace.logoUrl}
                accentColor={workspace.accentColor}
                size="sm"
              />
              <span className="truncate">{workspace.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--color-charcoal-300)]" />
            </button>

            {switcherOpen ? (
              <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-lifted)]">
                {otherWorkspaces.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
                    No other workspaces.
                  </p>
                ) : (
                  <ul className="max-h-72 overflow-y-auto">
                    {otherWorkspaces.map((w) => (
                      <li key={w.id}>
                        <Link
                          href={`/dashboard/workspaces/${w.slug}/prospects`}
                          onClick={() => setSwitcherOpen(false)}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--color-charcoal-500)] hover:bg-[var(--color-virgil)]"
                        >
                          <WorkspaceLogo
                            name={w.name}
                            logoUrl={w.logoUrl}
                            accentColor={w.accentColor}
                            size="sm"
                          />
                          <span className="truncate">{w.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-1 border-t border-[var(--color-border)] pt-1">
                  <Link
                    href="/"
                    onClick={() => setSwitcherOpen(false)}
                    className="block rounded-md px-2 py-1.5 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-virgil)] hover:text-[var(--color-forest)]"
                  >
                    See all clients →
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-charcoal-500)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-virgil)]"
            >
              <AvatarOverlap members={members.slice(0, 3)} />
              <span>
                <Users className="inline h-3 w-3" /> {members.length}
              </span>
            </button>
            {viewerCanAdmin ? (
              <Link
                href={`${baseSlug}/settings`}
                aria-label="Workspace settings"
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 text-[var(--color-charcoal-300)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-virgil)] hover:text-[var(--color-charcoal)]"
              >
                <Settings className="h-3.5 w-3.5" />
              </Link>
            ) : null}
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

      <MembersModal
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        workspaceSlug={workspace.slug}
        viewerCanAdmin={viewerCanAdmin}
        members={members}
      />
    </>
  );
}

function AvatarOverlap({
  members,
}: {
  members: { name: string; image: string | null }[];
}) {
  return (
    <span className="flex -space-x-1.5">
      {members.map((m, i) => (
        <span
          key={i}
          className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-[var(--color-surface)] bg-[var(--color-forest)] text-[8px] font-semibold text-[var(--color-lime)]"
          title={m.name}
        >
          {m.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.image}
              alt={m.name}
              className="h-full w-full object-cover"
            />
          ) : (
            initials(m.name)
          )}
        </span>
      ))}
    </span>
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

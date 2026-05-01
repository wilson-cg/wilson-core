import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, requireWorkspace } from "@/lib/auth";
import { Wordmark, MarkW } from "@/components/brand/wordmark";
import { logout } from "@/app/(auth)/login/actions";
import { NavItemClient } from "@/app/(team)/nav-item";
import { prisma } from "@/lib/db";
import {
  ArrowLeft,
  Users,
  Sparkles,
  Settings,
  CheckCircle2,
  ChevronsUpDown,
  LogOut,
} from "lucide-react";
import { WorkspaceLogo } from "@/components/settings/workspace-logo";

/**
 * Workspace-scoped layout. When you're inside /dashboard/workspaces/[slug]/*,
 * the sidebar flips from the cross-workspace global nav to this client-
 * focused one: profile card at the top-left, then Content, Prospects, ICP,
 * Approvals, Settings.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  // V1 pivot (2026-04-30): CLIENT role can render this layout too.
  // requireWorkspace() below already gates by Membership for CLIENTs, so
  // the access boundary stays correct. Decision: option (b) softening over
  // moving routes — smaller diff, same security.
  await requireRole("ADMIN", "TEAM_MEMBER", "CLIENT");
  const { slug } = await params;
  const { user, workspace } = await requireWorkspace(slug);
  if (!workspace) notFound();

  // Pending counts for sidebar badges (messages only — content surface is hidden in V1)
  const pendingMessages = await prisma.message.count({
    where: { workspaceId: workspace.id, status: "PENDING_APPROVAL" },
  });

  return (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-virgil-dark)]/60 px-3 py-4 md:flex">
        {/* Back to all clients */}
        <Link
          href="/dashboard"
          className="mx-2 mb-3 inline-flex items-center gap-1 text-[11px] text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> All clients
        </Link>

        {/* Client profile card — top-left, per Kanban ref */}
        <div className="mx-2 mb-5 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]">
          <WorkspaceLogo
            name={workspace.name}
            logoUrl={workspace.logoUrl}
            accentColor={workspace.accentColor}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[var(--color-charcoal)]">
              {workspace.name}
            </div>
            <div className="truncate text-[11px] text-[var(--color-muted-foreground)]">
              {workspace.contactName}
            </div>
          </div>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 space-y-0.5 px-1">
          <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-charcoal-300)]">
            Main
          </div>
          {/* HIDDEN-V1: Content nav removed per 2026-04-30 client meeting. */}
          <NavItemClient
            href={`/dashboard/workspaces/${slug}/prospects`}
            label="Prospects"
            badge={pendingMessages > 0 ? String(pendingMessages) : undefined}
          >
            <Users className="h-4 w-4 shrink-0" />
          </NavItemClient>
          <NavItemClient
            href={`/dashboard/workspaces/${slug}/prospects/archive`}
            label="Archive"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          </NavItemClient>

          <div className="mt-6 mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-charcoal-300)]">
            Settings
          </div>
          <NavItemClient
            href={`/dashboard/workspaces/${slug}/settings`}
            label="Workspace settings"
          >
            <Settings className="h-4 w-4 shrink-0" />
          </NavItemClient>
          <NavItemClient
            href={`/dashboard/workspaces/${slug}/icp`}
            label="ICP reference"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
          </NavItemClient>
        </nav>

        {/* Bottom — agency identity + logout */}
        <div className="mt-2 space-y-2 border-t border-[var(--color-border)] pt-3">
          <Wordmark tone="forest" className="mx-2 h-5" />
          <div className="flex items-stretch gap-1">
            <button
              type="button"
              className="flex flex-1 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm shadow-[var(--shadow-soft)] hover:bg-[var(--color-virgil)]"
            >
              <MarkW tone="forest" className="h-5 w-5" />
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-xs font-semibold text-[var(--color-charcoal)]">
                  {user.name}
                </div>
                <div className="truncate text-[10px] text-[var(--color-muted-foreground)]">
                  {user.role === "ADMIN" ? "Agency Admin" : "Team"}
                </div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-[var(--color-charcoal-300)]" />
            </button>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sign out"
                className="flex h-full w-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-charcoal-300)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-virgil)] hover:text-[var(--color-raspberry)]"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

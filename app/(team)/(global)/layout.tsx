import Link from "next/link";
import { MarkW, Wordmark } from "@/components/brand/wordmark";
import {
  Home,
  Search,
  Plus,
  ChevronsUpDown,
  CheckCircle2,
  LogOut,
  Bell,
  Building2,
  History,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { teamSidebarWorkspaces } from "@/lib/queries";
import { logout } from "@/app/(auth)/login/actions";
import { NavItemClient } from "@/app/(team)/nav-item";

/**
 * Global team layout — used for cross-workspace views: Home, Approvals,
 * Notifications, Settings. The sidebar lists every client but clicking one
 * moves into the workspace-scoped layout (see sibling (workspace) group).
 */
export default async function GlobalTeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("ADMIN", "TEAM_MEMBER");
  const workspaces = await teamSidebarWorkspaces(user);

  return (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-virgil-dark)]/60 px-3 py-4 md:flex">
        <div className="mb-2 flex items-center justify-between px-2">
          <Link href="/dashboard" className="inline-flex items-center">
            <Wordmark tone="forest" className="h-7" />
          </Link>
          <button
            type="button"
            aria-label="Quick add"
            className="rounded-md p-1 text-[var(--color-charcoal-300)] hover:bg-white/60 hover:text-[var(--color-charcoal)]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          className="mx-2 mb-4 mt-1 flex h-9 w-[calc(100%-1rem)] items-center gap-2 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-muted-foreground)] shadow-[var(--shadow-soft)] hover:border-[var(--color-border-strong)]"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-left">Search</span>
          <span className="ml-auto shrink-0 rounded border border-[var(--color-border)] px-1.5 py-px text-[10px] font-medium tracking-wide">
            ⌘K
          </span>
        </button>

        <nav className="flex-1 space-y-0.5 px-1">
          <NavItemClient href="/dashboard" label="Home" exact>
            <Home className="h-4 w-4 shrink-0" />
          </NavItemClient>
          <NavItemClient href="/dashboard/approvals" label="Approvals">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          </NavItemClient>
          <NavItemClient href="/dashboard/notifications" label="Notifications">
            <Bell className="h-4 w-4 shrink-0" />
          </NavItemClient>
          {user.role === "ADMIN" ? (
            <NavItemClient href="/dashboard/audit" label="Audit log">
              <History className="h-4 w-4 shrink-0" />
            </NavItemClient>
          ) : null}
          {user.role === "ADMIN" ? (
            <NavItemClient href="/dashboard/team" label="Team">
              <Users className="h-4 w-4 shrink-0" />
            </NavItemClient>
          ) : null}

          <div className="mt-6 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-charcoal-300)]">
            Clients
          </div>
          {workspaces.map((w) => (
            <NavItemClient
              key={w.id}
              href={`/dashboard/workspaces/${w.slug}/content`}
              label={w.name}
              badge={w.pending > 0 ? String(w.pending) : undefined}
            >
              <Building2 className="h-4 w-4 shrink-0" />
            </NavItemClient>
          ))}
          <Link
            href="/dashboard/new-client"
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--color-charcoal-300)] hover:bg-white/60 hover:text-[var(--color-charcoal)]"
          >
            <Plus className="h-3.5 w-3.5" /> New client
          </Link>
        </nav>

        <div className="mt-2 space-y-2 border-t border-[var(--color-border)] pt-3">
          <div className="flex items-stretch gap-1">
            <button
              type="button"
              className="flex flex-1 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm shadow-[var(--shadow-soft)] hover:bg-[var(--color-virgil)]"
            >
              <MarkW tone="forest" className="h-5 w-5" />
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-xs font-semibold text-[var(--color-charcoal)]">
                  Wilson&apos;s
                </div>
                <div className="truncate text-[10px] text-[var(--color-muted-foreground)]">
                  {user.role === "ADMIN" ? "Agency Admin" : "Team"} ·{" "}
                  {user.name.split(" ")[0]}
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

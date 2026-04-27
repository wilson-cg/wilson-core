import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Bell, LogOut } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { logout } from "../(auth)/login/actions";
import { WorkspaceLogo } from "@/components/settings/workspace-logo";
import { ClientNavLink } from "./client-nav-link";

/**
 * Client surface layout. Clients see exactly one workspace — theirs.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("CLIENT");
  const workspace = user.memberships[0]?.workspace;

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* White-label zone: client logo + powered-by Wilson's */}
          <div className="flex items-center gap-3">
            <WorkspaceLogo
              name={workspace?.name ?? "Workspace"}
              logoUrl={workspace?.logoUrl ?? null}
              accentColor={workspace?.accentColor ?? null}
              size="md"
            />
            <div>
              <div className="text-sm font-medium leading-tight text-[var(--color-charcoal)]">
                {workspace?.name ?? "Workspace"}
              </div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                powered by
                <Wordmark tone="forest" className="h-2.5" />
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            <ClientNavLink href="/client/dashboard" label="Home" />
            <ClientNavLink href="/client/settings" label="Settings" />
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-grapefruit)] text-sm font-semibold text-[var(--color-charcoal)]">
              {user.name
                .split(" ")
                .map((s) => s[0])
                .join("")
                .slice(0, 2)}
            </div>
            <form action={logout}>
              <Button variant="ghost" size="icon" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}


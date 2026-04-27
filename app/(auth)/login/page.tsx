import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { listTestUsers } from "@/lib/auth";
import { loginAs } from "./actions";
import { ArrowRight } from "lucide-react";

// listTestUsers hits the DB — never prerender this at build time
export const dynamic = "force-dynamic";

/**
 * Stress-test login. Lists every seeded user and lets you impersonate with
 * one click. Email/password input stays for visual fidelity but is not
 * wired — swap both paths for Clerk/NextAuth at productionization.
 */
export default async function LoginPage() {
  const users = await listTestUsers();

  const staff = users.filter((u) => u.role !== "CLIENT");
  const clients = users.filter((u) => u.role === "CLIENT");

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* ── Left: user switcher (stress test) ── */}
      <div className="flex items-center justify-center px-8 py-16 lg:px-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="inline-flex items-center">
            <Wordmark tone="forest" className="h-10" />
          </Link>

          <h1 className="app-heading mt-12 text-3xl text-[var(--color-forest)]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Pick a test user to sign in as.
          </p>

          <section className="mt-8 space-y-6">
            <UserGroup label="Wilson's staff" users={staff} />
            <UserGroup label="Clients" users={clients} />
          </section>

          <p className="mt-8 text-xs text-[var(--color-muted-foreground)]">
            This is a stress-test switcher — real email/password and
            invite flow ship at production cutover.
          </p>
        </div>
      </div>

      {/* ── Right: brand panel ── */}
      <div className="relative hidden overflow-hidden bg-grid-forest lg:block">
        <div className="pointer-events-none absolute -bottom-20 -right-16 select-none opacity-[0.06]">
          <span
            className="display-italic text-[26rem] leading-none text-[var(--color-virgil)]"
            aria-hidden
          >
            W
          </span>
        </div>
        <div className="relative flex h-full flex-col justify-between p-16">
          <Wordmark tone="virgil" className="h-8" />
          <div>
            <p className="font-display text-5xl leading-[1.1] text-[var(--color-virgil)]">
              Connecting{" "}
              <span className="display-italic">you</span>{" "}
              with{" "}
              <span className="display-italic">your</span>{" "}
              perfect{" "}
              <span className="display-italic">buyer.</span>
            </p>
            <p className="mt-8 max-w-md text-sm text-[var(--color-virgil)]/70">
              Wilson&apos;s is the operations platform for leaders at the
              world&apos;s most influential companies.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function UserGroup({
  label,
  users,
}: {
  label: string;
  users: Awaited<ReturnType<typeof listTestUsers>>;
}) {
  if (users.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </div>
      <div className="space-y-2">
        {users.map((u) => {
          const workspaces = u.memberships.map((m) => m.workspace.name);
          const subtitle =
            u.role === "ADMIN"
              ? "Agency admin · all workspaces"
              : u.role === "TEAM_MEMBER"
              ? `Team · ${workspaces.join(", ")}`
              : `Client · ${workspaces[0] ?? "—"}`;
          return (
            <form
              key={u.id}
              action={async () => {
                "use server";
                await loginAs(u.id);
              }}
            >
              <button
                type="submit"
                className="group flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left shadow-[var(--shadow-soft)] transition-all hover:border-[var(--color-forest)] hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest)] text-sm font-semibold text-[var(--color-lime)]">
                  {u.name
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--color-charcoal)]">
                    {u.name}
                  </div>
                  <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                    {subtitle}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--color-charcoal-300)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-forest)]" />
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

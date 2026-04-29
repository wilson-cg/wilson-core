import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InviteTeammateForm } from "./invite-teammate-form";
import { InviteRowActions } from "./invite-row-actions";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/**
 * Admin-only team management. Lists every user in the portal, plus
 * pending invites with revoke/resend actions, plus an invite form.
 */
export default async function TeamPage() {
  await requireRole("ADMIN");

  const [users, invites, workspaces] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { memberships: { include: { workspace: true } } },
    }),
    prisma.invite.findMany({
      where: { acceptedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        workspace: true,
        invitedBy: true,
        workspaceAccesses: { include: { workspace: true } },
      },
    }),
    prisma.workspace.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--color-forest)]" />
          <h1 className="app-heading text-2xl text-[var(--color-charcoal)]">
            Team
          </h1>
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Manage Wilson&rsquo;s admins, team members, and pending invitations.
        </p>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
        {/* ── Invite form ── */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
          <h2 className="app-heading text-base text-[var(--color-charcoal)]">
            Invite a teammate
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Sends a sign-in link via email. The invite expires in 7 days.
            Use ADMIN for full access, TEAM_MEMBER for workspace-level
            collaboration.
          </p>
          <div className="mt-4">
            <InviteTeammateForm workspaces={workspaces} />
          </div>
        </section>

        {/* ── Pending invites ── */}
        <section>
          <h2 className="app-heading mb-3 text-base text-[var(--color-charcoal)]">
            Pending invites ({invites.length})
          </h2>
          {invites.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
              No pending invites.
            </p>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-virgil-dark)]/40 text-left text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  <tr>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Workspace</th>
                    <th className="px-4 py-2.5">Invited by</th>
                    <th className="px-4 py-2.5">Expires</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {invites.map((inv) => {
                    const expired = inv.expiresAt.getTime() < Date.now();
                    const accessLabels = inv.workspaceAccesses.map(
                      (a) => `${a.workspace.name} (${a.workspaceRole})`,
                    );
                    const workspaceCell = inv.workspace?.name
                      ? inv.workspace.name
                      : accessLabels.length > 0
                        ? accessLabels.join(", ")
                        : "—";
                    return (
                      <tr key={inv.id}>
                        <td className="px-4 py-3 font-medium text-[var(--color-charcoal)]">
                          {inv.email}
                        </td>
                        <td className="px-4 py-3">
                          <Badge>{inv.systemRole}</Badge>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-charcoal-300)]">
                          {workspaceCell}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-charcoal-300)]">
                          {inv.invitedBy.name ?? inv.invitedBy.email}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {expired ? (
                            <span className="text-[var(--color-raspberry)]">
                              Expired
                            </span>
                          ) : (
                            <span className="text-[var(--color-charcoal-300)]">
                              in{" "}
                              {formatDistanceToNow(inv.expiresAt, {
                                addSuffix: false,
                              })}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <InviteRowActions inviteId={inv.id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Users ── */}
        <section>
          <h2 className="app-heading mb-3 text-base text-[var(--color-charcoal)]">
            All users ({users.length})
          </h2>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-virgil-dark)]/40 text-left text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Workspaces</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-[var(--color-charcoal)]">
                      {u.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-charcoal-300)]">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-charcoal-300)]">
                      {u.memberships.length === 0
                        ? "—"
                        : u.memberships.map((m) => m.workspace.name).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

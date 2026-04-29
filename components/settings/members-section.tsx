import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { InviteMemberForm } from "./invite-member-form";
import { MemberInviteRowActions } from "./member-invite-row-actions";

/**
 * Workspace-level membership management. Server component that fetches
 * the current memberships + pending invites, then renders the form +
 * tables. Visible to ADMIN and TEAM_MEMBER (filtered upstream by the
 * settings page guard).
 */
export async function MembersSection({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
}) {
  const [memberships, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.invite.findMany({
      where: { workspaceId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: true },
    }),
  ]);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
      <h2 className="app-heading text-lg text-[var(--color-charcoal)]">
        Members
      </h2>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Invite client users into this workspace. They&rsquo;ll get a
        sign-in link and join with the role you choose.
      </p>

      <div className="mt-5">
        <InviteMemberForm workspaceSlug={workspaceSlug} />
      </div>

      {/* ── Existing members ── */}
      <div className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Current members ({memberships.length})
        </h3>
        {memberships.length === 0 ? (
          <p className="mt-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-xs text-[var(--color-muted-foreground)]">
            No one&rsquo;s in this workspace yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
            {memberships.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-[var(--color-charcoal)]">
                    {m.user.name ?? m.user.email}
                  </div>
                  <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                    {m.user.email}
                  </div>
                </div>
                <Badge>{m.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Pending invites ── */}
      {invites.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Pending invites ({invites.length})
          </h3>
          <ul className="mt-2 divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
            {invites.map((inv) => {
              const expired = inv.expiresAt.getTime() < Date.now();
              return (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--color-charcoal)]">
                      {inv.email}
                    </div>
                    <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                      {inv.workspaceRole ?? inv.systemRole} · invited by{" "}
                      {inv.invitedBy.name ?? inv.invitedBy.email} ·{" "}
                      {expired
                        ? "expired"
                        : `expires in ${formatDistanceToNow(inv.expiresAt)}`}
                    </div>
                  </div>
                  <MemberInviteRowActions inviteId={inv.id} />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

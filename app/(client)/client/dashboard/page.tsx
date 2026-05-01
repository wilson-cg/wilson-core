// HIDDEN-V1: client LinkedIn-feed approval surface — disabled per 2026-04-30 client meeting.
// CLIENT users now see the same workspace prospect pipeline as agency staff.
// Keep underlying components and queries (clientHomeData, message-actions,
// post-actions); revive when Plannable replacement is V2.
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function ClientDashboardPage() {
  const user = await requireRole("CLIENT");

  // Find first workspace this CLIENT belongs to and bounce there.
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership?.workspace) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="app-heading text-2xl text-[var(--color-forest)]">
          No workspace yet
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Your client workspace hasn&apos;t been set up. Reach out to the
          Wilson&apos;s team and we&apos;ll get you sorted.
        </p>
      </div>
    );
  }

  redirect(`/dashboard/workspaces/${membership.workspace.slug}/prospects`);
}

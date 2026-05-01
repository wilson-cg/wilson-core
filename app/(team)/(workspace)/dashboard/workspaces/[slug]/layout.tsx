import { notFound } from "next/navigation";
import { requireRole, requireWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  workspaceMembersForModal,
  accessibleWorkspaceIds,
} from "@/lib/queries";
import { permissionsForWorkspace } from "@/lib/permissions";
import { WorkspaceTopBar } from "@/components/workspace/top-bar";

/**
 * Workspace-scoped layout (V1 UX overhaul, 2026-05-01).
 *
 * The cross-workspace sidebar is gone. Inside a workspace we render a top
 * bar with the workspace switcher, members modal trigger, and a tab strip
 * for in-workspace nav. The picker home (app/page.tsx) handles cross-
 * workspace navigation.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  // CLIENT users can render this layout — requireWorkspace below enforces
  // membership-or-admin access. Permission flags gate per-action islands.
  await requireRole("ADMIN", "TEAM_MEMBER", "CLIENT");
  const { slug } = await params;
  const { user, workspace } = await requireWorkspace(slug);
  if (!workspace) notFound();

  const perms = permissionsForWorkspace(user, workspace.id);

  // Sidebar replacement payload — pending count, members list, and every
  // workspace the viewer can see (for the dropdown picker).
  const [pendingMessages, members, accessibleIds] = await Promise.all([
    prisma.message.count({
      where: { workspaceId: workspace.id, status: "PENDING_APPROVAL" },
    }),
    workspaceMembersForModal(workspace.id),
    accessibleWorkspaceIds(user),
  ]);

  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: accessibleIds } },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      accentColor: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <WorkspaceTopBar
        workspace={{
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          logoUrl: workspace.logoUrl,
          accentColor: workspace.accentColor,
        }}
        workspaces={workspaces}
        members={members}
        viewer={{
          name: user.name,
          email: user.email,
          image: null,
          role: user.role,
        }}
        viewerCanAdmin={perms.canAdmin}
        pendingCount={pendingMessages}
      />
      <main>{children}</main>
    </div>
  );
}

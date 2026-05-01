import { prisma } from "@/lib/db";
import { accessibleWorkspaceIds } from "@/lib/queries";
import type { AuthedUser } from "@/lib/auth";
import { WorkspaceSwitcher } from "./workspace-switcher";

/**
 * Server component that loads the workspace list for the picker dropdown,
 * then hands it off to the client-side <WorkspaceSwitcher>. Lives next to
 * the in-workspace top bar so the same dropdown component can be reused
 * in both contexts (no active workspace on the picker; one selected
 * inside a workspace).
 */
export async function PickerHeader({ user }: { user: AuthedUser }) {
  const ids = await accessibleWorkspaceIds(user);
  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: ids } },
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
    <WorkspaceSwitcher
      context="picker"
      viewer={{
        name: user.name,
        email: user.email,
        image: null,
        role: user.role,
      }}
      workspaces={workspaces}
      activeWorkspaceId={null}
    />
  );
}

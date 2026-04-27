import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import type { SystemRole } from "@prisma/client";

/**
 * Stress-test auth — single signed-ish cookie holding a userId. Good enough
 * for clicking through all the flows end-to-end before we commit to Clerk or
 * NextAuth for production.
 *
 * Swap the guts for Clerk/NextAuth when the product ships — the server
 * helpers here (currentUser, requireUser, requireRole, requireWorkspace)
 * are what the pages import, and those signatures stay stable.
 */

const COOKIE_NAME = "wilsons_session";

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function currentUser() {
  const jar = await cookies();
  const userId = jar.get(COOKIE_NAME)?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { workspace: true },
      },
    },
  });
  return user;
}

export type AuthedUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/** Require a signed-in user or redirect to login. */
export async function requireUser(): Promise<AuthedUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require a specific system role or block with a redirect. */
export async function requireRole(...roles: SystemRole[]): Promise<AuthedUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    // Send clients back to their own workspace; send staff back home
    redirect(user.role === "CLIENT" ? "/client/dashboard" : "/dashboard");
  }
  return user;
}

/**
 * Require the current user has access to the given workspace slug and
 * return both the user and the workspace. Core scoping guard — every
 * workspace-scoped page should call this.
 */
export async function requireWorkspace(slug: string) {
  const user = await requireUser();
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    include: {
      memberships: { include: { user: true } },
      icp: true,
    },
  });
  if (!workspace) redirect("/dashboard");

  const membership = user.memberships.find(
    (m) => m.workspaceId === workspace.id
  );

  // Admins get implicit access to every workspace even without a membership row
  if (!membership && user.role !== "ADMIN") {
    redirect(user.role === "CLIENT" ? "/client/dashboard" : "/dashboard");
  }

  return { user, workspace, membership };
}

/** List all users — used by the stress-test login switcher. */
export async function listTestUsers() {
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: {
      memberships: { include: { workspace: true } },
    },
  });
}

import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { sendMagicLinkEmail } from "./email";
import type { Membership, SystemRole, Workspace } from "@prisma/client";

/**
 * Auth.js v5 magic-link auth.
 *
 * - Email-only (Resend provider) — no passwords.
 * - Database sessions (Prisma adapter) so `auth()` returns the live user
 *   row including roles + memberships.
 * - signIn callback gates new sign-ins: unknown emails are rejected unless
 *   a pending Invite row exists for them. This is the only way someone
 *   without an existing User row can sign in.
 * - events.createUser fires once per brand-new account; if a matching
 *   Invite exists we promote them to the right SystemRole and create a
 *   workspace Membership when the invite was workspace-scoped.
 *
 * Stable shims (currentUser / requireUser / requireRole / requireWorkspace)
 * preserve the surface the rest of the app already imports.
 */

type MembershipWithWorkspace = Membership & { workspace: Workspace };

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      role: SystemRole;
      memberships: MembershipWithWorkspace[];
    } & DefaultSession["user"];
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM,
      // Branded magic-link email (matches the approval email style).
      async sendVerificationRequest({ identifier, url, provider }) {
        await sendMagicLinkEmail({
          to: identifier,
          url,
          from: provider.from,
          apiKey: provider.apiKey,
        });
      },
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user?.email?.toLowerCase();
      if (!email) return false;

      // Existing user → always allowed.
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return true;

      // Brand-new email → require a live invite.
      const invite = await prisma.invite.findFirst({
        where: {
          email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      return !!invite;
    },
    async session({ session, user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { memberships: { include: { workspace: true } } },
      });
      if (!dbUser) return session;

      session.user.id = dbUser.id;
      session.user.email = dbUser.email;
      // Display fallbacks: a) user-set name, b) email local-part. The rest
      // of the app calls .split(" ")[0] on this, so it must be non-empty.
      session.user.name = dbUser.name ?? dbUser.email.split("@")[0] ?? "there";
      session.user.role = dbUser.role;
      session.user.memberships = dbUser.memberships;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // First sign-in only. Auth.js calls createUser once when a brand-new
      // User row is provisioned by the adapter.
      const email = user.email?.toLowerCase();
      if (!email || !user.id) return;

      const invite = await prisma.invite.findFirst({
        where: {
          email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        include: { workspaceAccesses: true },
      });
      if (!invite) return;

      const userId = user.id;
      const fallbackName =
        user.name && user.name.trim().length > 0
          ? user.name
          : email.split("@")[0] ?? "Member";

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            role: invite.systemRole,
            name: fallbackName,
          },
        });
        if (invite.workspaceId && invite.workspaceRole) {
          await tx.membership.upsert({
            where: {
              userId_workspaceId: {
                userId,
                workspaceId: invite.workspaceId,
              },
            },
            update: { role: invite.workspaceRole },
            create: {
              userId,
              workspaceId: invite.workspaceId,
              role: invite.workspaceRole,
            },
          });
        }
        // Multi-workspace accesses (from the /dashboard/team flow). Each
        // entry becomes a Membership row. Upsert is idempotent for legacy
        // invites that happened to also set workspaceId — no duplicates.
        for (const access of invite.workspaceAccesses) {
          await tx.membership.upsert({
            where: {
              userId_workspaceId: {
                userId,
                workspaceId: access.workspaceId,
              },
            },
            update: { role: access.workspaceRole },
            create: {
              userId,
              workspaceId: access.workspaceId,
              role: access.workspaceRole,
            },
          });
        }
        await tx.invite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        });
      });
    },
  },
});

/* ─── Stable shims used everywhere else in the app ──────────── */

export type AuthedUser = {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
  memberships: MembershipWithWorkspace[];
};

export async function currentUser(): Promise<AuthedUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? u.email.split("@")[0] ?? "there",
    role: u.role,
    memberships: u.memberships ?? [],
  };
}

export async function requireUser(): Promise<AuthedUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(
  ...roles: SystemRole[]
): Promise<AuthedUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect(user.role === "CLIENT" ? "/client/dashboard" : "/dashboard");
  }
  return user;
}

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

  // Admins get implicit access to every workspace even without a membership row.
  if (!membership && user.role !== "ADMIN") {
    redirect(user.role === "CLIENT" ? "/client/dashboard" : "/dashboard");
  }

  return { user, workspace, membership };
}

/**
 * Compatibility shim — older code imported `clearSession` from here. We keep
 * the export so we don't break call sites; new code should call signOut()
 * from this module directly.
 */
export async function clearSession() {
  await signOut({ redirectTo: "/login" });
}

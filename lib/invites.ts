"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { requireRole, requireWorkspace } from "./auth";
import { sendInviteEmail } from "./email";
import type { SystemRole, WorkspaceRole } from "@prisma/client";

/**
 * Pending invitation lifecycle. createInvite writes a row + sends email.
 * The signIn callback in lib/auth.ts checks for a matching unaccepted
 * row to admit new emails; events.createUser accepts it and creates the
 * Membership when workspace-scoped.
 */

const INVITE_TTL_DAYS = 7;
const APP_URL =
  process.env.AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";

function inviteUrl(token: string): string {
  return `${APP_URL.replace(/\/$/, "")}/invite/${token}`;
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

function newExpiry(): Date {
  return new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
}

const createInviteSchema = z.object({
  email: z.email(),
  systemRole: z.enum(["ADMIN", "TEAM_MEMBER", "CLIENT"]),
  workspaceId: z.string().min(1).optional(),
  workspaceRole: z.enum(["ADMIN", "TEAM_MEMBER", "CLIENT"]).optional(),
  // Multi-workspace access list. Used by the /dashboard/team flow when
  // inviting a TEAM_MEMBER who should already have access to N workspaces
  // on first sign-in. Existing single-workspace invites (workspaceId +
  // workspaceRole above) are unchanged for the workspace settings flow.
  workspaceAccesses: z
    .array(
      z.object({
        workspaceId: z.string().min(1),
        workspaceRole: z.enum(["ADMIN", "TEAM_MEMBER", "CLIENT"]),
      }),
    )
    .optional(),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

/**
 * ADMIN-only path. For TEAM_MEMBER + workspace-scoped invites,
 * inviteToWorkspace() is the right entry point — it takes a slug and
 * authorizes against workspace membership.
 */
export async function createInvite(input: CreateInviteInput) {
  const me = await requireRole("ADMIN");
  return _createInvite(me.id, me.name, input);
}

async function _createInvite(
  invitedById: string,
  inviterName: string | null,
  input: CreateInviteInput
) {
  const parsed = createInviteSchema.parse(input);
  const email = parsed.email.toLowerCase();

  // Workspace consistency check.
  if (parsed.systemRole === "CLIENT" && !parsed.workspaceId) {
    throw new Error("CLIENT invites must be scoped to a workspace.");
  }
  if (parsed.workspaceRole && !parsed.workspaceId) {
    throw new Error("Workspace role given without a workspace.");
  }

  // Block re-inviting an existing user.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error(`A user with ${email} already exists.`);
  }

  let workspaceName: string | null = null;
  if (parsed.workspaceId) {
    const ws = await prisma.workspace.findUnique({
      where: { id: parsed.workspaceId },
    });
    if (!ws) throw new Error("Workspace not found.");
    workspaceName = ws.name;
  }

  // Validate workspaceAccesses (de-dup by workspaceId, confirm each workspace exists).
  const accesses = parsed.workspaceAccesses ?? [];
  const dedupedAccesses = Array.from(
    new Map(accesses.map((a) => [a.workspaceId, a])).values(),
  );
  if (dedupedAccesses.length > 0) {
    const found = await prisma.workspace.findMany({
      where: { id: { in: dedupedAccesses.map((a) => a.workspaceId) } },
      select: { id: true },
    });
    if (found.length !== dedupedAccesses.length) {
      throw new Error("One or more workspace accesses point to missing workspaces.");
    }
  }

  // Drop any existing un-accepted invites for the same email so resends
  // don't pile up duplicates. (Cascades to InviteWorkspaceAccess via FK.)
  await prisma.invite.deleteMany({
    where: { email, acceptedAt: null },
  });

  const token = newToken();
  const invite = await prisma.invite.create({
    data: {
      email,
      token,
      systemRole: parsed.systemRole as SystemRole,
      workspaceId: parsed.workspaceId ?? null,
      workspaceRole: (parsed.workspaceRole as WorkspaceRole | undefined) ?? null,
      invitedById,
      expiresAt: newExpiry(),
      workspaceAccesses: dedupedAccesses.length
        ? {
            create: dedupedAccesses.map((a) => ({
              workspaceId: a.workspaceId,
              workspaceRole: a.workspaceRole as WorkspaceRole,
            })),
          }
        : undefined,
    },
  });

  await sendInviteEmail({
    to: email,
    inviteUrl: inviteUrl(token),
    systemRole: invite.systemRole,
    workspaceName,
    inviterName,
  });

  revalidatePath("/dashboard/team");
  return invite;
}

/**
 * Workspace-scoped invite path: callable by ADMIN or TEAM_MEMBER who has
 * access to the workspace. Always invites as a CLIENT user attached to
 * the given workspace.
 */
export async function inviteToWorkspace(input: {
  workspaceSlug: string;
  email: string;
  workspaceRole: WorkspaceRole;
}) {
  const { user, workspace } = await requireWorkspace(input.workspaceSlug);
  if (user.role !== "ADMIN" && user.role !== "TEAM_MEMBER") {
    throw new Error("Not authorized to invite to this workspace.");
  }

  const invite = await _createInvite(user.id, user.name, {
    email: input.email,
    systemRole: "CLIENT",
    workspaceId: workspace.id,
    workspaceRole: input.workspaceRole,
  });

  revalidatePath(`/dashboard/workspaces/${workspace.slug}/settings`);
  return invite;
}

export async function revokeInvite(inviteId: string) {
  await requireRole("ADMIN", "TEAM_MEMBER");
  await prisma.invite.delete({ where: { id: inviteId } });
  revalidatePath("/dashboard/team");
}

export async function resendInvite(inviteId: string) {
  const me = await requireRole("ADMIN", "TEAM_MEMBER");

  const inv = await prisma.invite.findUniqueOrThrow({
    where: { id: inviteId },
    include: { workspace: true },
  });
  if (inv.acceptedAt) {
    throw new Error("Invite has already been accepted.");
  }

  const token = newToken();
  await prisma.invite.update({
    where: { id: inviteId },
    data: { token, expiresAt: newExpiry() },
  });

  await sendInviteEmail({
    to: inv.email,
    inviteUrl: inviteUrl(token),
    systemRole: inv.systemRole,
    workspaceName: inv.workspace?.name ?? null,
    inviterName: me.name,
  });
  revalidatePath("/dashboard/team");
}

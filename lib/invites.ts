"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { requireRole, requireUser, requireWorkspace } from "./auth";
import { sendInviteEmail } from "./email";
import { defaultFlagsForSystemRole, requirePermission } from "./permissions";
import type { SystemRole, WorkspaceRole } from "@prisma/client";

/**
 * Permission preset bundle used by the Members modal + invite form. Pass
 * undefined to fall back to the system-role default
 * (defaultFlagsForSystemRole).
 */
export type PermissionFlags = {
  canApprove: boolean;
  canEdit: boolean;
  canSend: boolean;
  canAdmin: boolean;
};

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

const permissionFlagsSchema = z.object({
  canApprove: z.boolean(),
  canEdit: z.boolean(),
  canSend: z.boolean(),
  canAdmin: z.boolean(),
});

const createInviteSchema = z.object({
  email: z.email(),
  systemRole: z.enum(["ADMIN", "TEAM_MEMBER", "CLIENT"]),
  workspaceId: z.string().min(1).optional(),
  workspaceRole: z.enum(["ADMIN", "TEAM_MEMBER", "CLIENT"]).optional(),
  // Per-workspace permission preset, applied to the resulting Membership
  // when the invitee accepts. Optional — falls back to
  // defaultFlagsForSystemRole if omitted.
  permissions: permissionFlagsSchema.optional(),
  // Multi-workspace access list. Used by the /dashboard/team flow when
  // inviting a TEAM_MEMBER who should already have access to N workspaces
  // on first sign-in. Existing single-workspace invites (workspaceId +
  // workspaceRole above) are unchanged for the workspace settings flow.
  workspaceAccesses: z
    .array(
      z.object({
        workspaceId: z.string().min(1),
        workspaceRole: z.enum(["ADMIN", "TEAM_MEMBER", "CLIENT"]),
        permissions: permissionFlagsSchema.optional(),
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

  // Permissions: explicit override → fall back to system-role default.
  const inviteFlags =
    parsed.permissions ?? defaultFlagsForSystemRole(parsed.systemRole);

  const token = newToken();
  const invite = await prisma.invite.create({
    data: {
      email,
      token,
      systemRole: parsed.systemRole as SystemRole,
      workspaceId: parsed.workspaceId ?? null,
      workspaceRole: (parsed.workspaceRole as WorkspaceRole | undefined) ?? null,
      canApprove: inviteFlags.canApprove,
      canEdit: inviteFlags.canEdit,
      canSend: inviteFlags.canSend,
      canAdmin: inviteFlags.canAdmin,
      invitedById,
      expiresAt: newExpiry(),
      workspaceAccesses: dedupedAccesses.length
        ? {
            create: dedupedAccesses.map((a) => {
              const accessFlags =
                a.permissions ??
                defaultFlagsForSystemRole(
                  a.workspaceRole === "CLIENT" ? "CLIENT" : "TEAM_MEMBER"
                );
              return {
                workspaceId: a.workspaceId,
                workspaceRole: a.workspaceRole as WorkspaceRole,
                canApprove: accessFlags.canApprove,
                canEdit: accessFlags.canEdit,
                canSend: accessFlags.canSend,
                canAdmin: accessFlags.canAdmin,
              };
            }),
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
 * Workspace-scoped invite path: callable by anyone with `admin` permission
 * in the target workspace (ADMIN system role bypasses).
 *
 * `systemRole` defaults to CLIENT for backwards compatibility — Members
 * modal "Invite as team" sends "TEAM_MEMBER" here.
 *
 * `permissions` is the preset baked into the invite + applied to the
 * resulting Membership. Falls back to defaultFlagsForSystemRole.
 */
export async function inviteToWorkspace(input: {
  workspaceSlug: string;
  email: string;
  workspaceRole: WorkspaceRole;
  systemRole?: SystemRole;
  permissions?: PermissionFlags;
}) {
  const { user, workspace } = await requireWorkspace(input.workspaceSlug);
  // Tightened in V1: requires admin permission (system ADMIN bypasses).
  requirePermission(user, workspace.id, "admin");

  const systemRole: SystemRole = input.systemRole ?? "CLIENT";

  const invite = await _createInvite(user.id, user.name, {
    email: input.email,
    systemRole,
    workspaceId: workspace.id,
    workspaceRole: input.workspaceRole,
    permissions: input.permissions,
  });

  revalidatePath(`/dashboard/workspaces/${workspace.slug}/settings`);
  return invite;
}

export async function revokeInvite(inviteId: string) {
  await requireRole("ADMIN", "TEAM_MEMBER");
  await prisma.invite.delete({ where: { id: inviteId } });
  revalidatePath("/dashboard/team");
}

/* ─── Membership permission management (V1 UX overhaul) ──────── */

/**
 * Update one Membership row's per-action permission flags. Caller must
 * have `admin` permission in the membership's workspace.
 */
export async function updateMembershipPermissions(input: {
  membershipId: string;
  canApprove?: boolean;
  canEdit?: boolean;
  canSend?: boolean;
  canAdmin?: boolean;
  notifyOnApprovalRequested?: boolean;
}) {
  const me = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { id: input.membershipId },
    include: { workspace: { select: { id: true, slug: true } } },
  });
  if (!membership) throw new Error("Membership not found.");
  requirePermission(me, membership.workspace.id, "admin");

  const data: Record<string, boolean> = {};
  if (typeof input.canApprove === "boolean") data.canApprove = input.canApprove;
  if (typeof input.canEdit === "boolean") data.canEdit = input.canEdit;
  if (typeof input.canSend === "boolean") data.canSend = input.canSend;
  if (typeof input.canAdmin === "boolean") data.canAdmin = input.canAdmin;
  if (typeof input.notifyOnApprovalRequested === "boolean")
    data.notifyOnApprovalRequested = input.notifyOnApprovalRequested;

  await prisma.membership.update({
    where: { id: input.membershipId },
    data,
  });

  revalidatePath(`/dashboard/workspaces/${membership.workspace.slug}/settings`);
}

/**
 * Remove a Membership row (revoke workspace access). Caller must have
 * `admin` permission in the workspace. Cannot be used to remove the last
 * admin — UI should show a friendly error.
 */
export async function removeMembership(membershipId: string) {
  const me = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: { workspace: { select: { id: true, slug: true } } },
  });
  if (!membership) throw new Error("Membership not found.");
  requirePermission(me, membership.workspace.id, "admin");

  // Refuse to delete the last canAdmin — would lock everyone out.
  if (membership.canAdmin) {
    const otherAdmins = await prisma.membership.count({
      where: {
        workspaceId: membership.workspace.id,
        canAdmin: true,
        NOT: { id: membershipId },
      },
    });
    if (otherAdmins === 0) {
      throw new Error(
        "Can't remove the last admin from this workspace. Promote another member first."
      );
    }
  }

  await prisma.membership.delete({ where: { id: membershipId } });
  revalidatePath(`/dashboard/workspaces/${membership.workspace.slug}/settings`);
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

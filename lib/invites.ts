"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { requireRole, requireUser, requireWorkspace } from "./auth";
import { sendInviteEmail } from "./email";
import {
  defaultFlagsForSystemRole,
  defaultNotificationFlags,
  permissionPreset,
  requirePermission,
  type NotificationFlagTuple,
  type PermissionPresetName,
} from "./permissions";
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

const notificationFlagsSchema = z.object({
  notifyOnApprovalRequested: z.boolean(),
  notifyOnNewProspect: z.boolean(),
  notifyOnStatusChange: z.boolean(),
  notifyOnComment: z.boolean(),
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
  // Notification preferences baked into the invite + applied to the
  // Membership at acceptance. Optional — falls back to
  // defaultNotificationFlags(preset, systemRole).
  notifications: notificationFlagsSchema.optional(),
  // When false, the invite row is created but no Resend email is sent.
  // The caller (typically Members modal "Create invite link") gets the
  // URL back and copies it to clipboard themselves.
  sendEmail: z.boolean().optional(),
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

  // Notifications: explicit override → fall back to the meeting-context
  // defaults derived from the preset/systemRole combination.
  const presetGuess: PermissionPresetName = inviteFlags.canAdmin
    ? "Administrator"
    : inviteFlags.canSend
    ? "Sender"
    : inviteFlags.canEdit
    ? "Contributor"
    : "Approver";
  const notifications: NotificationFlagTuple =
    parsed.notifications ??
    defaultNotificationFlags({ preset: presetGuess, systemRole: parsed.systemRole });

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
      notifyOnNewProspect: notifications.notifyOnNewProspect,
      notifyOnStatusChange: notifications.notifyOnStatusChange,
      notifyOnComment: notifications.notifyOnComment,
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

  if (parsed.sendEmail !== false) {
    await sendInviteEmail({
      to: email,
      inviteUrl: inviteUrl(token),
      systemRole: invite.systemRole,
      workspaceName,
      inviterName,
    });
  }

  revalidatePath("/dashboard/team");
  return { invite, url: inviteUrl(token) };
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
 *
 * `notifications` is baked into the invite + applied to the Membership at
 * accept time. Falls back to defaultNotificationFlags(preset, systemRole).
 *
 * `sendEmail = false` returns the invite URL without firing Resend — used
 * by the Members modal "Create invite link" affordance so the inviter can
 * paste the link into Slack / a doc / wherever.
 */
export async function inviteToWorkspace(input: {
  workspaceSlug: string;
  email: string;
  workspaceRole: WorkspaceRole;
  systemRole?: SystemRole;
  permissions?: PermissionFlags;
  notifications?: NotificationFlagTuple;
  sendEmail?: boolean;
}) {
  const { user, workspace } = await requireWorkspace(input.workspaceSlug);
  // Tightened in V1: requires admin permission (system ADMIN bypasses).
  requirePermission(user, workspace.id, "admin");

  const systemRole: SystemRole = input.systemRole ?? "CLIENT";

  // Block re-inviting an existing user who is already a member. The base
  // _createInvite function blocks any existing User (anywhere in the
  // system) — but here we ALSO want a friendlier error if they're already
  // in this specific workspace.
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { memberships: { where: { workspaceId: workspace.id } } },
  });
  if (existing && existing.memberships.length > 0) {
    throw new Error(`${input.email} is already a member of this workspace.`);
  }

  const result = await _createInvite(user.id, user.name, {
    email: input.email,
    systemRole,
    workspaceId: workspace.id,
    workspaceRole: input.workspaceRole,
    permissions: input.permissions,
    notifications: input.notifications,
    sendEmail: input.sendEmail,
  });

  revalidatePath(`/dashboard/workspaces/${workspace.slug}/settings`);
  return result;
}

/**
 * Convenience wrapper around inviteToWorkspace with sendEmail=false. Returns
 * just the invite URL so the Members modal can copy-to-clipboard.
 */
export async function createInviteLink(input: {
  workspaceSlug: string;
  email: string;
  workspaceRole: WorkspaceRole;
  systemRole?: SystemRole;
  permissions?: PermissionFlags;
  notifications?: NotificationFlagTuple;
}): Promise<string> {
  const { url } = await inviteToWorkspace({
    ...input,
    sendEmail: false,
  });
  return url;
}

/**
 * Delete a pending Invite. Gated on canAdmin in the invite's workspace
 * (system ADMIN bypasses). Cascades clear any InviteWorkspaceAccess rows.
 */
export async function revokeInvite(inviteId: string) {
  const me = await requireUser();
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: { id: true, workspaceId: true },
  });
  if (!invite) throw new Error("Invite not found.");
  if (invite.workspaceId) {
    requirePermission(me, invite.workspaceId, "admin");
  } else if (me.role !== "ADMIN") {
    // Workspace-less invites (the /dashboard/team flow's TEAM_MEMBER /
    // ADMIN invites) require system ADMIN.
    throw new Error("Only admins can revoke this invite.");
  }
  await prisma.invite.delete({ where: { id: inviteId } });
  revalidatePath("/dashboard/team");
}

/* ─── Membership permission management (V1 UX overhaul) ──────── */

/**
 * Update one Membership row's per-action permission flags. Caller must
 * have `admin` permission in the membership's workspace.
 *
 * Last-admin guard: refuses to drop canAdmin if doing so would leave the
 * workspace with zero canAdmin members. UI mirrors this client-side, but
 * the server check is the source of truth.
 */
export async function updateMembershipPermissions(input: {
  membershipId: string;
  canApprove?: boolean;
  canEdit?: boolean;
  canSend?: boolean;
  canAdmin?: boolean;
}) {
  const me = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { id: input.membershipId },
    include: { workspace: { select: { id: true, slug: true } } },
  });
  if (!membership) throw new Error("Membership not found.");
  requirePermission(me, membership.workspace.id, "admin");

  // Last-admin guard: only check when canAdmin is being TURNED OFF on a
  // membership that currently has it.
  if (input.canAdmin === false && membership.canAdmin) {
    const otherAdmins = await prisma.membership.count({
      where: {
        workspaceId: membership.workspace.id,
        canAdmin: true,
        NOT: { id: membership.id },
      },
    });
    if (otherAdmins === 0) {
      throw new Error(
        "At least one administrator must remain in the workspace."
      );
    }
  }

  const data: Record<string, boolean> = {};
  if (typeof input.canApprove === "boolean") data.canApprove = input.canApprove;
  if (typeof input.canEdit === "boolean") data.canEdit = input.canEdit;
  if (typeof input.canSend === "boolean") data.canSend = input.canSend;
  if (typeof input.canAdmin === "boolean") data.canAdmin = input.canAdmin;

  await prisma.membership.update({
    where: { id: input.membershipId },
    data,
  });

  revalidatePath(`/dashboard/workspaces/${membership.workspace.slug}/settings`);
}

/**
 * Update notification preferences on one Membership row.
 *
 * Gating: admins (canAdmin in this workspace) can edit anyone's row.
 * Non-admins can only edit their OWN row (membership.userId === me.id).
 */
export async function updateMembershipNotifications(input: {
  membershipId: string;
  notifyOnApprovalRequested?: boolean;
  notifyOnNewProspect?: boolean;
  notifyOnStatusChange?: boolean;
  notifyOnComment?: boolean;
}) {
  const me = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { id: input.membershipId },
    include: { workspace: { select: { id: true, slug: true } } },
  });
  if (!membership) throw new Error("Membership not found.");

  const isAdmin =
    me.role === "ADMIN" ||
    me.memberships.find(
      (m) => m.workspaceId === membership.workspace.id
    )?.canAdmin === true;
  const isOwnRow = membership.userId === me.id;

  if (!isAdmin && !isOwnRow) {
    throw new Error("You can only edit your own notification preferences.");
  }

  const data: Record<string, boolean> = {};
  if (typeof input.notifyOnApprovalRequested === "boolean")
    data.notifyOnApprovalRequested = input.notifyOnApprovalRequested;
  if (typeof input.notifyOnNewProspect === "boolean")
    data.notifyOnNewProspect = input.notifyOnNewProspect;
  if (typeof input.notifyOnStatusChange === "boolean")
    data.notifyOnStatusChange = input.notifyOnStatusChange;
  if (typeof input.notifyOnComment === "boolean")
    data.notifyOnComment = input.notifyOnComment;

  await prisma.membership.update({
    where: { id: input.membershipId },
    data,
  });

  revalidatePath(`/dashboard/workspaces/${membership.workspace.slug}/settings`);
}

/**
 * Email-prefix search for the Invite tab autocomplete. Returns up to 8
 * Users whose email starts with the query, EXCLUDING any user already in
 * the target workspace (so the form can show "Already a member" instead
 * of accidentally re-inviting them).
 *
 * Caller needs `admin` permission in the workspace.
 */
export async function searchExistingUsers(input: {
  workspaceSlug: string;
  query: string;
}): Promise<Array<{ id: string; email: string; name: string | null; image: string | null; alreadyInWorkspace: boolean }>> {
  const { user, workspace } = await requireWorkspace(input.workspaceSlug);
  requirePermission(user, workspace.id, "admin");

  const q = input.query.trim().toLowerCase();
  if (q.length < 2) return [];

  const matches = await prisma.user.findMany({
    where: {
      email: { startsWith: q, mode: "insensitive" },
    },
    take: 8,
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      memberships: {
        where: { workspaceId: workspace.id },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { email: "asc" },
  });

  return matches.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    alreadyInWorkspace: u.memberships.length > 0,
  }));
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

/**
 * Refresh an Invite's token + expiry and re-send the email. Gated on
 * canAdmin in the invite's workspace (system ADMIN bypasses).
 */
export async function resendInvite(inviteId: string) {
  const me = await requireUser();
  const inv = await prisma.invite.findUniqueOrThrow({
    where: { id: inviteId },
    include: { workspace: true },
  });
  if (inv.acceptedAt) {
    throw new Error("Invite has already been accepted.");
  }
  if (inv.workspaceId) {
    requirePermission(me, inv.workspaceId, "admin");
  } else if (me.role !== "ADMIN") {
    throw new Error("Only admins can resend this invite.");
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
  if (inv.workspace) {
    revalidatePath(`/dashboard/workspaces/${inv.workspace.slug}/settings`);
  }
}

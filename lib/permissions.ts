import type { AuthedUser } from "./auth";

/**
 * Per-action permission helpers (V1 UX overhaul).
 *
 * canView is implicit — every Membership row implies View access.
 * Other actions are gated on the four boolean flags on Membership.
 *
 * System ADMIN bypasses all checks: ADMINs implicitly have full access to
 * every workspace whether or not they have a Membership row, and even if
 * the Membership row's flags are all false (e.g. an ADMIN got demoted on a
 * specific workspace but their system role still allows everything).
 */
export type WorkspaceAction = "view" | "approve" | "edit" | "send" | "admin";

export function canPerformInWorkspace(
  user: AuthedUser,
  workspaceId: string,
  action: WorkspaceAction
): boolean {
  if (user.role === "ADMIN") return true;
  const m = user.memberships.find((x) => x.workspaceId === workspaceId);
  if (!m) return false;
  if (action === "view") return true;
  if (action === "approve") return m.canApprove;
  if (action === "edit") return m.canEdit;
  if (action === "send") return m.canSend;
  if (action === "admin") return m.canAdmin;
  return false;
}

/**
 * Throwing variant for server actions. Always throws a user-friendly Error
 * — server actions return the message verbatim to the client island so the
 * toast / inline error surface gets the right text.
 */
export function requirePermission(
  user: AuthedUser,
  workspaceId: string,
  action: WorkspaceAction
): void {
  if (!canPerformInWorkspace(user, workspaceId, action)) {
    throw new Error(`You don't have permission to ${action} in this workspace.`);
  }
}

/**
 * Convenience snapshot of all four flags for a workspace. Used by client
 * islands (Kanban, IcpWidget, DecisionRadio) so they can disable controls
 * pre-emptively instead of waiting for a server-side throw.
 */
export type WorkspacePermissions = {
  canView: boolean;
  canApprove: boolean;
  canEdit: boolean;
  canSend: boolean;
  canAdmin: boolean;
};

export function permissionsForWorkspace(
  user: AuthedUser,
  workspaceId: string
): WorkspacePermissions {
  if (user.role === "ADMIN") {
    return {
      canView: true,
      canApprove: true,
      canEdit: true,
      canSend: true,
      canAdmin: true,
    };
  }
  const m = user.memberships.find((x) => x.workspaceId === workspaceId);
  if (!m) {
    return {
      canView: false,
      canApprove: false,
      canEdit: false,
      canSend: false,
      canAdmin: false,
    };
  }
  return {
    canView: true,
    canApprove: m.canApprove,
    canEdit: m.canEdit,
    canSend: m.canSend,
    canAdmin: m.canAdmin,
  };
}

/**
 * Default permission preset for a system role. Used by inviteToWorkspace
 * and the Members modal "preset" dropdown.
 *
 *   • ADMIN / TEAM_MEMBER → full access (view+approve+edit+send+admin)
 *   • CLIENT              → view+approve only
 */
export function defaultFlagsForSystemRole(systemRole: "ADMIN" | "TEAM_MEMBER" | "CLIENT") {
  if (systemRole === "ADMIN" || systemRole === "TEAM_MEMBER") {
    return {
      canApprove: true,
      canEdit: true,
      canSend: true,
      canAdmin: true,
    };
  }
  return {
    canApprove: true,
    canEdit: false,
    canSend: false,
    canAdmin: false,
  };
}

/**
 * Plannable-style permission presets used by the Members modal Invite tab.
 * Maps a preset name -> the boolean tuple. The five presets (Approver,
 * Contributor, Sender, Administrator, Custom) cover every combo Wilson's
 * needs at V1. Custom returns null so the UI can render the Permissions
 * matrix and let the user tick exactly what they want.
 */
export type PermissionPresetName =
  | "Approver"
  | "Contributor"
  | "Sender"
  | "Administrator"
  | "Custom";

export type PermissionFlagTuple = {
  canApprove: boolean;
  canEdit: boolean;
  canSend: boolean;
  canAdmin: boolean;
};

export function permissionPreset(
  name: PermissionPresetName
): PermissionFlagTuple | null {
  switch (name) {
    case "Approver":
      return { canApprove: true, canEdit: false, canSend: false, canAdmin: false };
    case "Contributor":
      return { canApprove: true, canEdit: true, canSend: false, canAdmin: false };
    case "Sender":
      return { canApprove: true, canEdit: true, canSend: true, canAdmin: false };
    case "Administrator":
      return { canApprove: true, canEdit: true, canSend: true, canAdmin: true };
    case "Custom":
      return null;
  }
}

/**
 * Reverse lookup: given a Membership's flag combination + isWorkspaceOwner,
 * derive the human-readable role label shown on the right of every member
 * row. Owner shadows the matrix — a Membership with isWorkspaceOwner=true
 * always reads "Company Owner" regardless of how its other flags are set.
 */
export function derivePermissionLabel(m: {
  isWorkspaceOwner?: boolean;
  canApprove: boolean;
  canEdit: boolean;
  canSend: boolean;
  canAdmin: boolean;
}): string {
  if (m.isWorkspaceOwner) return "Company Owner";
  if (m.canAdmin) return "Administrator";
  if (m.canSend && m.canEdit && m.canApprove) return "Sender";
  if (m.canEdit && m.canApprove) return "Contributor";
  if (m.canApprove && !m.canEdit && !m.canSend && !m.canAdmin) return "Approver";
  return "Custom";
}

/**
 * Notification-flags tuple — defaults applied at invite-creation time so the
 * Membership row born on accept already reflects the meeting context.
 *
 *   • Approver / CLIENT systemRole -> approvals only
 *   • Everything else (Contributor / Sender / Administrator / Team)
 *     -> all four flags true (V1 default; user can tune in the
 *     Notifications tab afterwards).
 */
export type NotificationFlagTuple = {
  notifyOnApprovalRequested: boolean;
  notifyOnNewProspect: boolean;
  notifyOnStatusChange: boolean;
  notifyOnComment: boolean;
};

export function defaultNotificationFlags(opts: {
  preset: PermissionPresetName;
  systemRole: "ADMIN" | "TEAM_MEMBER" | "CLIENT";
}): NotificationFlagTuple {
  const approverOnly =
    opts.preset === "Approver" || opts.systemRole === "CLIENT";
  if (approverOnly) {
    return {
      notifyOnApprovalRequested: true,
      notifyOnNewProspect: false,
      notifyOnStatusChange: false,
      notifyOnComment: false,
    };
  }
  return {
    notifyOnApprovalRequested: true,
    notifyOnNewProspect: true,
    notifyOnStatusChange: true,
    notifyOnComment: true,
  };
}

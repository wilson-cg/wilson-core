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

-- Notification preferences expansion + workspace-owner flag.
-- Plan #1, Workspace Sharing V1 (2026-05-01).
--
-- Adds three new notification booleans (mirrored across Membership, Invite,
-- InviteWorkspaceAccess) so the Notifications tab can store per-event
-- preferences (new prospect / status change / comment). The existing
-- notifyOnApprovalRequested column stays as the fourth row in the matrix.
--
-- Adds isWorkspaceOwner on Membership only (Invite has no owner concept;
-- ownership is set when the workspace is provisioned). Backfilled to the
-- earliest ADMIN-system-role membership per workspace -- handles existing
-- Joe / Graham / Richard workspaces seeded by seed-v2.

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "notifyOnComment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyOnNewProspect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyOnStatusChange" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InviteWorkspaceAccess" ADD COLUMN     "notifyOnComment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyOnNewProspect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyOnStatusChange" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "isWorkspaceOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyOnComment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyOnNewProspect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyOnStatusChange" BOOLEAN NOT NULL DEFAULT false;

-- Backfill isWorkspaceOwner: for each workspace, the earliest Membership row
-- (by Membership.createdAt) whose User has system role 'ADMIN' becomes the
-- Company Owner. Workspaces without any ADMIN membership are skipped (no
-- owner; defensive — shouldn't happen in current seed but won't error).
UPDATE "Membership" m
SET    "isWorkspaceOwner" = true
WHERE  m."id" IN (
  SELECT DISTINCT ON (mm."workspaceId") mm."id"
  FROM   "Membership" mm
  JOIN   "User" uu ON uu."id" = mm."userId"
  WHERE  uu."role" = 'ADMIN'
  ORDER  BY mm."workspaceId", mm."createdAt" ASC
);

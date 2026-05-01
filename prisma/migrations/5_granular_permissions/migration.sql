-- Granular per-action permissions on Membership + Invite + InviteWorkspaceAccess.
-- V1 UX overhaul (2026-05-01).
--
-- canView is implicit: every Membership row implies View access, no column.
-- Backfill rules per the V1 meeting notes:
--   - Memberships where User.role = ADMIN OR TEAM_MEMBER -> all four flags true
--   - Memberships where User.role = CLIENT               -> canApprove only
--   - Pending Invite/InviteWorkspaceAccess rows          -> same rule keyed on
--     Invite.systemRole that will be applied at acceptance time.
--
-- notifyOnApprovalRequested defaults true on the column (DDL below) -- no
-- explicit backfill needed for existing rows because the default applies.

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "canAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canApprove" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canEdit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canSend" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InviteWorkspaceAccess" ADD COLUMN     "canAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canApprove" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canEdit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canSend" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "canAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canApprove" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canEdit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canSend" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyOnApprovalRequested" BOOLEAN NOT NULL DEFAULT true;

-- Backfill Membership rows
UPDATE "Membership" m
SET    "canApprove" = true,
       "canEdit"    = true,
       "canSend"    = true,
       "canAdmin"   = true
FROM   "User" u
WHERE  m."userId" = u."id"
  AND  u."role" IN ('ADMIN', 'TEAM_MEMBER');

UPDATE "Membership" m
SET    "canApprove" = true,
       "canEdit"    = false,
       "canSend"    = false,
       "canAdmin"   = false
FROM   "User" u
WHERE  m."userId" = u."id"
  AND  u."role" = 'CLIENT';

-- Backfill pending Invite rows
UPDATE "Invite"
SET    "canApprove" = true,
       "canEdit"    = true,
       "canSend"    = true,
       "canAdmin"   = true
WHERE  "systemRole" IN ('ADMIN', 'TEAM_MEMBER')
  AND  "acceptedAt" IS NULL;

UPDATE "Invite"
SET    "canApprove" = true,
       "canEdit"    = false,
       "canSend"    = false,
       "canAdmin"   = false
WHERE  "systemRole" = 'CLIENT'
  AND  "acceptedAt" IS NULL;

-- Backfill pending InviteWorkspaceAccess rows
UPDATE "InviteWorkspaceAccess" iwa
SET    "canApprove" = true,
       "canEdit"    = true,
       "canSend"    = true,
       "canAdmin"   = true
FROM   "Invite" i
WHERE  iwa."inviteId" = i."id"
  AND  i."systemRole" IN ('ADMIN', 'TEAM_MEMBER')
  AND  i."acceptedAt" IS NULL;

UPDATE "InviteWorkspaceAccess" iwa
SET    "canApprove" = true,
       "canEdit"    = false,
       "canSend"    = false,
       "canAdmin"   = false
FROM   "Invite" i
WHERE  iwa."inviteId" = i."id"
  AND  i."systemRole" = 'CLIENT'
  AND  i."acceptedAt" IS NULL;

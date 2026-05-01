-- V1 intent-tracking pivot (2026-04-30 client meeting)
-- Adds intent-tracking columns (signal type, ICP toggles, approver decision,
-- archived) and a new ProspectStatus stage. Backfills existing prospects'
-- ICP booleans from the old fitScore enum, then drops fitScore + FitScore.

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('REACTION', 'COMMENT', 'CONNECTION_REQUEST', 'POST', 'REPEATED_ENGAGEMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ApproverDecision" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterEnum
ALTER TYPE "ProspectStatus" ADD VALUE 'NEEDS_APPROVER_DECISION';

-- AlterTable: add new columns first so the backfill can read the old fitScore.
ALTER TABLE "Prospect"
  ADD COLUMN "approverDecision" "ApproverDecision" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "approverNotes" TEXT,
  ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "icpCompanyFit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "icpContextFit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "icpGeographyFit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "icpScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "icpSeniorityFit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "messageAngle" TEXT,
  ADD COLUMN "signalContext" TEXT,
  ADD COLUMN "signalType" "SignalType";

-- Backfill: STRONG → all 4 ICP true (icpScore=4), POSSIBLE → company+seniority true (icpScore=2), NOT_A_FIT → all false.
UPDATE "Prospect" SET
  "icpCompanyFit"   = ("fitScore" = 'STRONG' OR "fitScore" = 'POSSIBLE'),
  "icpSeniorityFit" = ("fitScore" = 'STRONG' OR "fitScore" = 'POSSIBLE'),
  "icpContextFit"   = ("fitScore" = 'STRONG'),
  "icpGeographyFit" = ("fitScore" = 'STRONG'),
  "icpScore" = CASE
    WHEN "fitScore" = 'STRONG' THEN 4
    WHEN "fitScore" = 'POSSIBLE' THEN 2
    ELSE 0
  END;

-- AlterTable: now drop the old fitScore column.
ALTER TABLE "Prospect" DROP COLUMN "fitScore";

-- DropEnum
DROP TYPE "FitScore";

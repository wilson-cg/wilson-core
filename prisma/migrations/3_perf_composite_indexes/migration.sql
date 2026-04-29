-- Composite indexes that match the hot-path WHERE/orderBy patterns in
-- lib/queries.ts and lib/actions.ts. CONCURRENTLY isn't used because
-- Prisma migrations run inside a transaction; if the indexes are slow to
-- build on a large existing dataset, run these manually outside the
-- migration with `CREATE INDEX CONCURRENTLY` first, then mark this
-- migration as applied with `prisma migrate resolve`.

-- Membership: list workspace members by role (settings page, team page).
CREATE INDEX "Membership_workspaceId_role_idx" ON "Membership"("workspaceId", "role");

-- Prospect: kanban + table by stage, recent first.
CREATE INDEX "Prospect_workspaceId_status_updatedAt_idx" ON "Prospect"("workspaceId", "status", "updatedAt");

-- ProspectEvent: per-prospect activity timeline ordered by occurredAt.
CREATE INDEX "ProspectEvent_prospectId_occurredAt_idx" ON "ProspectEvent"("prospectId", "occurredAt");

-- Message: dashboard summaries (status counts) + activity windows.
CREATE INDEX "Message_workspaceId_status_updatedAt_idx" ON "Message"("workspaceId", "status", "updatedAt");
CREATE INDEX "Message_workspaceId_createdAt_idx" ON "Message"("workspaceId", "createdAt");
CREATE INDEX "Message_workspaceId_approvedAt_idx" ON "Message"("workspaceId", "approvedAt");
CREATE INDEX "Message_workspaceId_sentAt_idx" ON "Message"("workspaceId", "sentAt");
CREATE INDEX "Message_workspaceId_repliedAt_idx" ON "Message"("workspaceId", "repliedAt");

-- MessageEvent: recent activity feed (filter by eventType, sort by createdAt).
CREATE INDEX "MessageEvent_workspaceId_eventType_createdAt_idx" ON "MessageEvent"("workspaceId", "eventType", "createdAt");

-- Post: content kanban + list by stage, plus posted-at queries.
CREATE INDEX "Post_workspaceId_status_updatedAt_idx" ON "Post"("workspaceId", "status", "updatedAt");
CREATE INDEX "Post_workspaceId_postedAt_idx" ON "Post"("workspaceId", "postedAt");

-- PostEvent: activity feed.
CREATE INDEX "PostEvent_workspaceId_eventType_createdAt_idx" ON "PostEvent"("workspaceId", "eventType", "createdAt");

-- ClientContact: primary contact lookup ordered by createdAt for stable picks.
CREATE INDEX "ClientContact_workspaceId_isPrimary_createdAt_idx" ON "ClientContact"("workspaceId", "isPrimary", "createdAt");

-- OnboardingResponse: ordered by orderIndex when listing a workspace's questions.
CREATE INDEX "OnboardingResponse_workspaceId_orderIndex_idx" ON "OnboardingResponse"("workspaceId", "orderIndex");

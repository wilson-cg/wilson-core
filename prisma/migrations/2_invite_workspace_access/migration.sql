-- CreateTable
CREATE TABLE "InviteWorkspaceAccess" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceRole" "WorkspaceRole" NOT NULL,

    CONSTRAINT "InviteWorkspaceAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InviteWorkspaceAccess_inviteId_idx" ON "InviteWorkspaceAccess"("inviteId");

-- CreateIndex
CREATE INDEX "InviteWorkspaceAccess_workspaceId_idx" ON "InviteWorkspaceAccess"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteWorkspaceAccess_inviteId_workspaceId_key" ON "InviteWorkspaceAccess"("inviteId", "workspaceId");

-- AddForeignKey
ALTER TABLE "InviteWorkspaceAccess" ADD CONSTRAINT "InviteWorkspaceAccess_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteWorkspaceAccess" ADD CONSTRAINT "InviteWorkspaceAccess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


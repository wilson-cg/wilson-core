import Link from "next/link";
import { requireRole, requireWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import { NewPostWorkbench } from "./new-post-workbench";

export default async function NewPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireRole("ADMIN", "TEAM_MEMBER");
  const { slug } = await params;
  const { workspace } = await requireWorkspace(slug);

  // Pull the primary contact so the LinkedIn preview shows the right
  // author in the new-post flow (matches the post-detail behaviour).
  const primaryContact = await prisma.clientContact.findFirst({
    where: { workspaceId: workspace.id, isPrimary: true },
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <Link
          href={`/dashboard/workspaces/${slug}/content`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> Content
        </Link>
        <h1 className="app-heading mt-2 text-2xl text-[var(--color-charcoal)]">
          New post
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Drafting for {workspace.name} ·{" "}
          {primaryContact?.fullName ?? workspace.contactName}&apos;s LinkedIn feed
        </p>
      </header>

      <div className="px-6 py-6 lg:px-8">
        <NewPostWorkbench
          slug={slug}
          workspaceName={workspace.name}
          workspaceLogoUrl={workspace.logoUrl}
          workspaceAccentColor={workspace.accentColor}
          contactName={primaryContact?.fullName ?? workspace.contactName}
          contactTitle={primaryContact?.title ?? null}
        />
      </div>
    </div>
  );
}

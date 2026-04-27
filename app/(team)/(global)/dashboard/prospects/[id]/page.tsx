import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";

/**
 * Legacy path — prospect detail now lives under the workspace-scoped tree.
 * Look up the workspace slug from the prospect id and forward.
 */
export default async function LegacyProspectRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: { workspace: { select: { slug: true } } },
  });
  if (!prospect) notFound();
  redirect(`/dashboard/workspaces/${prospect.workspace.slug}/prospects/${id}`);
}

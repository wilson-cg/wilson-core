// HIDDEN-V1: content posts surface — disabled per 2026-04-30 client meeting. Keep code; revive when Plannable replacement is V2.
import { redirect } from "next/navigation";

export default async function HiddenContentIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/dashboard/workspaces/${slug}/prospects`);
}

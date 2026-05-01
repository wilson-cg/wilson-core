import { requireUser } from "@/lib/auth";

/**
 * Auth guard only. Route groups `(global)` and `(workspace)` provide the
 * actual sidebar/top-bar chrome and tighten role enforcement. The picker
 * home (V1 UX overhaul) lets CLIENTs navigate INTO their workspace too,
 * so we only require a signed-in user here.
 */
export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <>{children}</>;
}

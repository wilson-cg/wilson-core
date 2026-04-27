import { requireRole } from "@/lib/auth";

/**
 * Auth guard only. Route groups `(global)` and `(workspace)` provide the
 * actual sidebar chrome — they each render their own layout.
 */
export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("ADMIN", "TEAM_MEMBER");
  return <>{children}</>;
}

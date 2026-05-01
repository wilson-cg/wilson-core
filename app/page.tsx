import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

/**
 * Root redirect. No marketing page — this is a stress-test app.
 *   - Not signed in → /login
 *   - Client         → /client/dashboard
 *   - Team/Admin     → /dashboard
 */
export default async function RootPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  redirect(user.role === "CLIENT" ? "/client/dashboard" : "/dashboard");
}

import { revalidatePath } from "next/cache";

/**
 * Centralized revalidation helpers. Every server action calls one of
 * these instead of inline `revalidatePath(...)` so the blast radius for
 * each kind of mutation is in one place. When in doubt, prefer the
 * narrowest helper that covers the surface the user is actually on.
 *
 * Reference points (each helper documents which surfaces show the data):
 *
 *   /dashboard                       — team home: workspace cards (pending count,
 *                                      last activity, contact name, logo)
 *   /dashboard/approvals             — cross-workspace approval queue (messages + posts)
 *   /dashboard/audit                 — admin audit log
 *   /dashboard/notifications         — notification outbox
 *   /dashboard/team                  — admin user/invite management
 *   /dashboard/workspaces/[slug]     — workspace home (sidebar counts)
 *   /dashboard/workspaces/[slug]/content   — content kanban / list
 *   /dashboard/workspaces/[slug]/prospects — prospect kanban / table
 *   /dashboard/workspaces/[slug]/prospects/[id]
 *   /dashboard/workspaces/[slug]/settings  — profile / contacts / onboarding / team
 *   /client/dashboard                — client home: pending post + message queue,
 *                                      recent posts, metrics
 *   /client/settings                 — client-side mirror of profile/contacts/onboarding
 *   /approve/[token]                 — public approval page (token-scoped)
 */

/* ─── Workspace-scoped surfaces ───────────────────────────────── */

export function revalidateWorkspaceContent(slug: string) {
  revalidatePath(`/dashboard/workspaces/${slug}/content`);
}

export function revalidateWorkspaceProspects(slug: string) {
  revalidatePath(`/dashboard/workspaces/${slug}/prospects`);
}

export function revalidateWorkspaceProspectDetail(slug: string, id: string) {
  revalidatePath(`/dashboard/workspaces/${slug}/prospects/${id}`);
}

export function revalidateWorkspaceSettings(slug: string) {
  revalidatePath(`/dashboard/workspaces/${slug}/settings`);
}

/* ─── Cross-workspace surfaces ────────────────────────────────── */

export function revalidateTeamHome() {
  revalidatePath("/dashboard");
}

export function revalidateApprovals() {
  revalidatePath("/dashboard/approvals");
}

/* ─── Client-side surfaces ────────────────────────────────────── */

export function revalidateClientHome() {
  revalidatePath("/client/dashboard");
}

export function revalidateClientSettings() {
  revalidatePath("/client/settings");
}

/* ─── Public token surfaces ───────────────────────────────────── */

export function revalidateApproveToken(token: string) {
  revalidatePath(`/approve/${token}`);
}

export function revalidateOnboardToken(token: string) {
  revalidatePath(`/onboard/${token}`);
}

/* ─── Composite helpers ───────────────────────────────────────── */

/**
 * A post / message moved through an approval state (submit, approve,
 * edit-and-approve, reject, sent, replied, meeting-booked, posted).
 * Refreshes every surface that displays that state.
 */
export function revalidatePostApprovalChange(slug: string) {
  revalidatePath(`/dashboard/workspaces/${slug}/content`);
  revalidatePath("/dashboard/approvals");
  revalidatePath("/client/dashboard");
}

export function revalidateMessageApprovalChange(slug: string, prospectId: string) {
  revalidatePath(`/dashboard/workspaces/${slug}/prospects/${prospectId}`);
  revalidatePath(`/dashboard/workspaces/${slug}/prospects`);
  revalidatePath("/dashboard/approvals");
  revalidatePath("/client/dashboard");
}

/**
 * A workspace was created, renamed, branded, or deleted. Refreshes the
 * team home (workspace cards) and the client surfaces that mirror the
 * workspace name/logo.
 */
export function revalidateWorkspaceIdentity(slug: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/workspaces/${slug}`);
  revalidatePath("/client/dashboard");
  revalidatePath("/client/settings");
}

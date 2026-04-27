"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { requireUser, requireWorkspace } from "./auth";
import { sendApprovalEmail, type ApprovalEmailOptions } from "./email";

/**
 * All server actions for the Wilson's portal. Each one:
 *   1. Re-authenticates the caller via requireUser / requireWorkspace
 *   2. Validates input with zod
 *   3. Writes the state change + MessageEvent in the same transaction
 *   4. Revalidates the affected paths
 */

/* ─── Prospect actions ───────────────────────────────────────── */

const addProspectSchema = z.object({
  workspaceSlug: z.string().min(1),
  fullName: z.string().min(2),
  company: z.string().min(1),
  title: z.string().optional(),
  linkedinUrl: z.string().url().or(z.literal("")).optional(),
  fitScore: z.enum(["STRONG", "POSSIBLE", "NOT_A_FIT"]).default("POSSIBLE"),
  notes: z.string().optional(),
});

export async function addProspect(formData: FormData) {
  const parsed = addProspectSchema.parse({
    workspaceSlug: formData.get("workspaceSlug"),
    fullName: formData.get("fullName"),
    company: formData.get("company"),
    title: formData.get("title") || undefined,
    linkedinUrl: formData.get("linkedinUrl") || "",
    fitScore: formData.get("fitScore") || "POSSIBLE",
    notes: formData.get("notes") || undefined,
  });

  const { user, workspace } = await requireWorkspace(parsed.workspaceSlug);
  if (user.role === "CLIENT") redirect("/client/dashboard");

  await prisma.prospect.create({
    data: {
      workspaceId: workspace.id,
      assigneeId: user.id,
      fullName: parsed.fullName,
      company: parsed.company,
      title: parsed.title,
      linkedinUrl:
        parsed.linkedinUrl ||
        `https://linkedin.com/in/${parsed.fullName.toLowerCase().replace(/[^a-z]/g, "-")}`,
      fitScore: parsed.fitScore,
      notes: parsed.notes,
      status: "IDENTIFIED",
    },
  });

  revalidatePath(`/dashboard/workspaces/${workspace.slug}/prospects`);
  redirect(`/dashboard/workspaces/${workspace.slug}/prospects`);
}

/* ─── Prospect status forward-only helper ────────────────────
 *
 * Linear pipeline order. Drafting a FOLLOW-UP message to a REPLIED prospect
 * shouldn't drag them back to MESSAGE_DRAFTED — we only ever advance
 * prospect.status forward through this order. Off-ramp statuses (NOT_INTERESTED,
 * NURTURE) and MEETING_BOOKED are handled by explicit user actions, not
 * synced from message workflow.
 */
const PROSPECT_STAGE_ORDER = [
  "IDENTIFIED",
  "MESSAGE_DRAFTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "REPLIED",
  "MEETING_BOOKED",
] as const;

function shouldAdvance(current: string, candidate: string): boolean {
  const ci = PROSPECT_STAGE_ORDER.indexOf(current as never);
  const ti = PROSPECT_STAGE_ORDER.indexOf(candidate as never);
  if (ci === -1 || ti === -1) return false;
  return ti > ci;
}

/**
 * Pick the approval-notification recipient for a workspace. Priority:
 *   1. workspace.approvalEmail (explicit override on the workspace settings)
 *   2. Primary ClientContact's email
 *   3. First CLIENT user attached to the workspace
 */
type WorkspaceForApproval = {
  approvalEmail: string | null;
  contacts?: { email: string | null }[];
  memberships?: { user: { email: string } }[];
};
function pickApprovalRecipient(workspace: WorkspaceForApproval): string | null {
  if (workspace.approvalEmail && workspace.approvalEmail.trim() !== "") {
    return workspace.approvalEmail;
  }
  const primary = workspace.contacts?.find((c) => c.email);
  if (primary?.email) return primary.email;
  const fallback = workspace.memberships?.[0]?.user.email;
  return fallback ?? null;
}

/**
 * Send the approval email via Resend (post-transaction) and update the
 * Notification row's status. Errors never bubble — the underlying action
 * already committed; failed delivery is logged + recorded as FAILED so
 * the team can see it in the outbox.
 *
 * If RESEND_API_KEY isn't configured, the notification stays QUEUED so
 * it can be retried later when the env var is added.
 */
async function dispatchApprovalEmail(
  notificationId: string,
  opts: ApprovalEmailOptions
): Promise<void> {
  const result = await sendApprovalEmail(opts);

  try {
    if (result.ok) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "SENT", sentAt: new Date() },
      });
    } else if ("skipped" in result && result.skipped) {
      // No API key — leave QUEUED so a later deploy can retry.
      console.log(
        "[email] skipped (no RESEND_API_KEY) — notification stays QUEUED"
      );
    } else {
      console.error("[email] send failed:", result.error);
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "FAILED" },
      });
    }
  } catch (e) {
    console.error("[email] notification status update failed:", e);
  }
}

/* ─── Message drafting ───────────────────────────────────────── */

const draftMessageSchema = z.object({
  prospectId: z.string().min(1),
  body: z.string().min(10, "Draft must be at least 10 characters"),
});

export async function draftMessage(formData: FormData) {
  const parsed = draftMessageSchema.parse({
    prospectId: formData.get("prospectId"),
    body: formData.get("body"),
  });

  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot draft messages");

  const prospect = await prisma.prospect.findUnique({
    where: { id: parsed.prospectId },
  });
  if (!prospect) throw new Error("Prospect not found");

  await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        workspaceId: prospect.workspaceId,
        prospectId: prospect.id,
        drafterId: user.id,
        body: parsed.body,
        status: "DRAFT",
      },
    });
    await tx.messageEvent.create({
      data: {
        messageId: message.id,
        workspaceId: prospect.workspaceId,
        actorId: user.id,
        eventType: "DRAFTED",
      },
    });
    if (shouldAdvance(prospect.status, "MESSAGE_DRAFTED")) {
      await tx.prospect.update({
        where: { id: prospect.id },
        data: { status: "MESSAGE_DRAFTED" },
      });
    }
  });

  revalidatePath(`/dashboard/workspaces`);
}

export async function updateDraft(formData: FormData) {
  const schema = z.object({
    messageId: z.string().min(1),
    body: z.string().min(10),
  });
  const { messageId, body } = schema.parse({
    messageId: formData.get("messageId"),
    body: formData.get("body"),
  });

  const user = await requireUser();
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.status !== "DRAFT") {
    throw new Error("Message not editable");
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { body, version: { increment: 1 } },
  });

  revalidatePath(`/dashboard/prospects/${message.prospectId}`);
}

export async function submitForApproval(formData: FormData) {
  const messageId = z.string().min(1).parse(formData.get("messageId"));
  const user = await requireUser();

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      prospect: true,
      drafter: true,
      workspace: {
        include: {
          memberships: { where: { role: "CLIENT" }, include: { user: true } },
          contacts: { where: { isPrimary: true } },
        },
      },
    },
  });
  if (!message || !["DRAFT", "REJECTED"].includes(message.status)) {
    throw new Error("Message cannot be submitted");
  }

  const recipientEmail = pickApprovalRecipient(message.workspace);

  const notificationId = await prisma.$transaction(async (tx) => {
    await tx.message.update({
      where: { id: messageId },
      data: { status: "PENDING_APPROVAL", rejectionNote: null },
    });
    await tx.messageEvent.create({
      data: {
        messageId,
        workspaceId: message.workspaceId,
        actorId: user.id,
        eventType: "SUBMITTED_FOR_APPROVAL",
      },
    });
    if (shouldAdvance(message.prospect.status, "PENDING_APPROVAL")) {
      await tx.prospect.update({
        where: { id: message.prospectId },
        data: { status: "PENDING_APPROVAL" },
      });
    }
    if (recipientEmail) {
      const n = await tx.notification.create({
        data: {
          workspaceId: message.workspaceId,
          channel: "EMAIL",
          recipient: recipientEmail,
          subject: `Outreach ready for approval — ${message.prospect.fullName} at ${message.prospect.company}`,
          body: `Your Wilson's team has drafted a new outbound message. Open the portal to approve, edit, or reject.`,
          relatedType: "message",
          relatedId: messageId,
          status: "QUEUED",
        },
      });
      return n.id;
    }
    return null;
  });

  // Send the email outside the DB transaction so a slow / failed Resend
  // request doesn't roll back the state change.
  if (notificationId && recipientEmail) {
    await dispatchApprovalEmail(notificationId, {
      to: recipientEmail,
      kind: "message",
      contactName: message.workspace.contacts?.[0]?.fullName ?? message.workspace.contactName,
      workspaceName: message.workspace.name,
      drafterName: message.drafter.name,
      preview: message.body,
      prospectName: message.prospect.fullName,
      prospectCompany: message.prospect.company,
    });
  }

  revalidatePath(`/dashboard/prospects/${message.prospectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/approvals");
}

/* ─── Client approval actions ────────────────────────────────── */

export async function approveMessage(formData: FormData) {
  const messageId = z.string().min(1).parse(formData.get("messageId"));
  const user = await requireUser();

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { prospect: true },
  });
  if (!message || message.status !== "PENDING_APPROVAL") {
    throw new Error("Message not pending approval");
  }

  await prisma.$transaction(async (tx) => {
    await tx.message.update({
      where: { id: messageId },
      data: {
        status: "APPROVED",
        approverId: user.id,
        approvedAt: new Date(),
      },
    });
    await tx.messageEvent.create({
      data: {
        messageId,
        workspaceId: message.workspaceId,
        actorId: user.id,
        eventType: "APPROVED",
      },
    });
    if (shouldAdvance(message.prospect.status, "APPROVED")) {
      await tx.prospect.update({
        where: { id: message.prospectId },
        data: { status: "APPROVED" },
      });
    }
  });

  revalidatePath("/client/dashboard");
  revalidatePath("/dashboard");
}

export async function editAndApprove(formData: FormData) {
  const schema = z.object({
    messageId: z.string().min(1),
    body: z.string().min(10),
  });
  const { messageId, body } = schema.parse({
    messageId: formData.get("messageId"),
    body: formData.get("body"),
  });

  const user = await requireUser();
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { prospect: true },
  });
  if (!message || message.status !== "PENDING_APPROVAL") {
    throw new Error("Message not pending approval");
  }

  await prisma.$transaction(async (tx) => {
    await tx.message.update({
      where: { id: messageId },
      data: {
        body,
        version: { increment: 1 },
        status: "APPROVED",
        approverId: user.id,
        approvedAt: new Date(),
      },
    });
    await tx.messageEvent.create({
      data: {
        messageId,
        workspaceId: message.workspaceId,
        actorId: user.id,
        eventType: "EDITED_AND_APPROVED",
      },
    });
    if (shouldAdvance(message.prospect.status, "APPROVED")) {
      await tx.prospect.update({
        where: { id: message.prospectId },
        data: { status: "APPROVED" },
      });
    }
  });

  revalidatePath("/client/dashboard");
  revalidatePath("/dashboard");
}

export async function rejectMessage(formData: FormData) {
  const schema = z.object({
    messageId: z.string().min(1),
    note: z.string().min(3, "Tell the team what to change"),
  });
  const { messageId, note } = schema.parse({
    messageId: formData.get("messageId"),
    note: formData.get("note"),
  });

  const user = await requireUser();
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { prospect: true },
  });
  if (!message || message.status !== "PENDING_APPROVAL") {
    throw new Error("Message not pending approval");
  }

  await prisma.$transaction(async (tx) => {
    await tx.message.update({
      where: { id: messageId },
      data: {
        status: "REJECTED",
        rejectionNote: note,
        approverId: user.id,
        approvedAt: new Date(),
      },
    });
    await tx.messageEvent.create({
      data: {
        messageId,
        workspaceId: message.workspaceId,
        actorId: user.id,
        eventType: "REJECTED",
        metadata: JSON.stringify({ note }),
      },
    });
    // Only walk the prospect status back to MESSAGE_DRAFTED if it was at
    // PENDING_APPROVAL because of THIS message. If they're already at SENT
    // or REPLIED for an earlier message, leave them alone.
    if (message.prospect.status === "PENDING_APPROVAL") {
      await tx.prospect.update({
        where: { id: message.prospectId },
        data: { status: "MESSAGE_DRAFTED" },
      });
    }
  });

  revalidatePath("/client/dashboard");
  revalidatePath("/dashboard");
}

/* ─── Team send + reply tracking ─────────────────────────────── */

export async function markAsSent(formData: FormData) {
  const messageId = z.string().min(1).parse(formData.get("messageId"));
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot mark sent");

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { prospect: true },
  });
  if (!message || message.status !== "APPROVED") {
    throw new Error("Message not approved");
  }

  await prisma.$transaction(async (tx) => {
    await tx.message.update({
      where: { id: messageId },
      data: { status: "SENT", senderId: user.id, sentAt: new Date() },
    });
    await tx.messageEvent.create({
      data: {
        messageId,
        workspaceId: message.workspaceId,
        actorId: user.id,
        eventType: "SENT",
      },
    });
    if (shouldAdvance(message.prospect.status, "SENT")) {
      await tx.prospect.update({
        where: { id: message.prospectId },
        data: { status: "SENT" },
      });
    }
    // Always update lastContactedAt — sending a follow-up to an already-replied
    // prospect IS a fresh contact event
    await tx.prospect.update({
      where: { id: message.prospectId },
      data: { lastContactedAt: new Date() },
    });
  });

  revalidatePath(`/dashboard/workspaces`);
}

export async function markAsReplied(formData: FormData) {
  const messageId = z.string().min(1).parse(formData.get("messageId"));
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot mark replied");

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { prospect: true },
  });
  if (!message || message.status !== "SENT") {
    throw new Error("Message not sent");
  }

  await prisma.$transaction(async (tx) => {
    await tx.message.update({
      where: { id: messageId },
      data: { status: "REPLIED", repliedAt: new Date() },
    });
    await tx.messageEvent.create({
      data: {
        messageId,
        workspaceId: message.workspaceId,
        actorId: user.id,
        eventType: "REPLIED",
      },
    });
    if (shouldAdvance(message.prospect.status, "REPLIED")) {
      await tx.prospect.update({
        where: { id: message.prospectId },
        data: { status: "REPLIED" },
      });
    }
  });

  revalidatePath(`/dashboard/workspaces`);
}

export async function markMeetingBooked(formData: FormData) {
  const prospectId = z.string().min(1).parse(formData.get("prospectId"));
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot update status");

  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) throw new Error("Prospect not found");

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { status: "MEETING_BOOKED" },
  });
  revalidatePath(`/dashboard/prospects/${prospectId}`);
  revalidatePath("/dashboard");
}

import { DEFAULT_ONBOARDING_QUESTIONS } from "./default-onboarding";

/* ─── Create new client workspace ───────────────────────────── */

const createClientSchema = z.object({
  name: z.string().min(2, "Client name must be at least 2 characters"),
});

// Default onboarding questions live in lib/default-onboarding.ts so the
// seed script + this server action share a single source of truth.

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function generateOnboardingToken(): string {
  // 32-char hex token. Collision probability is astronomically low (16^32).
  // Stored unique on Workspace; token is the only thing needed to fill in
  // that workspace's onboarding from outside the auth boundary.
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

export async function createClient(formData: FormData) {
  const { name } = createClientSchema.parse({
    name: formData.get("name"),
  });
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot create workspaces");

  // Generate a unique slug — append -2, -3, ... if base slug taken
  const baseSlug = slugify(name) || "client";
  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: name.trim(),
      slug,
      contactName: name.trim(), // placeholder until first contact added
      accentColor: "#17614F",
      onboardingToken: generateOnboardingToken(),
      onboarding: {
        create: DEFAULT_ONBOARDING_QUESTIONS.map((q, i) => ({
          question: q.question,
          fieldType: q.fieldType,
          options: q.options ? q.options.join("|") : null,
          minSelections: q.minSelections ?? null,
          maxSelections: q.maxSelections ?? null,
          required: q.required ?? false,
          orderIndex: i,
        })),
      },
    },
  });

  // Grant the creator access. ADMINs already see everything via the
  // accessibleWorkspaceIds shortcut, but we also create a Membership row so
  // the workspace shows up in their sidebar list immediately.
  await prisma.membership.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      role: user.role === "ADMIN" ? "ADMIN" : "TEAM_MEMBER",
    },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/workspaces/${workspace.slug}/settings`);
}

/* ─── Public token-scoped onboarding (no auth) ──────────────── */

const submitOnboardingByTokenSchema = z.object({
  token: z.string().min(8),
  responseId: z.string().min(1),
  answer: z.string().optional(),
});

/**
 * Token-scoped answer save. The /onboard/[token] page is public — clients
 * filling out their questionnaire don't need to be logged in. Security
 * comes entirely from the token: every read and write is filtered by
 * "this response belongs to the workspace that owns this token."
 *
 * Cross-workspace leakage is prevented because:
 *   1. We look up workspace by token (404 if invalid)
 *   2. We verify the responseId belongs to THAT workspace before updating
 */
export async function submitOnboardingByToken(formData: FormData) {
  const parsed = submitOnboardingByTokenSchema.parse({
    token: formData.get("token"),
    responseId: formData.get("responseId"),
    answer: formData.get("answer") || undefined,
  });

  const workspace = await prisma.workspace.findUnique({
    where: { onboardingToken: parsed.token },
    select: { id: true, slug: true },
  });
  if (!workspace) throw new Error("Invalid onboarding link");

  const row = await prisma.onboardingResponse.findUnique({
    where: { id: parsed.responseId },
    select: { id: true, workspaceId: true },
  });
  if (!row || row.workspaceId !== workspace.id) {
    throw new Error("Response not found in this workspace");
  }

  await prisma.onboardingResponse.update({
    where: { id: parsed.responseId },
    data: { answer: parsed.answer ?? null },
  });

  revalidatePath(`/onboard/${parsed.token}`);
  // Don't reveal slug in the public path; team-side revalidation happens
  // on next visit because we revalidate the workspace settings paths too.
  revalidatePath(`/dashboard/workspaces/${workspace.slug}/settings`);
  revalidatePath("/client/settings");
}

/* ─── Workspace profile + onboarding ────────────────────────── */

const updateWorkspaceProfileSchema = z.object({
  workspaceSlug: z.string().min(1),
  name: z.string().min(1),
  businessName: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().optional(),
  approvalEmail: z.string().email().optional().or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal("")),
});

/**
 * Available to admins, team members assigned to the workspace, and the
 * workspace's client users. Each gets their own settings page surface.
 */
async function requireWorkspaceWriteAccess(slug: string) {
  const ctx = await requireWorkspace(slug);
  // requireWorkspace already enforces membership/admin
  return ctx;
}

export async function updateWorkspaceProfile(formData: FormData) {
  const parsed = updateWorkspaceProfileSchema.parse({
    workspaceSlug: formData.get("workspaceSlug"),
    name: formData.get("name"),
    businessName: formData.get("businessName") || undefined,
    linkedinUrl: formData.get("linkedinUrl") || "",
    logoUrl: formData.get("logoUrl") || "",
    approvalEmail: formData.get("approvalEmail") || "",
    accentColor: formData.get("accentColor") || "",
  });
  const { workspace } = await requireWorkspaceWriteAccess(parsed.workspaceSlug);

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      name: parsed.name,
      businessName: parsed.businessName ?? null,
      linkedinUrl: parsed.linkedinUrl || null,
      logoUrl: parsed.logoUrl || null,
      approvalEmail: parsed.approvalEmail || null,
      accentColor: parsed.accentColor || null,
    },
  });

  revalidatePath(`/dashboard/workspaces/${workspace.slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/client/settings");
  revalidatePath("/client/dashboard");
}

/* ─── Client contacts ───────────────────────────────────────── */

const contactInputSchema = z.object({
  workspaceSlug: z.string().min(1),
  fullName: z.string().min(1),
  title: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
});

export async function addClientContact(formData: FormData) {
  const parsed = contactInputSchema.parse({
    workspaceSlug: formData.get("workspaceSlug"),
    fullName: formData.get("fullName"),
    title: formData.get("title") || undefined,
    email: formData.get("email") || "",
    linkedinUrl: formData.get("linkedinUrl") || "",
  });
  const { workspace } = await requireWorkspaceWriteAccess(parsed.workspaceSlug);

  // If this is the first contact for the workspace, mark as primary
  const count = await prisma.clientContact.count({
    where: { workspaceId: workspace.id },
  });

  await prisma.clientContact.create({
    data: {
      workspaceId: workspace.id,
      fullName: parsed.fullName,
      title: parsed.title ?? null,
      email: parsed.email || null,
      linkedinUrl: parsed.linkedinUrl || null,
      isPrimary: count === 0,
    },
  });

  // Keep workspace.contactName synced to primary
  await syncPrimaryContactName(workspace.id);

  revalidatePath(`/dashboard/workspaces/${workspace.slug}`);
  revalidatePath("/client/settings");
}

const updateContactSchema = contactInputSchema.extend({
  contactId: z.string().min(1),
});

export async function updateClientContact(formData: FormData) {
  const parsed = updateContactSchema.parse({
    contactId: formData.get("contactId"),
    workspaceSlug: formData.get("workspaceSlug"),
    fullName: formData.get("fullName"),
    title: formData.get("title") || undefined,
    email: formData.get("email") || "",
    linkedinUrl: formData.get("linkedinUrl") || "",
  });
  const { workspace } = await requireWorkspaceWriteAccess(parsed.workspaceSlug);

  const contact = await prisma.clientContact.findUnique({
    where: { id: parsed.contactId },
  });
  if (!contact || contact.workspaceId !== workspace.id) {
    throw new Error("Contact not found in this workspace");
  }

  await prisma.clientContact.update({
    where: { id: parsed.contactId },
    data: {
      fullName: parsed.fullName,
      title: parsed.title ?? null,
      email: parsed.email || null,
      linkedinUrl: parsed.linkedinUrl || null,
    },
  });

  await syncPrimaryContactName(workspace.id);
  revalidatePath(`/dashboard/workspaces/${workspace.slug}`);
  revalidatePath("/client/settings");
}

const contactRefSchema = z.object({
  workspaceSlug: z.string().min(1),
  contactId: z.string().min(1),
});

export async function removeClientContact(formData: FormData) {
  const { workspaceSlug, contactId } = contactRefSchema.parse({
    workspaceSlug: formData.get("workspaceSlug"),
    contactId: formData.get("contactId"),
  });
  const { workspace } = await requireWorkspaceWriteAccess(workspaceSlug);

  const contact = await prisma.clientContact.findUnique({
    where: { id: contactId },
  });
  if (!contact || contact.workspaceId !== workspace.id) {
    throw new Error("Contact not found");
  }

  await prisma.clientContact.delete({ where: { id: contactId } });

  // If we just removed the primary, promote another contact (if any)
  if (contact.isPrimary) {
    const next = await prisma.clientContact.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.clientContact.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }

  await syncPrimaryContactName(workspace.id);
  revalidatePath(`/dashboard/workspaces/${workspace.slug}`);
  revalidatePath("/client/settings");
}

export async function setPrimaryContact(formData: FormData) {
  const { workspaceSlug, contactId } = contactRefSchema.parse({
    workspaceSlug: formData.get("workspaceSlug"),
    contactId: formData.get("contactId"),
  });
  const { workspace } = await requireWorkspaceWriteAccess(workspaceSlug);

  const contact = await prisma.clientContact.findUnique({
    where: { id: contactId },
  });
  if (!contact || contact.workspaceId !== workspace.id) {
    throw new Error("Contact not found");
  }

  await prisma.$transaction([
    prisma.clientContact.updateMany({
      where: { workspaceId: workspace.id },
      data: { isPrimary: false },
    }),
    prisma.clientContact.update({
      where: { id: contactId },
      data: { isPrimary: true },
    }),
  ]);

  await syncPrimaryContactName(workspace.id);
  revalidatePath(`/dashboard/workspaces/${workspace.slug}`);
  revalidatePath("/client/settings");
}

/** Re-cache workspace.contactName from the current primary contact. */
async function syncPrimaryContactName(workspaceId: string) {
  const primary = await prisma.clientContact.findFirst({
    where: { workspaceId, isPrimary: true },
  });
  if (primary) {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { contactName: primary.fullName },
    });
  }
}

/* ─── Onboarding questionnaire ──────────────────────────────── */

const onboardingQuestionSchema = z.object({
  workspaceSlug: z.string().min(1),
  question: z.string().min(2),
  fieldType: z
    .enum(["TEXT", "LONGTEXT", "URL", "NUMBER", "SINGLE_CHOICE", "MULTI_CHOICE"])
    .default("LONGTEXT"),
  options: z.string().optional(), // newline- or pipe-separated
  minSelections: z.coerce.number().int().min(0).optional(),
  maxSelections: z.coerce.number().int().min(0).optional(),
  required: z.boolean().optional(),
});

/**
 * Normalize options input — supports both newline-separated (textarea
 * style) and pipe-separated input. Returns the canonical pipe-separated
 * form we store, or null if there are no options for this field type.
 */
function normalizeOptions(
  fieldType: string,
  raw: string | undefined
): string | null {
  if (fieldType !== "SINGLE_CHOICE" && fieldType !== "MULTI_CHOICE") {
    return null;
  }
  if (!raw) return null;
  const opts = raw
    .split(/[\n|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return opts.length > 0 ? opts.join("|") : null;
}

export async function addOnboardingQuestion(formData: FormData) {
  const parsed = onboardingQuestionSchema.parse({
    workspaceSlug: formData.get("workspaceSlug"),
    question: formData.get("question"),
    fieldType: (formData.get("fieldType") as string | null) || "LONGTEXT",
    options: formData.get("options") || undefined,
    minSelections: formData.get("minSelections") || undefined,
    maxSelections: formData.get("maxSelections") || undefined,
    required: formData.get("required") === "on",
  });
  const { workspace } = await requireWorkspaceWriteAccess(parsed.workspaceSlug);

  const isChoice =
    parsed.fieldType === "SINGLE_CHOICE" ||
    parsed.fieldType === "MULTI_CHOICE";

  const options = normalizeOptions(parsed.fieldType, parsed.options);
  if (isChoice && !options) {
    throw new Error("Choice questions need at least one option");
  }

  const max = await prisma.onboardingResponse.aggregate({
    where: { workspaceId: workspace.id },
    _max: { orderIndex: true },
  });

  await prisma.onboardingResponse.create({
    data: {
      workspaceId: workspace.id,
      question: parsed.question,
      fieldType: parsed.fieldType,
      options,
      minSelections:
        parsed.fieldType === "MULTI_CHOICE"
          ? parsed.minSelections ?? null
          : null,
      maxSelections:
        parsed.fieldType === "MULTI_CHOICE"
          ? parsed.maxSelections ?? null
          : null,
      required: parsed.required ?? false,
      orderIndex: (max._max.orderIndex ?? -1) + 1,
    },
  });

  revalidatePath(`/dashboard/workspaces/${workspace.slug}`);
  revalidatePath("/client/settings");
}

const updateAnswerSchema = z.object({
  workspaceSlug: z.string().min(1),
  responseId: z.string().min(1),
  answer: z.string().optional(),
});

export async function updateOnboardingAnswer(formData: FormData) {
  const parsed = updateAnswerSchema.parse({
    workspaceSlug: formData.get("workspaceSlug"),
    responseId: formData.get("responseId"),
    answer: formData.get("answer") || undefined,
  });
  const { workspace } = await requireWorkspaceWriteAccess(parsed.workspaceSlug);

  const row = await prisma.onboardingResponse.findUnique({
    where: { id: parsed.responseId },
  });
  if (!row || row.workspaceId !== workspace.id) {
    throw new Error("Onboarding row not found");
  }

  await prisma.onboardingResponse.update({
    where: { id: parsed.responseId },
    data: { answer: parsed.answer ?? null },
  });

  revalidatePath(`/dashboard/workspaces/${workspace.slug}`);
  revalidatePath("/client/settings");
}

const updateQuestionSchema = z.object({
  workspaceSlug: z.string().min(1),
  responseId: z.string().min(1),
  question: z.string().min(2),
  fieldType: z
    .enum(["TEXT", "LONGTEXT", "URL", "NUMBER", "SINGLE_CHOICE", "MULTI_CHOICE"])
    .optional(),
  options: z.string().optional(),
  minSelections: z.coerce.number().int().min(0).optional(),
  maxSelections: z.coerce.number().int().min(0).optional(),
  required: z.boolean().optional(),
});

export async function updateOnboardingQuestion(formData: FormData) {
  const parsed = updateQuestionSchema.parse({
    workspaceSlug: formData.get("workspaceSlug"),
    responseId: formData.get("responseId"),
    question: formData.get("question"),
    fieldType: (formData.get("fieldType") as string | null) || undefined,
    options: formData.get("options") || undefined,
    minSelections: formData.get("minSelections") || undefined,
    maxSelections: formData.get("maxSelections") || undefined,
    required: formData.get("required") === "on",
  });
  const { workspace } = await requireWorkspaceWriteAccess(parsed.workspaceSlug);

  const row = await prisma.onboardingResponse.findUnique({
    where: { id: parsed.responseId },
  });
  if (!row || row.workspaceId !== workspace.id) {
    throw new Error("Onboarding row not found");
  }

  // Build update payload — only touch the fields that came through
  const data: Record<string, unknown> = { question: parsed.question };

  if (parsed.fieldType) {
    const isChoice =
      parsed.fieldType === "SINGLE_CHOICE" ||
      parsed.fieldType === "MULTI_CHOICE";
    const options = normalizeOptions(parsed.fieldType, parsed.options);
    if (isChoice && !options) {
      throw new Error("Choice questions need at least one option");
    }
    data.fieldType = parsed.fieldType;
    data.options = options;
    data.minSelections =
      parsed.fieldType === "MULTI_CHOICE"
        ? parsed.minSelections ?? null
        : null;
    data.maxSelections =
      parsed.fieldType === "MULTI_CHOICE"
        ? parsed.maxSelections ?? null
        : null;
  }

  if (formData.has("required")) {
    data.required = parsed.required ?? false;
  }

  await prisma.onboardingResponse.update({
    where: { id: parsed.responseId },
    data,
  });

  revalidatePath(`/dashboard/workspaces/${workspace.slug}`);
  revalidatePath("/client/settings");
}

const removeQuestionSchema = z.object({
  workspaceSlug: z.string().min(1),
  responseId: z.string().min(1),
});

export async function removeOnboardingQuestion(formData: FormData) {
  const { workspaceSlug, responseId } = removeQuestionSchema.parse({
    workspaceSlug: formData.get("workspaceSlug"),
    responseId: formData.get("responseId"),
  });
  const { workspace } = await requireWorkspaceWriteAccess(workspaceSlug);

  const row = await prisma.onboardingResponse.findUnique({
    where: { id: responseId },
  });
  if (!row || row.workspaceId !== workspace.id) {
    throw new Error("Onboarding row not found");
  }

  await prisma.onboardingResponse.delete({ where: { id: responseId } });

  revalidatePath(`/dashboard/workspaces/${workspace.slug}`);
  revalidatePath("/client/settings");
}

/* ─── Prospect pipeline (drag-and-drop stage changes) ───────── */

/**
 * Canonical single status per pipeline stage. Kanban columns that map to
 * multiple statuses (e.g. Drafting covers DRAFTED/PENDING/APPROVED) land
 * on the first status of the stage when dragged in.
 */
const STAGE_CANONICAL: Record<string, string> = {
  IDENTIFIED: "IDENTIFIED",
  DRAFTING: "MESSAGE_DRAFTED",
  SENT: "SENT",
  REPLIED: "REPLIED",
  MEETING_BOOKED: "MEETING_BOOKED",
  NOT_INTERESTED: "NOT_INTERESTED",
  NURTURE: "NURTURE",
};

const moveProspectSchema = z.object({
  prospectId: z.string().min(1),
  stage: z.enum([
    "IDENTIFIED",
    "DRAFTING",
    "SENT",
    "REPLIED",
    "MEETING_BOOKED",
    "NOT_INTERESTED",
    "NURTURE",
  ]),
});

export async function moveProspectToStage(formData: FormData) {
  const { prospectId, stage } = moveProspectSchema.parse({
    prospectId: formData.get("prospectId"),
    stage: formData.get("stage"),
  });
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot move prospects");

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
  });
  if (!prospect) throw new Error("Prospect not found");

  const newStatus = STAGE_CANONICAL[stage];
  if (prospect.status === newStatus) return;

  await prisma.$transaction(async (tx) => {
    await tx.prospect.update({
      where: { id: prospectId },
      data: { status: newStatus as never },
    });
    await tx.prospectEvent.create({
      data: {
        prospectId,
        workspaceId: prospect.workspaceId,
        actorId: user.id,
        eventType: "CUSTOM",
        note: `Moved to ${humanStage(stage)}`,
        occurredAt: new Date(),
      },
    });
  });

  revalidatePath(`/dashboard/workspaces`);
}

function humanStage(stage: string) {
  return stage
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

/* ─── Prospect CRM (fields + timeline) ──────────────────────── */

const updateProspectContactSchema = z.object({
  prospectId: z.string().min(1),
  linkedinConnectedAt: z.string().optional(),
  lastContactedAt: z.string().optional(),
});

export async function updateProspectContactDates(formData: FormData) {
  const parsed = updateProspectContactSchema.parse({
    prospectId: formData.get("prospectId"),
    linkedinConnectedAt: formData.get("linkedinConnectedAt") || undefined,
    lastContactedAt: formData.get("lastContactedAt") || undefined,
  });
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot edit CRM data");

  const prospect = await prisma.prospect.findUnique({
    where: { id: parsed.prospectId },
  });
  if (!prospect) throw new Error("Prospect not found");

  await prisma.prospect.update({
    where: { id: parsed.prospectId },
    data: {
      linkedinConnectedAt: parsed.linkedinConnectedAt
        ? new Date(parsed.linkedinConnectedAt)
        : null,
      lastContactedAt: parsed.lastContactedAt
        ? new Date(parsed.lastContactedAt)
        : null,
    },
  });

  revalidatePath(`/dashboard/workspaces/${prospect.workspaceId}/prospects`);
}

const updateProspectInfoSchema = z.object({
  prospectId: z.string().min(1),
  fullName: z.string().min(1),
  title: z.string().optional(),
  company: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  location: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  tags: z.string().optional(),
  fitScore: z.enum(["STRONG", "POSSIBLE", "NOT_A_FIT"]).optional(),
  notes: z.string().optional(),
});

export async function updateProspectInfo(formData: FormData) {
  const parsed = updateProspectInfoSchema.parse({
    prospectId: formData.get("prospectId"),
    fullName: formData.get("fullName"),
    title: formData.get("title") || undefined,
    company: formData.get("company"),
    email: formData.get("email") || "",
    location: formData.get("location") || undefined,
    linkedinUrl: formData.get("linkedinUrl") || "",
    tags: formData.get("tags") || undefined,
    fitScore: (formData.get("fitScore") as string | null) || undefined,
    notes: formData.get("notes") || undefined,
  });
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot edit CRM data");

  const prospect = await prisma.prospect.findUnique({
    where: { id: parsed.prospectId },
  });
  if (!prospect) throw new Error("Prospect not found");

  await prisma.prospect.update({
    where: { id: parsed.prospectId },
    data: {
      fullName: parsed.fullName,
      title: parsed.title ?? null,
      company: parsed.company,
      email: parsed.email || null,
      location: parsed.location ?? null,
      linkedinUrl:
        parsed.linkedinUrl ||
        `https://linkedin.com/in/${parsed.fullName.toLowerCase().replace(/[^a-z]/g, "-")}`,
      tags: parsed.tags ?? null,
      fitScore: parsed.fitScore ?? prospect.fitScore,
      notes: parsed.notes ?? null,
    },
  });

  revalidatePath(`/dashboard/workspaces/${prospect.workspaceId}/prospects`);
}

const logActivitySchema = z.object({
  prospectId: z.string().min(1),
  eventType: z.enum([
    "CONTACTED",
    "CALL",
    "EMAIL",
    "MEETING",
    "NOTE_ADDED",
    "LINKEDIN_CONNECTION_SENT",
    "LINKEDIN_CONNECTION_ACCEPTED",
    "CUSTOM",
  ]),
  occurredAt: z.string().min(1),
  note: z.string().optional(),
});

export async function logProspectActivity(formData: FormData) {
  const parsed = logActivitySchema.parse({
    prospectId: formData.get("prospectId"),
    eventType: formData.get("eventType"),
    occurredAt: formData.get("occurredAt"),
    note: formData.get("note") || undefined,
  });
  const user = await requireUser();
  if (user.role === "CLIENT")
    throw new Error("Clients cannot log activity");

  const prospect = await prisma.prospect.findUnique({
    where: { id: parsed.prospectId },
  });
  if (!prospect) throw new Error("Prospect not found");

  await prisma.$transaction(async (tx) => {
    await tx.prospectEvent.create({
      data: {
        prospectId: parsed.prospectId,
        workspaceId: prospect.workspaceId,
        actorId: user.id,
        eventType: parsed.eventType,
        note: parsed.note ?? null,
        occurredAt: new Date(parsed.occurredAt),
      },
    });

    // If the logged event counts as outbound contact, update lastContactedAt
    const contactingTypes = ["CONTACTED", "CALL", "EMAIL", "MEETING"];
    if (contactingTypes.includes(parsed.eventType)) {
      await tx.prospect.update({
        where: { id: parsed.prospectId },
        data: { lastContactedAt: new Date(parsed.occurredAt) },
      });
    }

    // If this is LinkedIn-accepted, update linkedinConnectedAt
    if (parsed.eventType === "LINKEDIN_CONNECTION_ACCEPTED") {
      await tx.prospect.update({
        where: { id: parsed.prospectId },
        data: { linkedinConnectedAt: new Date(parsed.occurredAt) },
      });
    }
  });

  revalidatePath(`/dashboard/workspaces/${prospect.workspaceId}/prospects`);
}

/* ─── POSTS (content pipeline) ──────────────────────────────── */

const draftPostSchema = z.object({
  workspaceSlug: z.string().min(1),
  title: z.string().optional(),
  body: z.string().min(10, "Draft must be at least 10 characters"),
});

export async function draftPost(formData: FormData) {
  const parsed = draftPostSchema.parse({
    workspaceSlug: formData.get("workspaceSlug"),
    title: formData.get("title") || undefined,
    body: formData.get("body"),
  });
  const { user, workspace } = await requireWorkspace(parsed.workspaceSlug);
  if (user.role === "CLIENT") redirect("/client/dashboard");

  const post = await prisma.$transaction(async (tx) => {
    const p = await tx.post.create({
      data: {
        workspaceId: workspace.id,
        drafterId: user.id,
        title: parsed.title,
        body: parsed.body,
        status: "DRAFT",
      },
    });
    await tx.postEvent.create({
      data: {
        postId: p.id,
        workspaceId: workspace.id,
        actorId: user.id,
        eventType: "DRAFTED",
      },
    });
    return p;
  });

  revalidatePath(`/dashboard/workspaces/${workspace.slug}/content`);
  redirect(`/dashboard/workspaces/${workspace.slug}/content/${post.id}`);
}

const updatePostSchema = z.object({
  postId: z.string().min(1),
  title: z.string().optional(),
  body: z.string().min(10),
});

export async function updatePostDraft(formData: FormData) {
  const parsed = updatePostSchema.parse({
    postId: formData.get("postId"),
    title: formData.get("title") || undefined,
    body: formData.get("body"),
  });
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot edit drafts");

  const post = await prisma.post.findUnique({ where: { id: parsed.postId } });
  if (!post || !["DRAFT", "REJECTED"].includes(post.status)) {
    throw new Error("Post not editable in current state");
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: parsed.postId },
      data: {
        title: parsed.title ?? null,
        body: parsed.body,
        version: { increment: 1 },
      },
    });
    await tx.postEvent.create({
      data: {
        postId: parsed.postId,
        workspaceId: post.workspaceId,
        actorId: user.id,
        eventType: "EDITED",
      },
    });
  });

  revalidatePath(`/dashboard/workspaces`);
}

export async function submitPostForApproval(formData: FormData) {
  const postId = z.string().min(1).parse(formData.get("postId"));
  const user = await requireUser();

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      drafter: true,
      workspace: {
        include: {
          memberships: { where: { role: "CLIENT" }, include: { user: true } },
          contacts: { where: { isPrimary: true } },
        },
      },
    },
  });
  if (!post || !["DRAFT", "REJECTED"].includes(post.status)) {
    throw new Error("Post cannot be submitted");
  }

  const recipientEmail = pickApprovalRecipient(post.workspace);

  const notificationId = await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: { status: "PENDING_APPROVAL", rejectionNote: null },
    });
    await tx.postEvent.create({
      data: {
        postId,
        workspaceId: post.workspaceId,
        actorId: user.id,
        eventType: "SUBMITTED_FOR_APPROVAL",
      },
    });
    if (recipientEmail) {
      const n = await tx.notification.create({
        data: {
          workspaceId: post.workspaceId,
          channel: "EMAIL",
          recipient: recipientEmail,
          subject: `New post ready for your approval — ${post.title ?? "Untitled"}`,
          body: `Your Wilson's team has drafted a new LinkedIn post for your review. Open the portal to approve, edit, or reject with notes.`,
          relatedType: "post",
          relatedId: postId,
          status: "QUEUED",
        },
      });
      return n.id;
    }
    return null;
  });

  if (notificationId && recipientEmail) {
    await dispatchApprovalEmail(notificationId, {
      to: recipientEmail,
      kind: "post",
      contactName:
        post.workspace.contacts?.[0]?.fullName ?? post.workspace.contactName,
      workspaceName: post.workspace.name,
      drafterName: post.drafter.name,
      preview: post.body,
      postTitle: post.title ?? undefined,
    });
  }

  revalidatePath(`/dashboard/workspaces/${post.workspace.slug}/content`);
  revalidatePath("/dashboard/approvals");
  revalidatePath("/client/dashboard");
}

export async function approvePost(formData: FormData) {
  const postId = z.string().min(1).parse(formData.get("postId"));
  const user = await requireUser();
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.status !== "PENDING_APPROVAL")
    throw new Error("Post not pending approval");

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: { status: "APPROVED", approverId: user.id, approvedAt: new Date() },
    });
    await tx.postEvent.create({
      data: {
        postId,
        workspaceId: post.workspaceId,
        actorId: user.id,
        eventType: "APPROVED",
      },
    });
  });

  revalidatePath("/client/dashboard");
  revalidatePath("/dashboard/approvals");
  revalidatePath(`/dashboard/workspaces`);
}

const editApprovePostSchema = z.object({
  postId: z.string().min(1),
  body: z.string().min(10),
});

export async function editAndApprovePost(formData: FormData) {
  const { postId, body } = editApprovePostSchema.parse({
    postId: formData.get("postId"),
    body: formData.get("body"),
  });
  const user = await requireUser();
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.status !== "PENDING_APPROVAL")
    throw new Error("Post not pending approval");

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        body,
        version: { increment: 1 },
        status: "APPROVED",
        approverId: user.id,
        approvedAt: new Date(),
      },
    });
    await tx.postEvent.create({
      data: {
        postId,
        workspaceId: post.workspaceId,
        actorId: user.id,
        eventType: "EDITED_AND_APPROVED",
      },
    });
  });

  revalidatePath("/client/dashboard");
  revalidatePath("/dashboard/approvals");
  revalidatePath(`/dashboard/workspaces`);
}

const rejectPostSchema = z.object({
  postId: z.string().min(1),
  note: z.string().min(3, "Tell the team what to change"),
});

export async function rejectPost(formData: FormData) {
  const { postId, note } = rejectPostSchema.parse({
    postId: formData.get("postId"),
    note: formData.get("note"),
  });
  const user = await requireUser();
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.status !== "PENDING_APPROVAL")
    throw new Error("Post not pending approval");

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        status: "REJECTED",
        rejectionNote: note,
        approverId: user.id,
        approvedAt: new Date(),
      },
    });
    await tx.postEvent.create({
      data: {
        postId,
        workspaceId: post.workspaceId,
        actorId: user.id,
        eventType: "REJECTED",
        metadata: JSON.stringify({ note }),
      },
    });
  });

  revalidatePath("/client/dashboard");
  revalidatePath("/dashboard/approvals");
  revalidatePath(`/dashboard/workspaces`);
}

const markPostedSchema = z.object({
  postId: z.string().min(1),
  postedUrl: z.string().url().optional().or(z.literal("")),
});

/* ─── Move post to stage (Kanban DnD) ───────────────────────── */

const movePostStageSchema = z.object({
  postId: z.string().min(1),
  stage: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "POSTED", "REJECTED"]),
});

/**
 * Move a post from one Kanban column to another. Constrained by the
 * approval flow:
 *   DRAFT → PENDING_APPROVAL  → submits for approval (queues notification)
 *   REJECTED → DRAFT          → reset, ready to rewrite
 *   APPROVED → POSTED         → mark posted (no URL captured here)
 *   POSTED → APPROVED         → revert (mistake)
 *   PENDING → DRAFT           → withdraw before client sees it
 *
 * Team CANNOT drag posts INTO Approved or Rejected — those transitions
 * belong to the client and require explicit approve/reject actions
 * (rejection needs a note). We throw on illegal moves so the optimistic
 * update on the client can roll back.
 */
export async function movePostToStage(formData: FormData) {
  const { postId, stage } = movePostStageSchema.parse({
    postId: formData.get("postId"),
    stage: formData.get("stage"),
  });
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot drag posts");

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      drafter: true,
      workspace: {
        include: {
          memberships: { where: { role: "CLIENT" }, include: { user: true } },
          contacts: { where: { isPrimary: true } },
        },
      },
    },
  });
  if (!post) throw new Error("Post not found");
  if (post.status === stage) return; // no-op

  const transition = `${post.status}->${stage}`;
  const allowed = new Set([
    "DRAFT->PENDING_APPROVAL",
    "PENDING_APPROVAL->DRAFT",
    "REJECTED->DRAFT",
    "APPROVED->POSTED",
    "POSTED->APPROVED",
    "DRAFT->DRAFT",
    "POSTED->POSTED",
  ]);
  if (!allowed.has(transition)) {
    if (
      transition === "PENDING_APPROVAL->APPROVED" ||
      transition === "DRAFT->APPROVED" ||
      transition === "PENDING_APPROVAL->POSTED"
    ) {
      throw new Error(
        "Approval is the client's call — you can't drag into Approved on their behalf."
      );
    }
    if (stage === "REJECTED") {
      throw new Error(
        "Rejection needs a note — open the post and use Reject with notes."
      );
    }
    throw new Error(`Move ${transition} isn't allowed.`);
  }

  // Capture notification id + email so we can dispatch Resend AFTER the
  // transaction commits (network calls don't belong inside a DB tx).
  const recipientEmail = pickApprovalRecipient(post.workspace);
  let pendingNotificationId: string | null = null;

  await prisma.$transaction(async (tx) => {
    // Patch the post with the right side-effects per transition
    if (transition === "DRAFT->PENDING_APPROVAL") {
      await tx.post.update({
        where: { id: postId },
        data: { status: "PENDING_APPROVAL", rejectionNote: null },
      });
      await tx.postEvent.create({
        data: {
          postId,
          workspaceId: post.workspaceId,
          actorId: user.id,
          eventType: "SUBMITTED_FOR_APPROVAL",
        },
      });
      // Fire notification (same behaviour as submitPostForApproval)
      if (recipientEmail) {
        const n = await tx.notification.create({
          data: {
            workspaceId: post.workspaceId,
            channel: "EMAIL",
            recipient: recipientEmail,
            subject: `New post ready for your approval — ${post.title ?? "Untitled"}`,
            body: `Your Wilson's team has drafted a new LinkedIn post for your review. Open the portal to approve, edit, or reject with notes.`,
            relatedType: "post",
            relatedId: postId,
            status: "QUEUED",
          },
        });
        pendingNotificationId = n.id;
      }
    } else if (transition === "PENDING_APPROVAL->DRAFT") {
      await tx.post.update({
        where: { id: postId },
        data: { status: "DRAFT" },
      });
      await tx.postEvent.create({
        data: {
          postId,
          workspaceId: post.workspaceId,
          actorId: user.id,
          eventType: "EDITED",
        },
      });
    } else if (transition === "REJECTED->DRAFT") {
      await tx.post.update({
        where: { id: postId },
        data: { status: "DRAFT", rejectionNote: null },
      });
      await tx.postEvent.create({
        data: {
          postId,
          workspaceId: post.workspaceId,
          actorId: user.id,
          eventType: "EDITED",
        },
      });
    } else if (transition === "APPROVED->POSTED") {
      await tx.post.update({
        where: { id: postId },
        data: {
          status: "POSTED",
          posterId: user.id,
          postedAt: new Date(),
        },
      });
      await tx.postEvent.create({
        data: {
          postId,
          workspaceId: post.workspaceId,
          actorId: user.id,
          eventType: "POSTED",
        },
      });
    } else if (transition === "POSTED->APPROVED") {
      await tx.post.update({
        where: { id: postId },
        data: { status: "APPROVED", posterId: null, postedAt: null },
      });
      await tx.postEvent.create({
        data: {
          postId,
          workspaceId: post.workspaceId,
          actorId: user.id,
          eventType: "EDITED",
        },
      });
    }
  });

  // Send the approval email if the DRAFT->PENDING_APPROVAL branch queued
  // a notification. Outside the transaction so a slow Resend call doesn't
  // hold the row lock open.
  if (pendingNotificationId && recipientEmail) {
    await dispatchApprovalEmail(pendingNotificationId, {
      to: recipientEmail,
      kind: "post",
      contactName:
        post.workspace.contacts?.[0]?.fullName ?? post.workspace.contactName,
      workspaceName: post.workspace.name,
      drafterName: post.drafter.name,
      preview: post.body,
      postTitle: post.title ?? undefined,
    });
  }

  revalidatePath(`/dashboard/workspaces/${post.workspace.slug}/content`);
  revalidatePath("/dashboard/approvals");
  revalidatePath("/client/dashboard");
}

/* ─── Post media (attachments) ──────────────────────────────── */

const MAX_MEDIA_BYTES = 2 * 1024 * 1024; // 2 MB per attachment for v1

const addMediaSchema = z.object({
  postId: z.string().min(1),
  dataUrl: z.string().min(1),
  filename: z.string().optional(),
  contentType: z.string().optional(),
});

export async function addPostMedia(formData: FormData) {
  const parsed = addMediaSchema.parse({
    postId: formData.get("postId"),
    dataUrl: formData.get("dataUrl"),
    filename: formData.get("filename") || undefined,
    contentType: formData.get("contentType") || undefined,
  });
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot attach media");

  const post = await prisma.post.findUnique({
    where: { id: parsed.postId },
    select: { id: true, workspaceId: true, status: true },
  });
  if (!post) throw new Error("Post not found");
  if (!["DRAFT", "REJECTED"].includes(post.status)) {
    throw new Error("Cannot attach media after submission");
  }

  // Crude size check on the data URL (base64 inflates by ~33%).
  if (parsed.dataUrl.length > MAX_MEDIA_BYTES * 1.4) {
    throw new Error("Image too large — max 2MB per file");
  }

  if (
    parsed.contentType &&
    !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
      parsed.contentType
    )
  ) {
    throw new Error("Only PNG / JPEG / GIF / WEBP images are supported");
  }

  const max = await prisma.postMedia.aggregate({
    where: { postId: parsed.postId },
    _max: { orderIndex: true },
  });

  await prisma.postMedia.create({
    data: {
      postId: parsed.postId,
      url: parsed.dataUrl,
      filename: parsed.filename ?? null,
      contentType: parsed.contentType ?? null,
      orderIndex: (max._max.orderIndex ?? -1) + 1,
    },
  });

  revalidatePath(`/dashboard/workspaces`);
}

const removeMediaSchema = z.object({
  mediaId: z.string().min(1),
});

export async function removePostMedia(formData: FormData) {
  const { mediaId } = removeMediaSchema.parse({
    mediaId: formData.get("mediaId"),
  });
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot remove media");

  const media = await prisma.postMedia.findUnique({
    where: { id: mediaId },
    include: { post: { select: { status: true } } },
  });
  if (!media) throw new Error("Media not found");
  if (!["DRAFT", "REJECTED"].includes(media.post.status)) {
    throw new Error("Cannot remove media after submission");
  }

  await prisma.postMedia.delete({ where: { id: mediaId } });
  revalidatePath(`/dashboard/workspaces`);
}

/* ─── Delete a post ─────────────────────────────────────────── */

const deletePostSchema = z.object({
  postId: z.string().min(1),
});

/**
 * Delete a post (and its cascading media + events). Allowed at any
 * status except POSTED — once a post is live on LinkedIn, the record
 * stays for history. ADMINs and TEAM_MEMBERs with a membership for the
 * post's workspace can delete; CLIENTs cannot.
 */
export async function deletePost(formData: FormData) {
  const { postId } = deletePostSchema.parse({
    postId: formData.get("postId"),
  });
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot delete posts");

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, workspaceId: true, status: true, workspace: { select: { slug: true } } },
  });
  if (!post) throw new Error("Post not found");

  if (post.status === "POSTED") {
    throw new Error(
      "This post is already live on LinkedIn — deleting the record won't unpublish it. Archive only allowed for drafts."
    );
  }

  // Verify the caller has access to this post's workspace (admins always
  // do; team members must have a Membership row).
  if (user.role !== "ADMIN") {
    const membership = user.memberships.find(
      (m) => m.workspaceId === post.workspaceId
    );
    if (!membership) throw new Error("You don't have access to this workspace");
  }

  await prisma.post.delete({ where: { id: postId } });

  revalidatePath(`/dashboard/workspaces/${post.workspace.slug}/content`);
  revalidatePath(`/dashboard/approvals`);
  redirect(`/dashboard/workspaces/${post.workspace.slug}/content`);
}

export async function markPostAsPosted(formData: FormData) {
  const { postId, postedUrl } = markPostedSchema.parse({
    postId: formData.get("postId"),
    postedUrl: formData.get("postedUrl") || "",
  });
  const user = await requireUser();
  if (user.role === "CLIENT") throw new Error("Clients cannot mark posted");

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.status !== "APPROVED")
    throw new Error("Post not approved");

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        status: "POSTED",
        posterId: user.id,
        postedAt: new Date(),
        postedUrl: postedUrl || null,
      },
    });
    await tx.postEvent.create({
      data: {
        postId,
        workspaceId: post.workspaceId,
        actorId: user.id,
        eventType: "POSTED",
      },
    });
  });

  revalidatePath(`/dashboard/workspaces`);
}

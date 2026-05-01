import { cache } from "react";
import { prisma } from "./db";
import type { AuthedUser } from "./auth";

/**
 * Data-access layer. Every query that returns workspace-scoped data accepts
 * a user, filters by their accessible workspace ids, and returns typed
 * results. One place for the scoping guard — pages just call these.
 */

/**
 * Workspace ids the user can see. ADMIN sees all; others only their
 * memberships. Cached per-request so a page that calls multiple scoped
 * queries (dashboard, approvals) only issues one workspace lookup.
 */
export const accessibleWorkspaceIds = cache(
  async (user: AuthedUser): Promise<string[]> => {
    if (user.role === "ADMIN") {
      const all = await prisma.workspace.findMany({ select: { id: true } });
      return all.map((w) => w.id);
    }
    return user.memberships.map((m) => m.workspaceId);
  }
);

/* ─── Team dashboard queries ─────────────────────────────────── */

export async function teamDashboardSummary(user: AuthedUser) {
  const workspaceIds = await accessibleWorkspaceIds(user);

  const [pendingCount, weeklyDrafted, weeklyApproved, weeklySent, weeklyReplied, rejectedCount] =
    await Promise.all([
      prisma.message.count({
        where: { workspaceId: { in: workspaceIds }, status: "PENDING_APPROVAL" },
      }),
      prisma.message.count({
        where: {
          workspaceId: { in: workspaceIds },
          createdAt: { gte: sevenDaysAgo() },
        },
      }),
      prisma.message.count({
        where: {
          workspaceId: { in: workspaceIds },
          approvedAt: { gte: sevenDaysAgo() },
          status: { in: ["APPROVED", "SENT", "REPLIED"] },
        },
      }),
      prisma.message.count({
        where: { workspaceId: { in: workspaceIds }, sentAt: { gte: sevenDaysAgo() } },
      }),
      prisma.message.count({
        where: { workspaceId: { in: workspaceIds }, repliedAt: { gte: sevenDaysAgo() } },
      }),
      prisma.message.count({
        where: { workspaceId: { in: workspaceIds }, status: "REJECTED" },
      }),
    ]);

  return {
    pendingCount,
    rejectedCount,
    weekly: {
      drafted: weeklyDrafted,
      approved: weeklyApproved,
      sent: weeklySent,
      replied: weeklyReplied,
    },
  };
}

/**
 * Slim sidebar list — used by the team layout chrome which renders on every
 * navigation. Only `id`, `slug`, `name`, and a pending count. Avoids the
 * dashboard's heavier joins so layout transitions stay fast.
 */
export const teamSidebarWorkspaces = cache(async (user: AuthedUser) => {
  const workspaceIds = await accessibleWorkspaceIds(user);
  const rows = await prisma.workspace.findMany({
    where: { id: { in: workspaceIds } },
    select: {
      id: true,
      slug: true,
      name: true,
      _count: {
        select: {
          messages: { where: { status: "PENDING_APPROVAL" } },
          posts: { where: { status: "PENDING_APPROVAL" } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((w) => ({
    id: w.id,
    slug: w.slug,
    name: w.name,
    pending: w._count.messages + w._count.posts,
  }));
});

/**
 * Full dashboard cards — heavier, only used by the home page. Includes
 * contact, logo, accent color, and last-activity timestamp.
 */
export async function workspacesForTeamDashboard(user: AuthedUser) {
  const workspaceIds = await accessibleWorkspaceIds(user);
  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: workspaceIds } },
    include: {
      _count: {
        select: {
          messages: { where: { status: "PENDING_APPROVAL" } },
        },
      },
      messages: {
        where: { status: { in: ["APPROVED", "SENT", "REPLIED"] } },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true, status: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    contactName: w.contactName,
    logoUrl: w.logoUrl,
    accentColor: w.accentColor,
    pending: w._count.messages,
    lastActivity: w.messages[0]?.updatedAt ?? null,
  }));
}

export async function recentActivity(user: AuthedUser, limit = 8) {
  const workspaceIds = await accessibleWorkspaceIds(user);
  return prisma.messageEvent.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      eventType: { in: ["APPROVED", "REJECTED", "SENT", "REPLIED", "SUBMITTED_FOR_APPROVAL"] },
    },
    include: {
      actor: true,
      message: { include: { prospect: true } },
      workspace: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Workspace cards for the V1 picker home page (app/page.tsx).
 *
 * Each card shows:
 *   - workspace name + logo / first contact photo / initials
 *   - "N awaiting your decision"  (NEEDS_APPROVER_DECISION + PENDING_APPROVAL)
 *   - "M total"                   (non-archived prospects)
 *   - "Avg ICP score: X.Y / 4"    (mean icpScore across non-archived prospects)
 *   - last activity timestamp     (most recent ProspectEvent.occurredAt)
 *   - up to 3 member avatars      (Membership rows w/ user)
 */
export async function workspacePickerCards(user: AuthedUser) {
  const workspaceIds = await accessibleWorkspaceIds(user);

  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: workspaceIds } },
    select: {
      id: true,
      slug: true,
      name: true,
      contactName: true,
      logoUrl: true,
      accentColor: true,
      contacts: {
        where: { isPrimary: true },
        take: 1,
        select: { fullName: true },
      },
      memberships: {
        select: {
          id: true,
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        take: 6,
      },
      prospects: {
        where: { archived: false },
        select: { id: true, status: true, icpScore: true },
      },
      prospectEvents: {
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { occurredAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return workspaces.map((w) => {
    const total = w.prospects.length;
    const awaiting = w.prospects.filter(
      (p) =>
        p.status === "NEEDS_APPROVER_DECISION" ||
        p.status === "PENDING_APPROVAL"
    ).length;
    const avgIcp =
      total > 0
        ? w.prospects.reduce((sum, p) => sum + p.icpScore, 0) / total
        : null;
    return {
      id: w.id,
      slug: w.slug,
      name: w.name,
      logoUrl: w.logoUrl,
      accentColor: w.accentColor,
      contactName: w.contacts[0]?.fullName ?? w.contactName,
      total,
      awaiting,
      avgIcp,
      members: w.memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name ?? m.user.email,
        image: m.user.image,
      })),
      lastActivity: w.prospectEvents[0]?.occurredAt ?? null,
    };
  });
}

/* ─── Workspace detail ───────────────────────────────────────── */

export async function prospectsForWorkspace(workspaceId: string) {
  return prisma.prospect.findMany({
    where: { workspaceId, archived: false },
    select: {
      id: true,
      fullName: true,
      company: true,
      title: true,
      status: true,
      icpScore: true,
      icpCompanyFit: true,
      icpSeniorityFit: true,
      icpContextFit: true,
      icpGeographyFit: true,
      signalType: true,
      approverDecision: true,
      updatedAt: true,
      assigneeId: true,
      assignee: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
}

/** Archived prospects for the archive view. */
export async function archivedProspectsForWorkspace(workspaceId: string) {
  return prisma.prospect.findMany({
    where: { workspaceId, archived: true },
    select: {
      id: true,
      fullName: true,
      company: true,
      title: true,
      status: true,
      icpScore: true,
      signalType: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** Full settings bundle for a workspace — profile + contacts + onboarding. */
export async function workspaceSettings(workspaceId: string) {
  const [workspace, contacts, onboarding] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.clientContact.findMany({
      where: { workspaceId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    }),
    prisma.onboardingResponse.findMany({
      where: { workspaceId },
      orderBy: { orderIndex: "asc" },
    }),
  ]);
  return { workspace, contacts, onboarding };
}

/**
 * Full members + permissions matrix for the Members modal. Returns every
 * Membership row in the workspace plus the user data needed to render the
 * row (name, email, image), plus the permission flag set.
 */
export async function workspaceMembersForModal(workspaceId: string) {
  const [memberships, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.invite.findMany({
      where: {
        workspaceId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const members = memberships.map((m) => ({
    kind: "member" as const,
    membershipId: m.id,
    userId: m.user.id,
    name: m.user.name ?? m.user.email,
    email: m.user.email,
    image: m.user.image,
    systemRole: m.user.role,
    workspaceRole: m.role,
    isWorkspaceOwner: m.isWorkspaceOwner,
    canApprove: m.canApprove,
    canEdit: m.canEdit,
    canSend: m.canSend,
    canAdmin: m.canAdmin,
    notifyOnApprovalRequested: m.notifyOnApprovalRequested,
    notifyOnNewProspect: m.notifyOnNewProspect,
    notifyOnStatusChange: m.notifyOnStatusChange,
    notifyOnComment: m.notifyOnComment,
    createdAt: m.createdAt,
  }));

  const pending = invites.map((i) => ({
    kind: "invite" as const,
    inviteId: i.id,
    email: i.email,
    systemRole: i.systemRole,
    workspaceRole: i.workspaceRole,
    canApprove: i.canApprove,
    canEdit: i.canEdit,
    canSend: i.canSend,
    canAdmin: i.canAdmin,
    notifyOnApprovalRequested: false, // Invite has no notifyOnApprovalRequested column; matrix renders read-only
    notifyOnNewProspect: i.notifyOnNewProspect,
    notifyOnStatusChange: i.notifyOnStatusChange,
    notifyOnComment: i.notifyOnComment,
    createdAt: i.createdAt,
    expiresAt: i.expiresAt,
  }));

  return { members, pending };
}

/** Team members (non-client) who have access to this workspace. */
export async function workspaceAssignees(workspaceId: string) {
  const memberships = await prisma.membership.findMany({
    where: {
      workspaceId,
      role: { in: ["ADMIN", "TEAM_MEMBER"] },
    },
    include: { user: true },
  });
  return memberships.map((m) => m.user);
}

export async function prospectDetail(prospectId: string) {
  return prisma.prospect.findUnique({
    where: { id: prospectId },
    include: {
      workspace: { include: { icp: true } },
      assignee: true,
      messages: {
        orderBy: { createdAt: "desc" },
        include: {
          drafter: true,
          approver: true,
          sender: true,
          events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
}

/**
 * Unified prospect timeline — merges ProspectEvent (LinkedIn connection,
 * notes, external calls/emails/meetings) with MessageEvent (portal-tracked
 * draft/approve/send/reply events). Sorted newest-first.
 */
export async function prospectTimeline(prospectId: string) {
  const [prospectEvents, messageEvents] = await Promise.all([
    prisma.prospectEvent.findMany({
      where: { prospectId },
      include: { actor: true },
    }),
    prisma.messageEvent.findMany({
      where: { message: { prospectId } },
      include: {
        actor: true,
        message: { select: { id: true, body: true } },
      },
    }),
  ]);

  type Entry = {
    id: string;
    source: "prospect" | "message";
    eventType: string;
    occurredAt: Date;
    actor: { id: string; name: string };
    note: string | null;
    messageId: string | null;
    messagePreview: string | null;
  };

  const entries: Entry[] = [];
  for (const e of prospectEvents) {
    entries.push({
      id: `p:${e.id}`,
      source: "prospect",
      eventType: e.eventType,
      occurredAt: e.occurredAt,
      actor: { id: e.actor.id, name: e.actor.name ?? "—" },
      note: e.note,
      messageId: null,
      messagePreview: null,
    });
  }
  for (const e of messageEvents) {
    entries.push({
      id: `m:${e.id}`,
      source: "message",
      eventType: e.eventType,
      occurredAt: e.createdAt,
      actor: { id: e.actor.id, name: e.actor.name ?? "—" },
      note: null,
      messageId: e.message.id,
      messagePreview: e.message.body.slice(0, 140),
    });
  }

  return entries.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

/* ─── Client-side queries ────────────────────────────────────── */

export async function clientHomeData(user: AuthedUser) {
  // Client users should have exactly one workspace
  const workspaceId = user.memberships[0]?.workspaceId;
  if (!workspaceId) return null;

  const [
    workspace,
    pendingMessages,
    pendingPosts,
    weeklyApproved,
    weeklySent,
    weeklyReplied,
    weeklyPosted,
    recentReplies,
  ] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
      },
    }),
    prisma.message.findMany({
      where: { workspaceId, status: "PENDING_APPROVAL" },
      include: { prospect: true, drafter: true },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.post.findMany({
      where: { workspaceId, status: "PENDING_APPROVAL" },
      include: {
        drafter: true,
        media: { orderBy: { orderIndex: "asc" } },
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.message.count({
      where: {
        workspaceId,
        approvedAt: { gte: sevenDaysAgo() },
        status: { in: ["APPROVED", "SENT", "REPLIED"] },
      },
    }),
    prisma.message.count({
      where: { workspaceId, sentAt: { gte: sevenDaysAgo() } },
    }),
    prisma.message.count({
      where: { workspaceId, repliedAt: { gte: sevenDaysAgo() } },
    }),
    prisma.post.count({
      where: { workspaceId, postedAt: { gte: sevenDaysAgo() } },
    }),
    prisma.message.findMany({
      where: { workspaceId, status: "REPLIED" },
      include: { prospect: true },
      orderBy: { repliedAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    workspace,
    pendingMessages,
    pendingPosts,
    metrics: {
      approved: weeklyApproved,
      sent: weeklySent,
      replied: weeklyReplied,
      posted: weeklyPosted,
      responseRate:
        weeklySent > 0 ? Math.round((weeklyReplied / weeklySent) * 100) : 0,
    },
    recentReplies,
  };
}

export async function clientMessageForApproval(messageId: string, user: AuthedUser) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { prospect: true, workspace: true, drafter: true },
  });
  if (!message) return null;

  const workspaceIds = await accessibleWorkspaceIds(user);
  if (!workspaceIds.includes(message.workspaceId)) return null;

  return message;
}

/* ─── Posts (content pipeline) ───────────────────────────────── */

/**
 * Slim list for the content kanban / list page. Drops approver/poster and
 * the full media array — only `mediaCount` + the first media url are
 * actually rendered. The page does its own status grouping in-memory.
 */
export async function postsForWorkspace(workspaceId: string) {
  const posts = await prisma.post.findMany({
    where: { workspaceId },
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      updatedAt: true,
      drafter: { select: { name: true } },
      _count: { select: { media: true } },
      media: {
        orderBy: { orderIndex: "asc" },
        take: 1,
        select: { url: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return { all: posts };
}

export async function postDetail(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: {
      workspace: {
        include: {
          icp: true,
          contacts: { where: { isPrimary: true } },
        },
      },
      drafter: true,
      approver: true,
      poster: true,
      events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
      media: { orderBy: { orderIndex: "asc" } },
    },
  });
}

/** Unified approval queue: pending messages + pending posts together. */
export async function pendingApprovalsUnified(user: AuthedUser) {
  const workspaceIds = await accessibleWorkspaceIds(user);

  const [messages, posts] = await Promise.all([
    prisma.message.findMany({
      where: { workspaceId: { in: workspaceIds }, status: "PENDING_APPROVAL" },
      include: { prospect: true, workspace: true, drafter: true },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.post.findMany({
      where: { workspaceId: { in: workspaceIds }, status: "PENDING_APPROVAL" },
      include: {
        workspace: true,
        drafter: true,
        media: { orderBy: { orderIndex: "asc" } },
      },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  return { messages, posts };
}

/** Count pending work for sidebar badges. Posts + messages combined. */
export async function pendingCountsPerWorkspace(user: AuthedUser) {
  const workspaceIds = await accessibleWorkspaceIds(user);

  const [messages, posts] = await Promise.all([
    prisma.message.groupBy({
      by: ["workspaceId"],
      where: { workspaceId: { in: workspaceIds }, status: "PENDING_APPROVAL" },
      _count: { _all: true },
    }),
    prisma.post.groupBy({
      by: ["workspaceId"],
      where: { workspaceId: { in: workspaceIds }, status: "PENDING_APPROVAL" },
      _count: { _all: true },
    }),
  ]);

  const map: Record<string, number> = {};
  for (const row of messages) {
    map[row.workspaceId] = (map[row.workspaceId] ?? 0) + row._count._all;
  }
  for (const row of posts) {
    map[row.workspaceId] = (map[row.workspaceId] ?? 0) + row._count._all;
  }
  return map;
}

/* ─── Notifications outbox ───────────────────────────────────── */

export async function notificationOutbox(user: AuthedUser, limit = 50) {
  const workspaceIds = await accessibleWorkspaceIds(user);
  return prisma.notification.findMany({
    where: { workspaceId: { in: workspaceIds } },
    include: { workspace: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/* ─── Admin audit log ────────────────────────────────────────── */

/**
 * Admin-only unified audit log — merges ProspectEvent, MessageEvent, and
 * PostEvent across every workspace into a single timeline. Filters apply
 * uniformly across all three sources; results are sorted newest-first.
 */
export async function adminAuditLog(opts?: {
  workspaceId?: string;
  actorId?: string;
  eventType?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}) {
  const limit = opts?.limit ?? 200;
  const workspaceFilter = opts?.workspaceId ? { workspaceId: opts.workspaceId } : {};
  const actorFilter = opts?.actorId ? { actorId: opts.actorId } : {};
  const typeFilter = opts?.eventType ? { eventType: opts.eventType as never } : {};

  // ProspectEvent uses occurredAt as the canonical timestamp; the others
  // only have createdAt. Filter both fields where applicable so the date
  // range applies sensibly to every source.
  const prospectDateFilter =
    opts?.fromDate || opts?.toDate
      ? {
          occurredAt: {
            ...(opts?.fromDate ? { gte: opts.fromDate } : {}),
            ...(opts?.toDate ? { lte: opts.toDate } : {}),
          },
        }
      : {};
  const createdAtFilter =
    opts?.fromDate || opts?.toDate
      ? {
          createdAt: {
            ...(opts?.fromDate ? { gte: opts.fromDate } : {}),
            ...(opts?.toDate ? { lte: opts.toDate } : {}),
          },
        }
      : {};

  const [prospectEvents, messageEvents, postEvents] = await Promise.all([
    prisma.prospectEvent.findMany({
      where: {
        ...workspaceFilter,
        ...actorFilter,
        ...typeFilter,
        ...prospectDateFilter,
      },
      include: {
        actor: true,
        workspace: true,
        prospect: { select: { id: true, fullName: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: limit,
    }),
    prisma.messageEvent.findMany({
      where: {
        ...workspaceFilter,
        ...actorFilter,
        ...typeFilter,
        ...createdAtFilter,
      },
      include: {
        actor: true,
        workspace: true,
        message: {
          select: {
            id: true,
            body: true,
            prospect: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.postEvent.findMany({
      where: {
        ...workspaceFilter,
        ...actorFilter,
        ...typeFilter,
        ...createdAtFilter,
      },
      include: {
        actor: true,
        workspace: true,
        post: { select: { id: true, title: true, body: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  type Entry = {
    id: string;
    source: "prospect" | "message" | "post";
    eventType: string;
    actor: { id: string; name: string };
    workspace: { id: string; name: string; slug: string };
    occurredAt: Date;
    target: { type: "prospect" | "message" | "post"; id: string; name: string };
  };

  const entries: Entry[] = [];

  for (const e of prospectEvents) {
    entries.push({
      id: `p:${e.id}`,
      source: "prospect",
      eventType: e.eventType,
      actor: { id: e.actor.id, name: e.actor.name ?? "—" },
      workspace: { id: e.workspace.id, name: e.workspace.name, slug: e.workspace.slug },
      occurredAt: e.occurredAt,
      target: { type: "prospect", id: e.prospect.id, name: e.prospect.fullName },
    });
  }
  for (const e of messageEvents) {
    const preview = e.message.body.slice(0, 40);
    entries.push({
      id: `m:${e.id}`,
      source: "message",
      eventType: e.eventType,
      actor: { id: e.actor.id, name: e.actor.name ?? "—" },
      workspace: { id: e.workspace.id, name: e.workspace.name, slug: e.workspace.slug },
      occurredAt: e.createdAt,
      target: {
        type: "message",
        id: e.message.id,
        name: `${e.message.prospect.fullName} — ${preview}`,
      },
    });
  }
  for (const e of postEvents) {
    const preview = e.post.body.slice(0, 40);
    entries.push({
      id: `pe:${e.id}`,
      source: "post",
      eventType: e.eventType,
      actor: { id: e.actor.id, name: e.actor.name ?? "—" },
      workspace: { id: e.workspace.id, name: e.workspace.name, slug: e.workspace.slug },
      occurredAt: e.createdAt,
      target: {
        type: "post",
        id: e.post.id,
        name: `${e.post.title ?? "Untitled"} — ${preview}`,
      },
    });
  }

  return entries
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit);
}

/** Distinct actors and workspaces — used to populate audit log filter dropdowns. */
export async function auditLogFilterOptions() {
  const [workspaces, actors] = await Promise.all([
    prisma.workspace.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "TEAM_MEMBER", "CLIENT"] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { workspaces, actors };
}

/* ─── Helpers ────────────────────────────────────────────────── */

function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 86400000);
}

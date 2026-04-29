import { prisma } from "./db";
import type { AuthedUser } from "./auth";

/**
 * Data-access layer. Every query that returns workspace-scoped data accepts
 * a user, filters by their accessible workspace ids, and returns typed
 * results. One place for the scoping guard — pages just call these.
 */

/** Workspace ids the user can see. ADMIN sees all; others only their memberships. */
export async function accessibleWorkspaceIds(user: AuthedUser): Promise<string[]> {
  if (user.role === "ADMIN") {
    const all = await prisma.workspace.findMany({ select: { id: true } });
    return all.map((w) => w.id);
  }
  return user.memberships.map((m) => m.workspaceId);
}

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

/* ─── Workspace detail ───────────────────────────────────────── */

export async function prospectsForWorkspace(workspaceId: string) {
  return prisma.prospect.findMany({
    where: { workspaceId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      assignee: true,
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
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

/* ─── Approval queue (team cross-workspace) ──────────────────── */

export async function pendingApprovals(user: AuthedUser) {
  const workspaceIds = await accessibleWorkspaceIds(user);
  return prisma.message.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      status: "PENDING_APPROVAL",
    },
    include: {
      prospect: true,
      workspace: true,
      drafter: true,
    },
    orderBy: { updatedAt: "asc" },
  });
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

/** Kanban-ready: all posts in a workspace grouped by status. */
export async function postsForWorkspace(workspaceId: string) {
  const posts = await prisma.post.findMany({
    where: { workspaceId },
    include: {
      drafter: true,
      approver: true,
      poster: true,
      media: { orderBy: { orderIndex: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return {
    all: posts,
    byStatus: {
      DRAFT: posts.filter((p) => p.status === "DRAFT"),
      PENDING_APPROVAL: posts.filter((p) => p.status === "PENDING_APPROVAL"),
      APPROVED: posts.filter((p) => p.status === "APPROVED"),
      POSTED: posts.filter((p) => p.status === "POSTED"),
      REJECTED: posts.filter((p) => p.status === "REJECTED"),
    },
  };
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

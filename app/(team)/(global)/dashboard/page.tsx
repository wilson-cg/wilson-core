import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Clock,
  AlertCircle,
  PenLine,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { WorkspaceLogo } from "@/components/settings/workspace-logo";
import { requireRole } from "@/lib/auth";
import {
  teamDashboardSummary,
  workspacesForTeamDashboard,
  recentActivity,
} from "@/lib/queries";
import { formatDistanceToNow, format } from "date-fns";

/**
 * Team dashboard home. Real data. All numbers come from the DB, no stubs.
 *
 * Information hierarchy, top to bottom:
 *   1. Today's priorities   — dynamic, surfaced from DB state
 *   2. This week's pipeline — weekly funnel from MessageEvents
 *   3. Your clients         — live workspace rows
 *   4. Recent activity      — MessageEvent feed
 */
export default async function TeamDashboardPage() {
  const user = await requireRole("ADMIN", "TEAM_MEMBER");
  const [summary, workspaces, events] = await Promise.all([
    teamDashboardSummary(user),
    workspacesForTeamDashboard(user),
    recentActivity(user, 6),
  ]);

  // Derive today's priorities dynamically
  const priorities = derivePriorities(summary, workspaces);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
          {format(new Date(), "EEEE, d MMMM")}
        </p>
        <h1 className="app-heading mt-1 text-2xl text-[var(--color-charcoal)]">
          {greeting()}, {user.name.split(" ")[0]}
        </h1>
      </header>

      <div className="mx-auto max-w-5xl space-y-10 px-8 py-10">
        {/* 1. Today — the single hero */}
        <section className="rounded-[var(--radius-xl)] border bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Today
              </p>
              <h2 className="app-heading mt-0.5 text-2xl text-[var(--color-charcoal)]">
                {priorities.length > 0
                  ? `${priorities.length} thing${priorities.length === 1 ? "" : "s"} need your attention`
                  : "You're all caught up"}
              </h2>
            </div>
            {summary.pendingCount > 0 ? (
              <Button variant="accent" size="lg" asChild>
                <Link href="/dashboard/approvals">
                  Open approval queue <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>

          {priorities.length > 0 ? (
            <ul className="mt-5 divide-y divide-[var(--color-border)]">
              {priorities.map((p) => (
                <PriorityItem
                  key={p.key}
                  icon={p.icon}
                  tone={p.tone}
                  title={p.title}
                  meta={p.meta}
                  actionLabel={p.actionLabel}
                  actionHref={p.actionHref}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-[var(--color-muted-foreground)]">
              Nothing pending. Draft the next batch of messages when you&apos;re ready.
            </p>
          )}
        </section>

        {/* 2. This week — pipeline */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h3 className="app-heading text-lg text-[var(--color-forest)]">
                This week
              </h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Movement across every client workspace, last 7 days
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/reports">
                Full report <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
            <PipelineFunnel
              stages={[
                { label: "Drafted", value: summary.weekly.drafted },
                { label: "Approved", value: summary.weekly.approved },
                { label: "Sent", value: summary.weekly.sent },
                {
                  label: "Replied",
                  value: summary.weekly.replied,
                  caption:
                    summary.weekly.sent > 0
                      ? `${Math.round((summary.weekly.replied / summary.weekly.sent) * 100)}% response rate`
                      : undefined,
                },
              ]}
            />
          </div>
        </section>

        {/* 3. Clients */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h3 className="app-heading text-lg text-[var(--color-forest)]">
              Your clients
            </h3>
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
            <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-virgil)] px-5 py-2.5 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <span className="w-9">&nbsp;</span>
              <span>Client</span>
              <span className="text-right">Pending</span>
              <span className="w-6">&nbsp;</span>
            </div>
            {workspaces.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
                No clients yet.
              </div>
            ) : (
              workspaces.map((w) => (
                <ClientRow
                  key={w.id}
                  name={w.name}
                  slug={w.slug}
                  contact={w.contactName}
                  pending={w.pending}
                  lastActivity={w.lastActivity}
                  logoUrl={w.logoUrl}
                  accentColor={w.accentColor}
                />
              ))
            )}
          </div>
        </section>

        {/* 4. Recent activity */}
        <section>
          <h3 className="app-heading mb-3 text-sm text-[var(--color-muted-foreground)]">
            Recent activity
          </h3>
          {events.length === 0 ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Nothing yet.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {events.map((e) => (
                <ActivityLine
                  key={e.id}
                  when={formatDistanceToNow(e.createdAt, { addSuffix: true })}
                  text={formatEventText(e)}
                  workspace={e.workspace.name}
                  badge={eventToBadge(e.eventType)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─── Derivations ─────────────────────────────────────────────── */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function derivePriorities(
  summary: Awaited<ReturnType<typeof teamDashboardSummary>>,
  workspaces: Awaited<ReturnType<typeof workspacesForTeamDashboard>>
) {
  const out: PriorityProps[] = [];
  const biggestPending = workspaces
    .filter((w) => w.pending > 0)
    .sort((a, b) => b.pending - a.pending)[0];

  if (summary.pendingCount > 0) {
    out.push({
      key: "pending",
      icon: Clock,
      tone: "warn",
      title: `${summary.pendingCount} message${summary.pendingCount === 1 ? "" : "s"} waiting for client approval`,
      meta: biggestPending
        ? `Mostly ${biggestPending.name} (${biggestPending.pending} drafts)`
        : "Across your workspaces",
      actionLabel: "Open queue",
      actionHref: "/dashboard/approvals",
    });
  }

  if (summary.rejectedCount > 0) {
    out.push({
      key: "rejected",
      icon: AlertCircle,
      tone: "warn",
      title: `${summary.rejectedCount} draft${summary.rejectedCount === 1 ? "" : "s"} rejected — needs rewriting`,
      meta: "Client left notes on each",
      actionLabel: "Review & rewrite",
      actionHref: "/dashboard/approvals?filter=rejected",
    });
  }

  // If nothing waiting, nudge draft activity
  if (out.length === 0 && summary.weekly.drafted < 5) {
    out.push({
      key: "draft-nudge",
      icon: PenLine,
      tone: "info",
      title: "Low draft volume this week",
      meta: "Consider drafting the next batch of messages",
      actionLabel: "Browse clients",
      actionHref: "#clients",
    });
  }

  return out;
}

/* ─── Components ─────────────────────────────────────────────── */

type PriorityProps = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "warn" | "info" | "muted";
  title: string;
  meta: string;
  actionLabel: string;
  actionHref: string;
};

function PriorityItem({ icon: Icon, tone, title, meta, actionLabel, actionHref }: Omit<PriorityProps, "key">) {
  const iconWrap = {
    warn: "bg-[var(--color-bee)]/25 text-[var(--color-charcoal)]",
    info: "bg-[var(--color-forest-100)] text-[var(--color-forest)]",
    muted: "bg-[var(--color-virgil-dark)] text-[var(--color-charcoal-500)]",
  }[tone];

  return (
    <li className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-charcoal)]">{title}</p>
        <p className="truncate text-xs text-[var(--color-muted-foreground)]">{meta}</p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </li>
  );
}

function PipelineFunnel({
  stages,
}: {
  stages: { label: string; value: number; caption?: string }[];
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  const tones = [
    "bg-[var(--color-forest-100)]",
    "bg-[var(--color-lime)]/70",
    "bg-[var(--color-teal)]",
    "bg-[var(--color-aperol)]",
  ];

  return (
    <div className="space-y-3">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className="w-20 shrink-0 text-xs font-medium text-[var(--color-charcoal-500)]">
            {s.label}
          </div>
          <div className="relative h-7 flex-1 overflow-hidden rounded-full bg-[var(--color-virgil)]">
            <div
              className={`h-full rounded-full ${tones[i]} transition-all`}
              style={{ width: `${Math.max(3, (s.value / max) * 100)}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-3">
              <span className="text-xs font-semibold text-[var(--color-charcoal)]">
                {s.value}
              </span>
              {s.caption ? (
                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-charcoal-500)]">
                  {s.caption}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClientRow({
  name,
  slug,
  contact,
  pending,
  lastActivity,
  logoUrl,
  accentColor,
}: {
  name: string;
  slug: string;
  contact: string;
  pending: number;
  lastActivity: Date | null;
  logoUrl: string | null;
  accentColor: string | null;
}) {
  return (
    <Link
      href={`/dashboard/workspaces/${slug}/content`}
      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-[var(--color-border)] px-5 py-3.5 transition-colors last:border-b-0 hover:bg-[var(--color-virgil)]"
    >
      <WorkspaceLogo
        name={name}
        logoUrl={logoUrl}
        accentColor={accentColor}
        size="md"
      />
      <div className="min-w-0">
        <div className="truncate font-medium text-[var(--color-charcoal)]">{name}</div>
        <p className="truncate text-xs text-[var(--color-muted-foreground)]">
          {contact}
          {lastActivity
            ? ` · Last approval ${formatDistanceToNow(lastActivity, { addSuffix: true })}`
            : " · No activity yet"}
        </p>
      </div>
      <div className="text-right">
        <div
          className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-semibold ${
            pending > 0
              ? "bg-[var(--color-lime)] text-[var(--color-forest-950)]"
              : "bg-[var(--color-virgil-dark)] text-[var(--color-muted-foreground)]"
          }`}
        >
          {pending}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-[var(--color-charcoal-300)]" />
    </Link>
  );
}

function ActivityLine({
  when,
  text,
  workspace,
  badge,
}: {
  when: string;
  text: string;
  workspace: string;
  badge: "approved" | "replied" | "rejected" | "sent" | "pending";
}) {
  return (
    <li className="flex items-center gap-3 text-[var(--color-charcoal-500)]">
      <span className="w-28 shrink-0 text-[var(--color-muted-foreground)]">{when}</span>
      <span className="min-w-0 flex-1 truncate">
        {text} <span className="text-[var(--color-muted-foreground)]">· {workspace}</span>
      </span>
      <Badge variant={badge}>{badge}</Badge>
    </li>
  );
}

function formatEventText(e: Awaited<ReturnType<typeof recentActivity>>[number]) {
  const prospect = e.message.prospect.fullName;
  const actor = e.actor.name;
  switch (e.eventType) {
    case "APPROVED":
      return `${actor} approved ${prospect}`;
    case "REJECTED":
      return `${actor} rejected ${prospect}`;
    case "SENT":
      return `${actor} sent to ${prospect}`;
    case "REPLIED":
      return `${prospect} replied`;
    case "SUBMITTED_FOR_APPROVAL":
      return `${actor} submitted ${prospect} for approval`;
    default:
      return `${actor} · ${e.eventType.toLowerCase()}`;
  }
}

function eventToBadge(type: string): "approved" | "replied" | "rejected" | "sent" | "pending" {
  switch (type) {
    case "APPROVED":
    case "EDITED_AND_APPROVED":
      return "approved";
    case "REPLIED":
      return "replied";
    case "REJECTED":
      return "rejected";
    case "SENT":
      return "sent";
    default:
      return "pending";
  }
}

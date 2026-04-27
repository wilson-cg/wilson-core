import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prospectDetail, prospectTimeline } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ExternalLink,
  Check,
  MessageCircleReply,
  Mail,
  MapPin,
  Tag,
  Link as LinkIcon,
  UserPlus,
  Phone,
  Video,
  StickyNote,
  CircleDot,
  ArrowRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { LogActivityIsland } from "./log-activity";
import { EditInfoIsland } from "./edit-info";
import { EditDatesIsland } from "./edit-dates";
import { MessageThread, type ThreadMessage } from "./message-thread";

/**
 * Prospect workbench — full CRM view with multi-message thread.
 *
 * Layout (two-column on large screens):
 *   Left column:
 *     - Prospect header (name, title/company, fit + status badges)
 *     - Message thread (every outbound message + their statuses)
 *     - Activity timeline (ProspectEvents + MessageEvents merged)
 *   Right rail:
 *     - CRM info panel (LinkedIn, email, location, tags, dates, assignee)
 *     - Log activity quick form
 *     - ICP voice reference
 */
export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  await requireRole("ADMIN", "TEAM_MEMBER");
  const { slug, id } = await params;
  const prospect = await prospectDetail(id);
  if (!prospect) notFound();
  if (prospect.workspace.slug !== slug) notFound();

  const timeline = await prospectTimeline(prospect.id);

  // Serialize messages for the client island (newest first)
  const threadMessages: ThreadMessage[] = prospect.messages.map((m) => ({
    id: m.id,
    body: m.body,
    status: m.status as ThreadMessage["status"],
    version: m.version,
    rejectionNote: m.rejectionNote,
    approvedAt: m.approvedAt?.toISOString() ?? null,
    sentAt: m.sentAt?.toISOString() ?? null,
    repliedAt: m.repliedAt?.toISOString() ?? null,
    approverName: m.approver?.name ?? null,
    drafterName: m.drafter.name,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <Link
          href={`/dashboard/workspaces/${slug}/prospects`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> Prospects
        </Link>
        <div className="mt-2 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest)] text-lg font-semibold text-[var(--color-lime)]">
            {initials(prospect.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="app-heading text-2xl leading-tight text-[var(--color-charcoal)]">
              {prospect.fullName}
            </h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {prospect.title ? `${prospect.title} · ` : ""}
              {prospect.company}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={fitToBadge(prospect.fitScore)}>
                {humanizeFit(prospect.fitScore)}
              </Badge>
              <Badge variant={statusToBadge(prospect.status)}>
                {humanizeStatus(prospect.status)}
              </Badge>
              {prospect.assignee ? (
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  Owner: {prospect.assignee.name}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={prospect.linkedinUrl} target="_blank" rel="noreferrer">
                LinkedIn <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <EditInfoIsland
              prospectId={prospect.id}
              fullName={prospect.fullName}
              title={prospect.title}
              company={prospect.company}
              email={prospect.email}
              location={prospect.location}
              linkedinUrl={prospect.linkedinUrl}
              tags={prospect.tags}
              fitScore={prospect.fitScore}
              notes={prospect.notes}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-8 py-8 lg:grid-cols-[1fr_340px]">
        {/* LEFT — message thread + timeline */}
        <main className="space-y-8">
          <MessageThread
            prospectId={prospect.id}
            prospectName={prospect.fullName}
            messages={threadMessages}
          />

          <Timeline entries={timeline} />
        </main>

        {/* RIGHT — CRM info panel */}
        <aside className="space-y-4">
          <section className="overflow-hidden rounded-[var(--radius-md)] border bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
            <div className="border-b border-[var(--color-border)] bg-[var(--color-virgil)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Contact
            </div>
            <InfoRow icon={LinkIcon} label="LinkedIn">
              <a
                href={prospect.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-xs text-[var(--color-forest)] hover:underline"
              >
                {prospect.linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\//, "")}
              </a>
            </InfoRow>
            <InfoRow icon={Mail} label="Email">
              {prospect.email ? (
                <a
                  href={`mailto:${prospect.email}`}
                  className="truncate text-xs text-[var(--color-forest)] hover:underline"
                >
                  {prospect.email}
                </a>
              ) : (
                <span className="text-xs italic text-[var(--color-muted-foreground)]">
                  Not set
                </span>
              )}
            </InfoRow>
            <InfoRow icon={MapPin} label="Location">
              <span className="truncate text-xs text-[var(--color-charcoal)]">
                {prospect.location ?? "—"}
              </span>
            </InfoRow>
            <InfoRow icon={Tag} label="Tags">
              <div className="flex min-w-0 flex-wrap gap-1">
                {prospect.tags ? (
                  prospect.tags.split(",").map((t) => {
                    const tag = t.trim();
                    if (!tag) return null;
                    return (
                      <span
                        key={tag}
                        className="inline-flex rounded-full bg-[var(--color-virgil-dark)] px-2 py-px text-[10px] text-[var(--color-charcoal-500)]"
                      >
                        {tag}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-xs italic text-[var(--color-muted-foreground)]">
                    None
                  </span>
                )}
              </div>
            </InfoRow>
          </section>

          <section className="overflow-hidden rounded-[var(--radius-md)] border bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
            <div className="border-b border-[var(--color-border)] bg-[var(--color-virgil)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Dates
            </div>
            <EditDatesIsland
              prospectId={prospect.id}
              linkedinConnectedAt={toDateInput(prospect.linkedinConnectedAt)}
              lastContactedAt={toDateInput(prospect.lastContactedAt)}
            />
            <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-3 py-2">
              <span className="text-[11px] text-[var(--color-muted-foreground)]">
                Added
              </span>
              <span className="text-xs text-[var(--color-charcoal)]">
                {format(prospect.createdAt, "d MMM yyyy")}
              </span>
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Activity
            </div>
            <LogActivityIsland prospectId={prospect.id} />
          </section>

          {prospect.notes ? (
            <section className="rounded-[var(--radius-md)] border bg-[var(--color-bee)]/15 p-3">
              <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-charcoal-500)]">
                <StickyNote className="h-3 w-3" /> Internal notes
              </div>
              <p className="whitespace-pre-line text-xs text-[var(--color-charcoal)]">
                {prospect.notes}
              </p>
            </section>
          ) : null}

          {prospect.workspace.icp ? (
            <section className="rounded-[var(--radius-md)] border bg-[var(--color-virgil)] p-3">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Voice reference
              </div>
              <p className="text-xs text-[var(--color-charcoal-500)]">
                {prospect.workspace.icp.toneOfVoice}
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/* ─── Info row ─────────────────────────────────────────────── */

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-3 py-2 first:border-t-0">
      <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}

/* ─── Timeline ─────────────────────────────────────────────── */

type TimelineEntry = Awaited<ReturnType<typeof prospectTimeline>>[number];

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <section>
        <h3 className="app-heading mb-3 text-sm text-[var(--color-muted-foreground)]">
          Timeline
        </h3>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          No activity recorded yet.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="app-heading mb-3 text-sm text-[var(--color-muted-foreground)]">
        Timeline
      </h3>
      <ol className="relative space-y-3 border-l border-[var(--color-border)] pl-5">
        {entries.map((e) => (
          <li key={e.id} className="relative">
            <span
              className={`absolute -left-[22px] top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-[var(--color-background)] ${eventDot(e.eventType, e.source)}`}
              aria-hidden
            />
            <div className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <EventIcon type={e.eventType} source={e.source} />
                <span className="font-medium text-[var(--color-charcoal)]">
                  {eventTitle(e.eventType, e.source)}
                </span>
                <span className="text-[var(--color-muted-foreground)]">
                  by {e.actor.name}
                </span>
                <span className="ml-auto text-[10px] text-[var(--color-muted-foreground)]">
                  {format(e.occurredAt, "d MMM yyyy · HH:mm")}
                  {" · "}
                  {formatDistanceToNow(e.occurredAt, { addSuffix: true })}
                </span>
              </div>
              {e.note ? (
                <p className="mt-1.5 text-xs text-[var(--color-charcoal-500)]">
                  {e.note}
                </p>
              ) : null}
              {e.messagePreview ? (
                <p className="mt-1.5 line-clamp-2 rounded-[var(--radius-sm)] bg-[var(--color-virgil)] px-2 py-1 text-[11px] italic text-[var(--color-charcoal-500)]">
                  {e.messagePreview}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function eventTitle(type: string, source: "prospect" | "message"): string {
  if (source === "message") {
    const map: Record<string, string> = {
      DRAFTED: "Message drafted",
      SUBMITTED_FOR_APPROVAL: "Submitted for approval",
      APPROVED: "Client approved",
      EDITED_AND_APPROVED: "Client edited & approved",
      REJECTED: "Client rejected",
      SENT: "Message sent",
      REPLIED: "Prospect replied",
      STATUS_CHANGED: "Status changed",
      NOTE_ADDED: "Note added",
    };
    return map[type] ?? type;
  }
  const map: Record<string, string> = {
    ADDED: "Added to CRM",
    LINKEDIN_CONNECTION_SENT: "LinkedIn connection sent",
    LINKEDIN_CONNECTION_ACCEPTED: "LinkedIn connection accepted",
    CONTACTED: "Contacted",
    CALL: "Call",
    EMAIL: "Email",
    MEETING: "Meeting",
    NOTE_ADDED: "Note",
    CUSTOM: "Activity",
  };
  return map[type] ?? type;
}

function eventDot(type: string, source: "prospect" | "message"): string {
  if (source === "message") {
    if (["APPROVED", "EDITED_AND_APPROVED"].includes(type))
      return "bg-[var(--color-lime)]";
    if (type === "SENT") return "bg-[var(--color-teal)]";
    if (type === "REPLIED") return "bg-[var(--color-aperol)]";
    if (type === "REJECTED") return "bg-[var(--color-raspberry)]";
    return "bg-[var(--color-forest-100)]";
  }
  if (type === "ADDED") return "bg-[var(--color-charcoal-300)]";
  if (type.startsWith("LINKEDIN")) return "bg-[var(--color-forest)]";
  if (type === "CALL" || type === "EMAIL") return "bg-[var(--color-teal)]";
  if (type === "MEETING") return "bg-[var(--color-forest)]";
  return "bg-[var(--color-grapefruit)]";
}

function EventIcon({
  type,
  source,
}: {
  type: string;
  source: "prospect" | "message";
}) {
  const cls = "h-3 w-3 text-[var(--color-muted-foreground)]";
  if (source === "message") {
    if (type === "DRAFTED") return <StickyNote className={cls} />;
    if (type === "SUBMITTED_FOR_APPROVAL") return <ArrowRight className={cls} />;
    if (["APPROVED", "EDITED_AND_APPROVED"].includes(type))
      return <Check className={cls} />;
    if (type === "SENT") return <ArrowRight className={cls} />;
    if (type === "REPLIED") return <MessageCircleReply className={cls} />;
    if (type === "REJECTED") return <CircleDot className={cls} />;
    return <CircleDot className={cls} />;
  }
  if (type === "ADDED") return <UserPlus className={cls} />;
  if (type.startsWith("LINKEDIN")) return <LinkIcon className={cls} />;
  if (type === "CALL") return <Phone className={cls} />;
  if (type === "EMAIL") return <Mail className={cls} />;
  if (type === "MEETING") return <Video className={cls} />;
  if (type === "NOTE_ADDED") return <StickyNote className={cls} />;
  return <CircleDot className={cls} />;
}

/* ─── Helpers ────────────────────────────────────────────────── */

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toDateInput(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function fitToBadge(s: string) {
  if (s === "STRONG") return "approved" as const;
  if (s === "NOT_A_FIT") return "rejected" as const;
  return "drafted" as const;
}

function humanizeFit(s: string) {
  if (s === "STRONG") return "Strong fit";
  if (s === "NOT_A_FIT") return "Not a fit";
  return "Possible fit";
}

function statusToBadge(s: string) {
  const map: Record<
    string,
    | "identified"
    | "drafted"
    | "pending"
    | "approved"
    | "sent"
    | "replied"
    | "meeting"
    | "rejected"
    | "nurture"
  > = {
    IDENTIFIED: "identified",
    MESSAGE_DRAFTED: "drafted",
    PENDING_APPROVAL: "pending",
    APPROVED: "approved",
    SENT: "sent",
    REPLIED: "replied",
    MEETING_BOOKED: "meeting",
    NOT_INTERESTED: "rejected",
    NURTURE: "nurture",
  };
  return map[s] ?? "identified";
}

function humanizeStatus(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

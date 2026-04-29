import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { requireRole } from "@/lib/auth";
import { adminAuditLog, auditLogFilterOptions } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Admin-only unified audit log. Pulls every ProspectEvent, MessageEvent,
 * and PostEvent across the whole portal into one timeline. Filters use
 * URL params so links are shareable + bookmarkable; the form below
 * submits as a regular GET.
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    workspace?: string;
    actor?: string;
    type?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;

  // Default to last 30 days when no `from` is supplied.
  const defaultFrom = new Date(Date.now() - 30 * 86400000);
  const fromDate = parseDate(params.from) ?? defaultFrom;
  const toDate = parseDate(params.to);

  const [{ workspaces, actors }, entries] = await Promise.all([
    auditLogFilterOptions(),
    adminAuditLog({
      workspaceId: params.workspace || undefined,
      actorId: params.actor || undefined,
      eventType: params.type || undefined,
      fromDate,
      toDate: toDate ?? undefined,
      limit: 200,
    }),
  ]);

  const fromValue = formatDateInput(fromDate);
  const toValue = toDate ? formatDateInput(toDate) : "";

  const hasFilters = Boolean(
    params.workspace || params.actor || params.type || params.from || params.to
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <History className="h-5 w-5 text-[var(--color-forest)]" />
          <h1 className="app-heading text-2xl text-[var(--color-charcoal)]">
            Audit log
          </h1>
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Every prospect, message, and post event across every workspace.
          Newest first. Limited to 200 entries per filter.
        </p>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
        <form
          method="GET"
          className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <FilterSelect
              name="workspace"
              label="Workspace"
              value={params.workspace ?? ""}
              options={[
                { value: "", label: "All workspaces" },
                ...workspaces.map((w) => ({ value: w.id, label: w.name })),
              ]}
            />
            <FilterSelect
              name="actor"
              label="Actor"
              value={params.actor ?? ""}
              options={[
                { value: "", label: "Any actor" },
                ...actors.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${a.role.toLowerCase()})`,
                })),
              ]}
            />
            <FilterSelect
              name="type"
              label="Event type"
              value={params.type ?? ""}
              options={[
                { value: "", label: "All event types" },
                ...ALL_EVENT_TYPES.map((t) => ({ value: t, label: t })),
              ]}
            />
            <FilterDate name="from" label="From" value={fromValue} />
            <FilterDate name="to" label="To" value={toValue} />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button type="submit" variant="accent" size="sm">
              Apply filters
            </Button>
            {hasFilters ? (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/dashboard/audit">Reset</Link>
              </Button>
            ) : null}
            <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">
              Showing {entries.length} event{entries.length === 1 ? "" : "s"}
            </span>
          </div>
        </form>

        {entries.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-12 text-center shadow-[var(--shadow-card)]">
            <h2 className="app-heading text-xl text-[var(--color-forest)]">
              Nothing to show
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Try widening the date range or clearing filters.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
            <div className="grid grid-cols-[140px_1fr_140px_180px_120px] items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-virgil)] px-5 py-2.5 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <span>When</span>
              <span>Target</span>
              <span>Actor</span>
              <span>Workspace</span>
              <span className="text-right">Event</span>
            </div>
            <ul>
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-[140px_1fr_140px_180px_120px] items-center gap-4 border-b border-[var(--color-border)] px-5 py-3 text-sm last:border-b-0 hover:bg-[var(--color-virgil)]"
                >
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    <div className="text-[var(--color-charcoal-500)]">
                      {format(e.occurredAt, "d MMM yyyy")}
                    </div>
                    <div>
                      {formatDistanceToNow(e.occurredAt, { addSuffix: true })}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      {e.source}
                    </div>
                    <div className="truncate text-[var(--color-charcoal)]">
                      {e.target.name}
                    </div>
                  </div>
                  <div className="truncate text-[var(--color-charcoal-500)]">
                    {e.actor.name}
                  </div>
                  <div className="truncate text-[var(--color-forest)]">
                    {e.workspace.name}
                  </div>
                  <div className="flex justify-end">
                    <Badge variant={badgeForEvent(e.source, e.eventType)}>
                      {e.eventType.toLowerCase().replace(/_/g, " ")}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function parseDate(input: string | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Mirrors the message-event color rules used on the dashboard recent
// activity list, plus prospect→drafted (forest tint) and post→sent.
function badgeForEvent(
  source: "prospect" | "message" | "post",
  type: string
):
  | "approved"
  | "replied"
  | "rejected"
  | "sent"
  | "pending"
  | "drafted"
  | "default" {
  if (source === "message") {
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
      case "SUBMITTED_FOR_APPROVAL":
        return "pending";
      default:
        return "default";
    }
  }
  if (source === "post") {
    return "sent";
  }
  // Prospect events
  return "drafted";
}

const PROSPECT_EVENT_TYPES = [
  "ADDED",
  "LINKEDIN_CONNECTION_SENT",
  "LINKEDIN_CONNECTION_ACCEPTED",
  "CONTACTED",
  "CALL",
  "EMAIL",
  "MEETING",
  "NOTE_ADDED",
  "CUSTOM",
] as const;

const MESSAGE_EVENT_TYPES = [
  "DRAFTED",
  "SUBMITTED_FOR_APPROVAL",
  "APPROVED",
  "EDITED_AND_APPROVED",
  "REJECTED",
  "SENT",
  "REPLIED",
  "STATUS_CHANGED",
  "NOTE_ADDED",
] as const;

const POST_EVENT_TYPES = [
  "DRAFTED",
  "EDITED",
  "SUBMITTED_FOR_APPROVAL",
  "APPROVED",
  "EDITED_AND_APPROVED",
  "REJECTED",
  "POSTED",
] as const;

const ALL_EVENT_TYPES = Array.from(
  new Set<string>([
    ...PROSPECT_EVENT_TYPES,
    ...MESSAGE_EVENT_TYPES,
    ...POST_EVENT_TYPES,
  ])
).sort();

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-charcoal)] shadow-[var(--shadow-soft)] focus:border-[var(--color-forest)] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterDate({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <input
        type="date"
        name={name}
        defaultValue={value}
        className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-charcoal)] shadow-[var(--shadow-soft)] focus:border-[var(--color-forest)] focus:outline-none"
      />
    </label>
  );
}

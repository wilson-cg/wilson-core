import Link from "next/link";
import { requireRole, requireWorkspace } from "@/lib/auth";
import { prospectsForWorkspace, workspaceAssignees } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Filter as FilterIcon,
} from "lucide-react";
import { KanbanBoard, type KanbanProspect } from "./kanban-board";
import { TableByStage } from "./table-by-stage";

/**
 * Prospect CRM — pipeline board or stage-grouped table. Both views support
 * drag-and-drop: drag a card/row onto another stage to move the prospect.
 * Status change is persisted via the moveProspectToStage server action.
 *
 * This page is a server component that fetches data and hands off to the
 * DnD-enabled client components (KanbanBoard / TableByStage).
 */
export default async function WorkspaceProspectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    view?: string;
    q?: string;
    owner?: string;
    fit?: string;
  }>;
}) {
  await requireRole("ADMIN", "TEAM_MEMBER");
  const { slug } = await params;
  const sp = await searchParams;
  const view = sp.view === "table" ? "table" : "board";
  const search = (sp.q ?? "").trim().toLowerCase();
  const ownerFilter = sp.owner ?? "";
  const fitFilter = sp.fit ?? "";

  const { workspace } = await requireWorkspace(slug);
  const [allProspects, assignees] = await Promise.all([
    prospectsForWorkspace(workspace.id),
    workspaceAssignees(workspace.id),
  ]);

  // Apply filters in-memory — small dataset per workspace
  const filtered = allProspects.filter((p) => {
    if (search) {
      const hay = `${p.fullName} ${p.company} ${p.title ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (ownerFilter && p.assigneeId !== ownerFilter) return false;
    if (fitFilter && p.fitScore !== fitFilter) return false;
    return true;
  });

  // Serialize for the client components (must be plain JSON)
  const serialized: KanbanProspect[] = filtered
    .filter((p) => p.status !== "NURTURE") // nurture is a separate pool
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      company: p.company,
      title: p.title,
      status: p.status,
      fitScore: p.fitScore,
      updatedAt: p.updatedAt.toISOString(),
      assigneeName: p.assignee?.name ?? null,
      lastMessageStatus: p.messages[0]?.status ?? null,
    }));

  const nurture = filtered.filter((p) => p.status === "NURTURE");

  // Totals for Kanban column-footer metrics
  const totals = {
    totalSent: serialized.filter((p) => p.status === "SENT").length,
    replied: serialized.filter((p) => p.status === "REPLIED").length,
    meetings: serialized.filter((p) => p.status === "MEETING_BOOKED").length,
    notInterested: serialized.filter((p) => p.status === "NOT_INTERESTED")
      .length,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--color-border)] px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Prospect pipeline
            </p>
            <h1 className="app-heading mt-0.5 text-xl text-[var(--color-charcoal)]">
              {filtered.length}{" "}
              {filtered.length === 1 ? "prospect" : "prospects"}
              {filtered.length !== allProspects.length ? (
                <span className="ml-2 text-xs font-normal text-[var(--color-muted-foreground)]">
                  of {allProspects.length}
                </span>
              ) : null}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle slug={slug} view={view} searchParams={sp} />
            <Button variant="accent" size="sm" asChild>
              <Link href={`/dashboard/workspaces/${slug}/prospects/new`}>
                <Plus className="h-3.5 w-3.5" /> Add prospect
              </Link>
            </Button>
          </div>
        </div>

        <form className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="view" value={view} />

          <div className="relative flex-1 min-w-[16rem] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Search prospects, companies, titles…"
              className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] pl-9 pr-3 text-sm shadow-[var(--shadow-soft)]"
            />
          </div>

          <select
            name="owner"
            defaultValue={ownerFilter}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm shadow-[var(--shadow-soft)]"
          >
            <option value="">All owners</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <select
            name="fit"
            defaultValue={fitFilter}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm shadow-[var(--shadow-soft)]"
          >
            <option value="">All fits</option>
            <option value="STRONG">Strong fit</option>
            <option value="POSSIBLE">Possible fit</option>
            <option value="NOT_A_FIT">Not a fit</option>
          </select>

          <Button type="submit" variant="outline" size="sm">
            <FilterIcon className="h-3.5 w-3.5" /> Apply
          </Button>

          {search || ownerFilter || fitFilter ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/workspaces/${slug}/prospects?view=${view}`}>
                Clear
              </Link>
            </Button>
          ) : null}
        </form>

        <p className="mt-3 text-[11px] text-[var(--color-muted-foreground)]">
          Tip: drag a card (board) or row handle (table) to move a prospect
          between stages.
        </p>
      </header>

      {view === "board" ? (
        <KanbanBoard slug={slug} prospects={serialized} totals={totals} />
      ) : (
        <TableByStage slug={slug} prospects={serialized} />
      )}

      {nurture.length > 0 ? (
        <section className="border-t border-[var(--color-border)] bg-[var(--color-virgil-dark)]/40 px-8 py-4">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Nurture pool — {nurture.length}
          </div>
          <ul className="flex flex-wrap gap-2">
            {nurture.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/workspaces/${slug}/prospects/${p.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-[var(--color-surface)] px-3 py-1 text-xs shadow-[var(--shadow-soft)] hover:border-[var(--color-forest)]"
                >
                  <span className="font-medium text-[var(--color-charcoal)]">
                    {p.fullName}
                  </span>
                  <span className="text-[var(--color-muted-foreground)]">
                    · {p.company}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ─── View toggle ────────────────────────────────────────────── */

function ViewToggle({
  slug,
  view,
  searchParams,
}: {
  slug: string;
  view: "board" | "table";
  searchParams: { q?: string; owner?: string; fit?: string };
}) {
  const qs = new URLSearchParams();
  if (searchParams.q) qs.set("q", searchParams.q);
  if (searchParams.owner) qs.set("owner", searchParams.owner);
  if (searchParams.fit) qs.set("fit", searchParams.fit);
  const base = `/dashboard/workspaces/${slug}/prospects`;
  const boardHref = `${base}?${new URLSearchParams({ ...Object.fromEntries(qs), view: "board" }).toString()}`;
  const tableHref = `${base}?${new URLSearchParams({ ...Object.fromEntries(qs), view: "table" }).toString()}`;

  return (
    <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-0.5 shadow-[var(--shadow-soft)]">
      <Link
        href={boardHref}
        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          view === "board"
            ? "bg-[var(--color-forest)] text-[var(--color-virgil)]"
            : "text-[var(--color-charcoal-500)] hover:text-[var(--color-charcoal)]"
        }`}
      >
        <LayoutGrid className="h-3 w-3" /> Board
      </Link>
      <Link
        href={tableHref}
        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          view === "table"
            ? "bg-[var(--color-forest)] text-[var(--color-virgil)]"
            : "text-[var(--color-charcoal-500)] hover:text-[var(--color-charcoal)]"
        }`}
      >
        <List className="h-3 w-3" /> Table
      </Link>
    </div>
  );
}

import Link from "next/link";
import { requireRole, requireWorkspace } from "@/lib/auth";
import { postsForWorkspace } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List } from "lucide-react";
import { ContentKanban, type KanbanPost } from "./content-kanban";
import { ContentList } from "./content-list";

/**
 * Content pipeline. Two views:
 *   Board (default) — drag-and-drop Kanban with constrained transitions
 *   List           — collapsible sections grouped by stage
 *
 * Rejected posts surface above the columns on Board, and as their own
 * section at the bottom on List.
 */
export default async function ContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  await requireRole("ADMIN", "TEAM_MEMBER");
  const { slug } = await params;
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "board";

  const { workspace } = await requireWorkspace(slug);
  const posts = await postsForWorkspace(workspace.id);

  // Serialize for client components (must be plain JSON)
  const allSerialized: KanbanPost[] = posts.all.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    status: p.status,
    drafterName: p.drafter.name,
    updatedAt: p.updatedAt.toISOString(),
    mediaCount: p.media?.length ?? 0,
    firstMediaUrl: p.media?.[0]?.url ?? null,
  }));

  // Posts shown in active stages (DRAFT/PENDING/APPROVED/POSTED) — exclude REJECTED
  const active = allSerialized.filter((p) => p.status !== "REJECTED");
  const rejected = allSerialized.filter((p) => p.status === "REJECTED");

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Content pipeline
            </p>
            <h1 className="app-heading mt-0.5 text-2xl text-[var(--color-charcoal)]">
              {posts.all.length} {posts.all.length === 1 ? "post" : "posts"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle slug={slug} view={view} />
            <Button variant="accent" asChild>
              <Link href={`/dashboard/workspaces/${slug}/content/new`}>
                <Plus className="h-4 w-4" /> New post
              </Link>
            </Button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-[var(--color-muted-foreground)]">
          Tip: drag a card between columns to move it. Submitting a post for
          approval automatically notifies the client.
        </p>
      </header>

      {view === "board" ? (
        <ContentKanban slug={slug} posts={active} rejected={rejected} />
      ) : (
        <ContentList slug={slug} posts={active} rejected={rejected} />
      )}
    </div>
  );
}

/* ─── View toggle ─────────────────────────────────────────── */

function ViewToggle({ slug, view }: { slug: string; view: "board" | "list" }) {
  const base = `/dashboard/workspaces/${slug}/content`;
  return (
    <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-0.5 shadow-[var(--shadow-soft)]">
      <Link
        href={`${base}?view=board`}
        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          view === "board"
            ? "bg-[var(--color-forest)] text-[var(--color-virgil)]"
            : "text-[var(--color-charcoal-500)] hover:text-[var(--color-charcoal)]"
        }`}
      >
        <LayoutGrid className="h-3 w-3" /> Board
      </Link>
      <Link
        href={`${base}?view=list`}
        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          view === "list"
            ? "bg-[var(--color-forest)] text-[var(--color-virgil)]"
            : "text-[var(--color-charcoal-500)] hover:text-[var(--color-charcoal)]"
        }`}
      >
        <List className="h-3 w-3" /> List
      </Link>
    </div>
  );
}

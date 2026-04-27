import Link from "next/link";
import { requireRole, requireWorkspace } from "@/lib/auth";
import { postsForWorkspace } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Plus, Clock, Check, Radio, XCircle, PenLine, ArrowRight, Paperclip } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/**
 * Content Kanban. Four primary columns:
 *   In progress  (DRAFT)
 *   Waiting      (PENDING_APPROVAL)
 *   Approved     (APPROVED)
 *   Live         (POSTED)
 *
 * Rejected posts surface as a pinned strip above the board so the team
 * sees them and can rewrite — they don't deserve a full column.
 */
export default async function ContentKanbanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireRole("ADMIN", "TEAM_MEMBER");
  const { slug } = await params;
  const { workspace } = await requireWorkspace(slug);
  const posts = await postsForWorkspace(workspace.id);

  const rejected = posts.byStatus.REJECTED;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Content pipeline
            </p>
            <h1 className="app-heading mt-0.5 text-2xl text-[var(--color-charcoal)]">
              All posts
            </h1>
          </div>
          <Button variant="accent" asChild>
            <Link href={`/dashboard/workspaces/${slug}/content/new`}>
              <Plus className="h-4 w-4" /> New post
            </Link>
          </Button>
        </div>
      </header>

      <div className="px-8 py-6">
        {rejected.length > 0 ? (
          <RejectedStrip slug={slug} posts={rejected} />
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Column
            slug={slug}
            title="In progress"
            icon={PenLine}
            tone="inprogress"
            posts={posts.byStatus.DRAFT}
            emptyLabel="No drafts yet. Start writing."
          />
          <Column
            slug={slug}
            title="Waiting on approval"
            icon={Clock}
            tone="pending"
            posts={posts.byStatus.PENDING_APPROVAL}
            emptyLabel="Nothing with the client."
          />
          <Column
            slug={slug}
            title="Approved"
            icon={Check}
            tone="approved"
            posts={posts.byStatus.APPROVED}
            emptyLabel="Nothing approved yet."
          />
          <Column
            slug={slug}
            title="Live"
            icon={Radio}
            tone="live"
            posts={posts.byStatus.POSTED}
            emptyLabel="Nothing posted yet."
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Column ─────────────────────────────────────────────────── */

type Tone = "inprogress" | "pending" | "approved" | "live";
type Post = Awaited<ReturnType<typeof postsForWorkspace>>["all"][number];

const COLUMN_STYLES: Record<
  Tone,
  { header: string; card: string; pill: string }
> = {
  inprogress: {
    header: "bg-[var(--color-grapefruit)]/50 text-[var(--color-charcoal)]",
    card: "bg-[var(--color-grapefruit)]/25 border-[var(--color-grapefruit)]/40",
    pill: "bg-[var(--color-grapefruit)] text-[var(--color-charcoal)]",
  },
  pending: {
    header: "bg-[var(--color-bee)]/55 text-[var(--color-charcoal)]",
    card: "bg-[var(--color-bee)]/15 border-[var(--color-bee)]/40",
    pill: "bg-[var(--color-bee)] text-[var(--color-charcoal)]",
  },
  approved: {
    header: "bg-[var(--color-lime)]/70 text-[var(--color-forest-950)]",
    card: "bg-[var(--color-lime)]/15 border-[var(--color-lime)]/40",
    pill: "bg-[var(--color-lime)] text-[var(--color-forest-950)]",
  },
  live: {
    header: "bg-[var(--color-teal)]/70 text-[var(--color-forest-950)]",
    card: "bg-[var(--color-teal)]/15 border-[var(--color-teal)]/40",
    pill: "bg-[var(--color-teal)] text-[var(--color-forest-950)]",
  },
};

function Column({
  slug,
  title,
  icon: Icon,
  tone,
  posts,
  emptyLabel,
}: {
  slug: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  posts: Post[];
  emptyLabel: string;
}) {
  const styles = COLUMN_STYLES[tone];
  return (
    <div className="flex flex-col rounded-[var(--radius-lg)] border bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      <div
        className={`flex items-center gap-2 rounded-t-[var(--radius-lg)] px-4 py-3 text-sm font-semibold ${styles.header}`}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1">{title}</span>
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${styles.pill}`}
        >
          {posts.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 p-3">
        {posts.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-virgil)] px-3 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
            {emptyLabel}
          </div>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} slug={slug} tone={tone} />)
        )}
      </div>
    </div>
  );
}

function PostCard({ post, slug, tone }: { post: Post; slug: string; tone: Tone }) {
  const styles = COLUMN_STYLES[tone];
  const preview = (post.body ?? "").split("\n").filter(Boolean).slice(0, 3);
  const mediaCount = post.media?.length ?? 0;
  const firstMedia = post.media?.[0];

  return (
    <Link
      href={`/dashboard/workspaces/${slug}/content/${post.id}`}
      className={`block rounded-[var(--radius-md)] border p-3 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] ${styles.card}`}
    >
      {post.title ? (
        <div className="text-sm font-semibold leading-tight text-[var(--color-charcoal)]">
          {post.title}
        </div>
      ) : (
        <div className="text-sm font-semibold italic text-[var(--color-muted-foreground)]">
          Untitled
        </div>
      )}
      <div className="mt-1 space-y-0.5 text-xs leading-snug text-[var(--color-charcoal-500)]">
        {preview.map((line, i) => (
          <p key={i} className="line-clamp-2">
            {line}
          </p>
        ))}
      </div>
      {firstMedia ? (
        <div className="mt-2 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={firstMedia.url}
            alt={firstMedia.filename ?? "Attached"}
            className="h-24 w-full object-cover"
          />
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--color-muted-foreground)]">
        <span className="inline-flex items-center gap-1.5">
          {post.drafter.name.split(" ")[0]}
          {mediaCount > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <Paperclip className="h-2.5 w-2.5" />
              {mediaCount}
            </span>
          ) : null}
        </span>
        <span>{formatDistanceToNow(post.updatedAt, { addSuffix: true })}</span>
      </div>
    </Link>
  );
}

/* ─── Rejected strip ─────────────────────────────────────────── */

function RejectedStrip({ slug, posts }: { slug: string; posts: Post[] }) {
  return (
    <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-raspberry)]/40 bg-[var(--color-raspberry)]/5 p-4">
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-[var(--color-raspberry)]" />
        <span className="text-sm font-semibold text-[var(--color-raspberry)]">
          {posts.length} rejected — needs rewriting
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {posts.map((p) => (
          <li key={p.id}>
            <Link
              href={`/dashboard/workspaces/${slug}/content/${p.id}`}
              className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--color-virgil)]"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-charcoal)]">
                {p.title ?? "Untitled"}
              </span>
              {p.rejectionNote ? (
                <span className="hidden max-w-sm truncate text-xs italic text-[var(--color-muted-foreground)] md:inline">
                  &ldquo;{p.rejectionNote}&rdquo;
                </span>
              ) : null}
              <ArrowRight className="h-3.5 w-3.5 text-[var(--color-charcoal-300)]" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

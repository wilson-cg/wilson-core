import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { postDetail } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  updatePostDraft,
  submitPostForApproval,
  markPostAsPosted,
} from "@/lib/actions";
import { ArrowLeft, ExternalLink, Check, Radio } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

/**
 * Post workbench. Same shape as the prospect detail page — status-driven UI.
 *   DRAFT     → editor + "Submit for approval"
 *   PENDING   → read-only + "Waiting on client"
 *   APPROVED  → read-only + "Mark as posted" (with optional URL)
 *   POSTED    → read-only + link to the live LinkedIn post
 *   REJECTED  → rejection note + rewrite editor + resubmit
 */
export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  await requireRole("ADMIN", "TEAM_MEMBER");
  const { slug, id } = await params;
  const post = await postDetail(id);
  if (!post) notFound();
  if (post.workspace.slug !== slug) notFound();

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <Link
          href={`/dashboard/workspaces/${slug}/content`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> Content
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="app-heading text-2xl leading-tight text-[var(--color-charcoal)]">
              {post.title ?? "Untitled post"}
            </h1>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Drafted by {post.drafter.name} · {formatDistanceToNow(post.createdAt, { addSuffix: true })}
              {" · "}v{post.version}
            </p>
          </div>
          <Badge variant={statusToBadge(post.status)}>
            {humanizeStatus(post.status)}
          </Badge>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-8 py-8 lg:grid-cols-[1fr_320px]">
        <main className="space-y-6">
          <Workbench post={post} slug={slug} />

          {post.events.length > 0 ? (
            <section>
              <h3 className="app-heading mb-3 text-sm text-[var(--color-muted-foreground)]">
                History
              </h3>
              <ul className="space-y-1.5 rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-4 text-xs">
                {post.events.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center gap-3 text-[var(--color-charcoal-500)]"
                  >
                    <span className="w-28 shrink-0 text-[var(--color-muted-foreground)]">
                      {format(ev.createdAt, "d MMM HH:mm")}
                    </span>
                    <span className="flex-1">
                      {ev.actor.name} · {humanizeEvent(ev.eventType)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </main>

        <aside className="space-y-4">
          {post.workspace.icp ? (
            <section className="rounded-[var(--radius-md)] border bg-[var(--color-virgil)] p-4">
              <h4 className="app-heading text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Voice reference
              </h4>
              <p className="mt-2 text-xs text-[var(--color-charcoal-500)]">
                {post.workspace.icp.toneOfVoice}
              </p>
              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Must not
                </div>
                <p className="mt-1 text-xs text-[var(--color-charcoal-500)]">
                  {post.workspace.icp.mustNotDo}
                </p>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/* ─── Workbench ─────────────────────────────────────────────── */

type Post = NonNullable<Awaited<ReturnType<typeof postDetail>>>;

function Workbench({ post, slug: _slug }: { post: Post; slug: string }) {
  if (post.status === "DRAFT") {
    return (
      <section className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
        <h2 className="app-heading text-lg text-[var(--color-forest)]">Draft</h2>
        <form action={updatePostDraft} className="mt-4 space-y-3">
          <input type="hidden" name="postId" value={post.id} />
          <Input
            name="title"
            defaultValue={post.title ?? ""}
            placeholder="Working title (internal only)"
          />
          <textarea
            name="body"
            rows={14}
            defaultValue={post.body}
            required
            minLength={10}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-sans text-sm leading-relaxed shadow-[var(--shadow-soft)]"
          />
          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-4">
            <Button type="submit" variant="outline">
              Save changes
            </Button>
          </div>
        </form>
        <form action={submitPostForApproval} className="mt-3">
          <input type="hidden" name="postId" value={post.id} />
          <Button type="submit" variant="accent" className="w-full">
            Submit for client approval
          </Button>
        </form>
        <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
          Submitting queues an email to {post.workspace.contactName}.
        </p>
      </section>
    );
  }

  if (post.status === "REJECTED") {
    return (
      <>
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-raspberry)]/30 bg-[var(--color-raspberry)]/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="app-heading text-lg text-[var(--color-raspberry)]">
              Client rejected
            </h2>
            <Badge variant="rejected">Rejected</Badge>
          </div>
          {post.rejectionNote ? (
            <p className="mt-2 text-sm text-[var(--color-charcoal)]">
              &ldquo;{post.rejectionNote}&rdquo;
            </p>
          ) : null}
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {post.approver?.name ?? "Client"}
            {post.approvedAt
              ? ` · ${formatDistanceToNow(post.approvedAt, { addSuffix: true })}`
              : ""}
          </p>
        </section>
        <section className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
          <h2 className="app-heading text-lg text-[var(--color-forest)]">Rewrite</h2>
          <form action={updatePostDraft} className="mt-4 space-y-3">
            <input type="hidden" name="postId" value={post.id} />
            <Input name="title" defaultValue={post.title ?? ""} />
            <textarea
              name="body"
              rows={14}
              defaultValue={post.body}
              required
              minLength={10}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-sans text-sm leading-relaxed shadow-[var(--shadow-soft)]"
            />
            <Button type="submit" variant="outline">
              Save rewrite
            </Button>
          </form>
          <form action={submitPostForApproval} className="mt-3">
            <input type="hidden" name="postId" value={post.id} />
            <Button type="submit" variant="accent" className="w-full">
              Submit rewrite for approval
            </Button>
          </form>
        </section>
      </>
    );
  }

  // PENDING / APPROVED / POSTED → read-only body + status-specific action
  return (
    <section className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
      <p className="whitespace-pre-line rounded-[var(--radius-md)] bg-[var(--color-virgil)] p-4 text-sm leading-relaxed text-[var(--color-charcoal)]">
        {post.body}
      </p>

      <div className="mt-4 border-t border-[var(--color-border)] pt-4">
        {post.status === "PENDING_APPROVAL" ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Waiting on {post.workspace.contactName} to approve. They&apos;ll see this in their queue.
          </p>
        ) : null}

        {post.status === "APPROVED" ? (
          <form action={markPostAsPosted} className="space-y-3">
            <input type="hidden" name="postId" value={post.id} />
            <p className="text-sm text-[var(--color-charcoal)]">
              Approved by {post.approver?.name ?? "client"}
              {post.approvedAt
                ? ` ${formatDistanceToNow(post.approvedAt, { addSuffix: true })}`
                : ""}
              . Post on LinkedIn, then mark posted here.
            </p>
            <Input
              name="postedUrl"
              type="url"
              placeholder="LinkedIn post URL (optional)"
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://www.linkedin.com/feed/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open LinkedIn <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button type="submit" variant="accent" size="sm">
                <Check className="h-3.5 w-3.5" /> Mark as posted
              </Button>
            </div>
          </form>
        ) : null}

        {post.status === "POSTED" ? (
          <div className="flex items-center gap-3 text-sm text-[var(--color-charcoal)]">
            <Radio className="h-4 w-4 text-[var(--color-teal)]" />
            <span>
              Posted {post.postedAt ? formatDistanceToNow(post.postedAt, { addSuffix: true }) : ""}
              {post.poster ? ` by ${post.poster.name}` : ""}.
            </span>
            {post.postedUrl ? (
              <a
                href={post.postedUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--color-forest)] hover:underline"
              >
                View live <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ─── Helpers ────────────────────────────────────────────────── */

function statusToBadge(s: string) {
  const map: Record<string, "drafted" | "pending" | "approved" | "sent" | "rejected"> = {
    DRAFT: "drafted",
    PENDING_APPROVAL: "pending",
    APPROVED: "approved",
    POSTED: "sent",
    REJECTED: "rejected",
  };
  return map[s] ?? "drafted";
}

function humanizeStatus(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function humanizeEvent(s: string) {
  return humanizeStatus(s);
}

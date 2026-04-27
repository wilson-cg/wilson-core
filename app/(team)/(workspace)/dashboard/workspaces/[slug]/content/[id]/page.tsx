import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { postDetail } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  markPostAsPosted,
} from "@/lib/actions";
import { ArrowLeft, ExternalLink, Check, Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, formatDistanceToNow } from "date-fns";
import { PostWorkbench } from "./post-workbench";

/**
 * Post detail page — server component that loads the post + decides which
 * UI to render based on status:
 *   DRAFT / REJECTED  → editable workbench (PostWorkbench client island)
 *   PENDING_APPROVAL  → read-only workbench with "waiting" message
 *   APPROVED          → read-only workbench + "Mark as posted" form
 *   POSTED            → read-only + permalink to live post
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

  const canEdit = post.status === "DRAFT" || post.status === "REJECTED";
  const primaryContact = post.workspace.contacts[0];

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <Link
          href={`/dashboard/workspaces/${slug}/content`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> Content
        </Link>
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
          Drafted by {post.drafter.name} ·{" "}
          {formatDistanceToNow(post.createdAt, { addSuffix: true })} · v
          {post.version}
        </p>
      </header>

      <div className="px-6 py-6 lg:px-8">
        <PostWorkbench
          postId={post.id}
          initialBody={post.body}
          initialTitle={post.title ?? ""}
          status={post.status}
          rejectionNote={post.rejectionNote}
          initialMedia={post.media.map((m) => ({
            id: m.id,
            url: m.url,
            filename: m.filename,
            contentType: m.contentType,
          }))}
          workspaceName={post.workspace.name}
          workspaceLogoUrl={post.workspace.logoUrl}
          workspaceAccentColor={post.workspace.accentColor}
          contactName={primaryContact?.fullName ?? post.workspace.contactName}
          contactTitle={primaryContact?.title ?? null}
          canEdit={canEdit}
        />

        {/* Approved / Posted state — these stay server-rendered since they're
            simple forms with no client interactivity. */}
        {post.status === "APPROVED" ? (
          <section className="mt-6 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Approved
                </p>
                <p className="mt-1 text-sm text-[var(--color-charcoal)]">
                  By {post.approver?.name ?? "client"}
                  {post.approvedAt
                    ? ` ${formatDistanceToNow(post.approvedAt, { addSuffix: true })}`
                    : ""}
                  . Post on LinkedIn, then mark posted here.
                </p>
              </div>
              <Badge variant="approved">Approved</Badge>
            </div>
            <form action={markPostAsPosted} className="mt-4 space-y-3">
              <input type="hidden" name="postId" value={post.id} />
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
          </section>
        ) : null}

        {post.status === "POSTED" ? (
          <section className="mt-6 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <Radio className="h-5 w-5 text-[var(--color-teal)]" />
              <div className="flex-1">
                <p className="text-sm text-[var(--color-charcoal)]">
                  Posted{" "}
                  {post.postedAt
                    ? formatDistanceToNow(post.postedAt, { addSuffix: true })
                    : ""}
                  {post.poster ? ` by ${post.poster.name}` : ""}.
                </p>
              </div>
              {post.postedUrl ? (
                <a
                  href={post.postedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--color-forest)] hover:underline"
                >
                  View live <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* History */}
        {post.events.length > 0 ? (
          <section className="mt-8">
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
                    {ev.actor.name} · {humanizeStatus(ev.eventType)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function humanizeStatus(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

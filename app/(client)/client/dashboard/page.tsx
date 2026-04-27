import { requireRole } from "@/lib/auth";
import { clientHomeData } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  approveMessage,
  approvePost,
} from "@/lib/actions";
import { MessageApprovalActions } from "./message-actions";
import { PostApprovalActions } from "./post-actions";
import { Check, FileText, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/**
 * Client dashboard — the 30-second approval experience. Two queues now:
 *   - Posts awaiting approval (content for their LinkedIn feed)
 *   - Messages awaiting approval (1:1 outbound to specific prospects)
 */
export default async function ClientDashboardPage() {
  const user = await requireRole("CLIENT");
  const data = await clientHomeData(user);

  if (!data || !data.workspace) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="app-heading text-2xl text-[var(--color-forest)]">
          No workspace yet
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Your workspace hasn&apos;t been set up. Reach out to your Wilson&apos;s contact.
        </p>
      </div>
    );
  }

  const { pendingMessages, pendingPosts, metrics, recentReplies } = data;
  const total = pendingMessages.length + pendingPosts.length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <section className="mb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Welcome back, {user.name.split(" ")[0]}
        </p>
        <h1 className="app-heading mt-1 text-3xl text-[var(--color-forest)]">
          {total > 0
            ? `${total} item${total === 1 ? "" : "s"} ready for you`
            : "You're all caught up"}
        </h1>
        {total > 0 ? (
          <p className="mt-2 max-w-xl text-sm text-[var(--color-muted-foreground)]">
            {pendingPosts.length > 0 ? `${pendingPosts.length} post${pendingPosts.length === 1 ? "" : "s"}` : ""}
            {pendingPosts.length > 0 && pendingMessages.length > 0 ? " and " : ""}
            {pendingMessages.length > 0 ? `${pendingMessages.length} outreach message${pendingMessages.length === 1 ? "" : "s"}` : ""}
            {" "}
            from your Wilson&apos;s team. Approve, edit, or reject with notes.
          </p>
        ) : (
          <p className="mt-2 max-w-xl text-sm text-[var(--color-muted-foreground)]">
            No approvals waiting right now. Your team will queue the next batch soon.
          </p>
        )}
      </section>

      {/* Posts */}
      {pendingPosts.length > 0 ? (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--color-forest)]" />
            <h2 className="app-heading text-lg text-[var(--color-forest)]">
              Posts for your LinkedIn feed
            </h2>
          </div>
          <div className="space-y-3">
            {pendingPosts.map((p) => (
              <PostApprovalCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Messages */}
      {pendingMessages.length > 0 ? (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--color-forest)]" />
            <h2 className="app-heading text-lg text-[var(--color-forest)]">
              Outreach to your prospects
            </h2>
          </div>
          <div className="space-y-3">
            {pendingMessages.map((m) => (
              <MessageApprovalCard key={m.id} message={m} />
            ))}
          </div>
        </section>
      ) : null}

      {/* This week */}
      <section className="mt-10">
        <h3 className="app-heading mb-3 text-lg text-[var(--color-forest)]">
          This week
        </h3>
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard label="Approved" value={metrics.approved} caption="by you" />
          <MetricCard label="Sent" value={metrics.sent} caption="manual sends" />
          <MetricCard label="Replied" value={metrics.replied} caption={`${metrics.responseRate}% response rate`} />
          <MetricCard label="Posts live" value={metrics.posted} caption="this week" />
        </div>
      </section>

      {recentReplies.length > 0 ? (
        <section className="mt-10">
          <h3 className="app-heading mb-3 text-lg text-[var(--color-forest)]">
            Recent replies
          </h3>
          <ul className="space-y-2 text-sm">
            {recentReplies.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-soft)]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-teal)] text-sm font-semibold text-[var(--color-forest-950)]">
                  {r.prospect.fullName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-[var(--color-charcoal)]">
                    {r.prospect.fullName}
                  </div>
                  <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                    {r.prospect.title ? `${r.prospect.title} · ` : ""}
                    {r.prospect.company}
                  </div>
                </div>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {r.repliedAt ? formatDistanceToNow(r.repliedAt, { addSuffix: true }) : ""}
                </span>
                <Badge variant="replied">Replied</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ─── Cards ──────────────────────────────────────────────────── */

type ClientHome = NonNullable<Awaited<ReturnType<typeof clientHomeData>>>;
type PendingMessage = ClientHome["pendingMessages"][number];
type PendingPost = ClientHome["pendingPosts"][number];

function PostApprovalCard({ post }: { post: PendingPost }) {
  const waiting = formatDistanceToNow(post.updatedAt, { addSuffix: true });
  return (
    <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-[var(--color-muted-foreground)]">
            {post.title ? (
              <>
                <span className="font-medium text-[var(--color-charcoal)]">
                  {post.title}
                </span>{" "}
                ·{" "}
              </>
            ) : null}
            Drafted by {post.drafter.name} · submitted {waiting}
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--color-charcoal-500)]">
            {post.body}
          </p>
          {post.media && post.media.length > 0 ? (
            <div
              className={`mt-3 grid gap-1 overflow-hidden rounded-[var(--radius-md)] ${
                post.media.length === 1 ? "grid-cols-1" : "grid-cols-2"
              }`}
            >
              {post.media.map((m) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={m.id}
                  src={m.url}
                  alt={m.filename ?? "Attached image"}
                  className={`w-full object-cover ${
                    post.media.length === 1 ? "max-h-64" : "h-32"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
        <Badge variant="pending">Pending</Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4">
        <form action={approvePost}>
          <input type="hidden" name="postId" value={post.id} />
          <Button type="submit" variant="accent" size="sm">
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
        </form>
        <PostApprovalActions postId={post.id} body={post.body} />
      </div>
    </div>
  );
}

function MessageApprovalCard({ message }: { message: PendingMessage }) {
  const waiting = formatDistanceToNow(message.updatedAt, { addSuffix: true });
  return (
    <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-teal)] text-sm font-semibold text-[var(--color-forest-950)]">
              {message.prospect.fullName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-[var(--color-charcoal)]">
                {message.prospect.fullName}
              </div>
              <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                {message.prospect.title ? `${message.prospect.title} · ` : ""}
                {message.prospect.company}
              </div>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--color-charcoal-500)]">
            {message.body}
          </p>
          <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
            Drafted by {message.drafter.name} · submitted {waiting}
          </p>
        </div>
        <Badge variant="pending">Pending</Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4">
        <form action={approveMessage}>
          <input type="hidden" name="messageId" value={message.id} />
          <Button type="submit" variant="accent" size="sm">
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
        </form>
        <MessageApprovalActions messageId={message.id} body={message.body} />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
  caption: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="app-heading mt-1 text-3xl text-[var(--color-charcoal)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-forest)]">{caption}</p>
    </div>
  );
}

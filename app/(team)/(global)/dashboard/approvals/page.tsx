import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { pendingApprovalsUnified } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, MessageSquare, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/**
 * Cross-workspace approval queue — both outbound messages AND content posts
 * waiting on their respective clients. Team-side view; clients do the
 * approving from their own surface.
 */
export default async function ApprovalsPage() {
  const user = await requireRole("ADMIN", "TEAM_MEMBER");
  const { messages, posts } = await pendingApprovalsUnified(user);
  const total = messages.length + posts.length;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
        <h1 className="app-heading mt-2 text-2xl text-[var(--color-charcoal)]">
          Approval queue
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {total} item{total === 1 ? "" : "s"} waiting on clients — {posts.length} posts · {messages.length} messages
        </p>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-8 py-8">
        {total === 0 ? (
          <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-12 text-center shadow-[var(--shadow-card)]">
            <h2 className="app-heading text-xl text-[var(--color-forest)]">
              Nothing waiting
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Every draft is either still being written or already approved.
            </p>
          </div>
        ) : null}

        {posts.length > 0 ? (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--color-forest)]" />
              <h2 className="app-heading text-lg text-[var(--color-forest)]">
                Posts ({posts.length})
              </h2>
            </div>
            <ul className="space-y-3">
              {posts.map((p) => (
                <li
                  key={p.id}
                  className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                        <span className="font-medium text-[var(--color-forest)]">
                          {p.workspace.name}
                        </span>
                        <span>·</span>
                        <span>
                          Submitted {formatDistanceToNow(p.updatedAt, { addSuffix: true })}
                        </span>
                        <span>·</span>
                        <span>Drafted by {p.drafter.name}</span>
                      </div>
                      <div className="mt-1 font-medium text-[var(--color-charcoal)]">
                        {p.title ?? "Untitled post"}
                      </div>
                      <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-[var(--color-charcoal-500)]">
                        {p.body}
                      </p>
                    </div>
                    <Badge variant="pending">Pending</Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-4">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/dashboard/workspaces/${p.workspace.slug}/content/${p.id}`}
                      >
                        Open post <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {messages.length > 0 ? (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[var(--color-forest)]" />
              <h2 className="app-heading text-lg text-[var(--color-forest)]">
                Outreach messages ({messages.length})
              </h2>
            </div>
            <ul className="space-y-3">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                        <span className="font-medium text-[var(--color-forest)]">
                          {m.workspace.name}
                        </span>
                        <span>·</span>
                        <span>
                          Submitted {formatDistanceToNow(m.updatedAt, { addSuffix: true })}
                        </span>
                        <span>·</span>
                        <span>Drafted by {m.drafter.name}</span>
                      </div>
                      <div className="mt-1 font-medium text-[var(--color-charcoal)]">
                        {m.prospect.fullName} · {m.prospect.company}
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm text-[var(--color-charcoal-500)]">
                        {m.body}
                      </p>
                    </div>
                    <Badge variant="pending">Pending</Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-4">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/dashboard/workspaces/${m.workspace.slug}/prospects/${m.prospectId}`}
                      >
                        Open prospect <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

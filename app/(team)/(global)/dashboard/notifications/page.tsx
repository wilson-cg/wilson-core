import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { notificationOutbox } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Hash } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/**
 * Notification outbox. When a team member submits a draft for client
 * approval, a notification is queued here. Right now nothing ships
 * emails / Slack messages — that's a single-file wiring swap later
 * (Resend for email, incoming webhook for Slack). For stress testing
 * this page shows WHAT would go out.
 */
export default async function NotificationsPage() {
  const user = await requireRole("ADMIN", "TEAM_MEMBER");
  const outbox = await notificationOutbox(user);

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
          Notifications outbox
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Every approval submission logs a notification. Real delivery (email
          via Resend, Slack via webhook) wires in at productionization.
        </p>
      </header>

      <div className="mx-auto max-w-4xl px-8 py-8">
        {outbox.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-12 text-center shadow-[var(--shadow-card)]">
            <h2 className="app-heading text-xl text-[var(--color-forest)]">
              Nothing queued
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Submit a draft for approval to see what would be sent to the client.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {outbox.map((n) => (
              <li
                key={n.id}
                className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-virgil)]">
                      {n.channel === "EMAIL" ? (
                        <Mail className="h-3.5 w-3.5 text-[var(--color-forest)]" />
                      ) : (
                        <Hash className="h-3.5 w-3.5 text-[var(--color-forest)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                        <span className="font-medium text-[var(--color-forest)]">
                          {n.workspace.name}
                        </span>
                        <span>·</span>
                        <span>
                          {n.channel === "EMAIL" ? "Email" : "Slack"} to{" "}
                          <span className="font-mono">{n.recipient}</span>
                        </span>
                      </div>
                      <div className="mt-0.5 font-medium text-[var(--color-charcoal)]">
                        {n.subject}
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-charcoal-500)]">
                        {n.body}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={n.status === "SENT" ? "approved" : "drafted"}>
                      {n.status.toLowerCase()}
                    </Badge>
                    <span className="text-[10px] text-[var(--color-muted-foreground)]">
                      {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

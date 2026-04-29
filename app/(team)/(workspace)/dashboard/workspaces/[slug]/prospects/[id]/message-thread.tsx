"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  X,
  ExternalLink,
  Check,
  MessageCircleReply,
  Calendar,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { CopyClientButton } from "./copy-client-button";
import {
  draftMessage,
  updateDraft,
  submitForApproval,
  markAsSent,
  markAsReplied,
  markMeetingBooked,
} from "@/lib/actions";

/**
 * Stacked message thread for a prospect. Newest message on top, full
 * history below. Each card renders status-appropriate UI:
 *   DRAFT     → editable + "Submit for approval"
 *   PENDING   → read-only, "waiting on client"
 *   APPROVED  → read-only + "Mark as sent" workflow
 *   SENT      → read-only + "Mark as replied"
 *   REPLIED   → read-only + "Meeting booked"
 *   REJECTED  → rejection note + rewrite editor + resubmit
 *
 * "New message" button appears at the top when:
 *   - There are no messages yet, OR
 *   - The most recent message is in a settled state (SENT or REPLIED)
 */
export type ThreadMessage = {
  id: string;
  body: string;
  status:
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "SENT"
    | "REPLIED";
  version: number;
  rejectionNote: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  repliedAt: string | null;
  approverName: string | null;
  drafterName: string | null;
  createdAt: string;
};

export function MessageThread({
  prospectId,
  prospectName,
  messages,
}: {
  prospectId: string;
  prospectName: string;
  messages: ThreadMessage[];
}) {
  const latest = messages[0];
  const canStartNew =
    !latest || ["SENT", "REPLIED"].includes(latest.status);
  const [composing, setComposing] = useState(messages.length === 0);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="app-heading text-lg text-[var(--color-forest)]">
          {messages.length === 0
            ? "First outreach"
            : `Messages (${messages.length})`}
        </h2>
        {canStartNew && !composing && messages.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setComposing(true)}
          >
            <Plus className="h-3.5 w-3.5" /> New message
          </Button>
        ) : null}
      </div>

      {/* New message inline form */}
      {composing ? (
        <NewMessageForm
          prospectId={prospectId}
          prospectName={prospectName}
          isFirst={messages.length === 0}
          onCancel={() => setComposing(false)}
        />
      ) : null}

      {/* Stacked message cards, newest first */}
      {messages.map((m, i) => (
        <MessageCard
          key={m.id}
          message={m}
          prospectId={prospectId}
          label={messageLabel(messages.length, i)}
        />
      ))}
    </section>
  );
}

/* ─── New message form ──────────────────────────────────────── */

function NewMessageForm({
  prospectId,
  prospectName,
  isFirst,
  onCancel,
}: {
  prospectId: string;
  prospectName: string;
  isFirst: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-forest-300)] bg-[var(--color-forest-100)]/40 p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="app-heading text-sm text-[var(--color-forest)]">
          {isFirst ? "Draft first message" : "New follow-up"}
        </h3>
        {!isFirst ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-[var(--color-charcoal-300)] hover:text-[var(--color-charcoal)]"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <form action={draftMessage} className="space-y-3">
        <input type="hidden" name="prospectId" value={prospectId} />
        <textarea
          name="body"
          rows={8}
          required
          minLength={10}
          placeholder={
            isFirst
              ? `Hi ${prospectName.split(" ")[0]}, …`
              : `Following up — ${prospectName.split(" ")[0]}, …`
          }
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
        />
        <Button type="submit" variant="accent" size="sm">
          Save draft
        </Button>
      </form>
    </div>
  );
}

/* ─── Message card ──────────────────────────────────────────── */

function MessageCard({
  message,
  prospectId,
  label,
}: {
  message: ThreadMessage;
  prospectId: string;
  label: string;
}) {
  if (message.status === "DRAFT") {
    return (
      <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        <CardHeader label={label} status={message.status} version={message.version} />
        <form action={updateDraft} className="mt-4 space-y-3">
          <input type="hidden" name="messageId" value={message.id} />
          <textarea
            name="body"
            rows={8}
            defaultValue={message.body}
            required
            minLength={10}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
          />
          <Button type="submit" variant="outline" size="sm">
            Save changes
          </Button>
        </form>
        <form action={submitForApproval} className="mt-3">
          <input type="hidden" name="messageId" value={message.id} />
          <Button type="submit" variant="accent" size="sm" className="w-full">
            Submit for client approval
          </Button>
        </form>
      </div>
    );
  }

  if (message.status === "REJECTED") {
    return (
      <div className="space-y-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-raspberry)]/30 bg-[var(--color-raspberry)]/5 p-5">
          <CardHeader
            label={label}
            status={message.status}
            version={message.version}
          />
          {message.rejectionNote ? (
            <p className="mt-2 text-sm text-[var(--color-charcoal)]">
              &ldquo;{message.rejectionNote}&rdquo;
            </p>
          ) : null}
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {message.approverName ?? "Client"}
            {message.approvedAt
              ? ` · ${formatDistanceToNow(new Date(message.approvedAt), { addSuffix: true })}`
              : ""}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="app-heading text-sm text-[var(--color-forest)]">
            Rewrite
          </h3>
          <form action={updateDraft} className="mt-3 space-y-3">
            <input type="hidden" name="messageId" value={message.id} />
            <textarea
              name="body"
              rows={8}
              defaultValue={message.body}
              required
              minLength={10}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
            />
            <Button type="submit" variant="outline" size="sm">
              Save rewrite
            </Button>
          </form>
          <form action={submitForApproval} className="mt-2">
            <input type="hidden" name="messageId" value={message.id} />
            <Button type="submit" variant="accent" size="sm" className="w-full">
              Submit rewrite for approval
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // PENDING / APPROVED / SENT / REPLIED — read-only body + status-specific action
  return (
    <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <CardHeader label={label} status={message.status} version={message.version} />
      <p className="mt-3 whitespace-pre-line rounded-[var(--radius-md)] bg-[var(--color-virgil)] p-4 text-sm leading-relaxed text-[var(--color-charcoal)]">
        {message.body}
      </p>

      <div className="mt-3 border-t border-[var(--color-border)] pt-3">
        {message.status === "PENDING_APPROVAL" ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Waiting on client approval. Submitted{" "}
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}.
          </p>
        ) : null}

        {message.status === "APPROVED" ? (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-charcoal)]">
              Approved by {message.approverName ?? "client"}
              {message.approvedAt
                ? ` ${formatDistanceToNow(new Date(message.approvedAt), { addSuffix: true })}`
                : ""}
              . Copy, open LinkedIn, send, then mark sent.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://linkedin.com/messaging"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open LinkedIn <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <CopyClientButton body={message.body} />
              <form action={markAsSent}>
                <input type="hidden" name="messageId" value={message.id} />
                <Button type="submit" variant="accent" size="sm">
                  <Check className="h-3.5 w-3.5" /> Mark as sent
                </Button>
              </form>
            </div>
          </div>
        ) : null}

        {message.status === "SENT" ? (
          <form action={markAsReplied} className="flex items-center gap-2">
            <input type="hidden" name="messageId" value={message.id} />
            <p className="flex-1 text-xs text-[var(--color-muted-foreground)]">
              Sent{" "}
              {message.sentAt
                ? formatDistanceToNow(new Date(message.sentAt), { addSuffix: true })
                : ""}
              .
            </p>
            <Button type="submit" variant="outline" size="sm">
              <MessageCircleReply className="h-3.5 w-3.5" /> Mark as replied
            </Button>
          </form>
        ) : null}

        {message.status === "REPLIED" ? (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-charcoal)]">
              Replied{" "}
              {message.repliedAt
                ? formatDistanceToNow(new Date(message.repliedAt), { addSuffix: true })
                : ""}
              .
            </p>
            <form action={markMeetingBooked}>
              <input type="hidden" name="prospectId" value={prospectId} />
              <Button type="submit" variant="accent" size="sm">
                <Calendar className="h-3.5 w-3.5" /> Meeting booked
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CardHeader({
  label,
  status,
  version,
}: {
  label: string;
  status: ThreadMessage["status"];
  version: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h3 className="app-heading text-sm text-[var(--color-forest)]">
          {label}
        </h3>
        {version > 1 ? (
          <span className="text-[10px] text-[var(--color-muted-foreground)]">
            v{version}
          </span>
        ) : null}
      </div>
      <Badge variant={statusBadge(status)}>{humanizeStatus(status)}</Badge>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────── */

function messageLabel(total: number, indexFromTop: number): string {
  if (total === 1) return "Message";
  // Newest first: top item is the latest, last item is the opener
  if (indexFromTop === 0) return total === 2 ? "Latest" : `Message #${total}`;
  if (indexFromTop === total - 1) return "Opener";
  return `Message #${total - indexFromTop}`;
}

function statusBadge(s: ThreadMessage["status"]) {
  const map: Record<
    ThreadMessage["status"],
    "drafted" | "pending" | "approved" | "sent" | "replied" | "rejected"
  > = {
    DRAFT: "drafted",
    PENDING_APPROVAL: "pending",
    APPROVED: "approved",
    SENT: "sent",
    REPLIED: "replied",
    REJECTED: "rejected",
  };
  return map[s];
}

function humanizeStatus(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

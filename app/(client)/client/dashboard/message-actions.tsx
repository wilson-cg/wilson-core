"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";
import { editAndApprove, rejectMessage } from "@/lib/actions";

/**
 * Grouped client islands for message approval: Edit & approve + Reject.
 * Each takes over the card when opened so the client can focus.
 */
export function MessageApprovalActions({
  messageId,
  body,
}: {
  messageId: string;
  body: string;
}) {
  const [mode, setMode] = useState<"idle" | "edit" | "reject">("idle");
  const [value, setValue] = useState(body);
  const [note, setNote] = useState("");

  if (mode === "edit") {
    return (
      <form action={editAndApprove} className="w-full space-y-2">
        <input type="hidden" name="messageId" value={messageId} />
        <textarea
          name="body"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          required
          minLength={10}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" variant="accent" size="sm">
            <Check className="h-3.5 w-3.5" /> Save & approve
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setValue(body);
              setMode("idle");
            }}
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (mode === "reject") {
    return (
      <form action={rejectMessage} className="w-full space-y-2">
        <input type="hidden" name="messageId" value={messageId} />
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          required
          minLength={3}
          placeholder="Tell the team what to change"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-raspberry)]/40 bg-[var(--color-raspberry)]/5 px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" variant="destructive" size="sm">
            Send rejection
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setNote("");
              setMode("idle");
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
        <Pencil className="h-3.5 w-3.5" /> Edit & approve
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setMode("reject")}>
        <X className="h-3.5 w-3.5" /> Reject
      </Button>
    </>
  );
}

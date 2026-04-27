"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { logProspectActivity } from "@/lib/actions";

/**
 * Inline "Log activity" form. Starts as a small button; expands to a panel
 * with event type + date + note. Submits a ProspectEvent and closes.
 */
export function LogActivityIsland({
  prospectId,
}: {
  prospectId: string;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" /> Log activity
      </Button>
    );
  }

  return (
    <form
      action={logProspectActivity}
      className="space-y-2 rounded-[var(--radius-md)] border bg-[var(--color-virgil)] p-3"
    >
      <input type="hidden" name="prospectId" value={prospectId} />
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Type
          </span>
          <select
            name="eventType"
            defaultValue="CONTACTED"
            required
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 text-sm shadow-[var(--shadow-soft)]"
          >
            <option value="CONTACTED">Contacted</option>
            <option value="CALL">Call</option>
            <option value="EMAIL">Email</option>
            <option value="MEETING">Meeting</option>
            <option value="LINKEDIN_CONNECTION_SENT">
              LinkedIn connection sent
            </option>
            <option value="LINKEDIN_CONNECTION_ACCEPTED">
              LinkedIn connection accepted
            </option>
            <option value="NOTE_ADDED">Note</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            When
          </span>
          <Input
            type="date"
            name="occurredAt"
            defaultValue={today}
            required
            className="h-9"
          />
        </label>
      </div>
      <label className="space-y-1 block">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Note (optional)
        </span>
        <textarea
          name="note"
          rows={2}
          placeholder="What happened?"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
        />
      </label>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="accent" size="sm">
          Log it
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
      </div>
    </form>
  );
}

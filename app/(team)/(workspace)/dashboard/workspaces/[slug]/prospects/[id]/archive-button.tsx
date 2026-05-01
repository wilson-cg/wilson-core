"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Archive, Loader2 } from "lucide-react";
import { archiveProspect } from "@/lib/actions";

export function ArchiveButton({ prospectId }: { prospectId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        <Archive className="h-3.5 w-3.5" /> Archive prospect
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-2 rounded-[var(--radius-md)] border border-[var(--color-raspberry)]/40 bg-[var(--color-raspberry)]/10 p-3 sm:flex-row sm:items-center">
      <span className="flex-1 text-xs text-[var(--color-raspberry)]">
        Archive this prospect? It hides from the main pipeline; restore from
        the archive view.
      </span>
      <div className="flex gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          variant="accent"
          disabled={pending}
          onClick={() => {
            startTransition(() => {
              const fd = new FormData();
              fd.set("prospectId", prospectId);
              archiveProspect(fd).catch((err) =>
                console.error("Archive failed", err)
              );
            });
          }}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Archive className="h-3.5 w-3.5" />
          )}
          Confirm archive
        </Button>
      </div>
    </div>
  );
}

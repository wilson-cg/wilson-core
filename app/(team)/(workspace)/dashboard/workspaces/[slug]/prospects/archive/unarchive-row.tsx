"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { unarchiveProspect } from "@/lib/actions";

export function UnarchiveRow({ prospectId }: { prospectId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          const fd = new FormData();
          fd.set("prospectId", prospectId);
          unarchiveProspect(fd).catch((err) =>
            console.error("Restore failed", err)
          );
        });
      }}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5" />
      )}
      Restore
    </Button>
  );
}

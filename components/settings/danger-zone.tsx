"use client";

import { useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteWorkspace } from "@/lib/actions";

/**
 * Admin-only "delete this client" surface for the workspace settings page.
 *
 * Wraps the branded confirm modal with a `confirmText` that requires the
 * admin to type the exact workspace name back. Cascades through Prisma
 * (every Workspace child has onDelete: Cascade in the schema).
 */
export function DangerZone({
  slug,
  workspaceName,
}: {
  slug: string;
  workspaceName: string;
}) {
  const { confirm, toast } = useToast();
  const [pending, startTransition] = useTransition();

  async function onClick() {
    const ok = await confirm({
      title: "Delete this client?",
      description:
        "This permanently removes the workspace and every prospect, message, post, contact, and onboarding response attached to it. This cannot be undone.",
      confirmLabel: pending ? "Deleting…" : "Delete client",
      destructive: true,
      confirmText: workspaceName,
    });
    if (!ok) return;

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("workspaceSlug", slug);
        fd.set("confirmName", workspaceName);
        await deleteWorkspace(fd);
        // deleteWorkspace redirects on success; if we get here without an
        // error, also clear the toast queue with a success.
        toast.success(`${workspaceName} deleted`);
      } catch (err) {
        // Next.js redirect throws a special error — let it propagate so the
        // browser navigates instead of showing it as a failure.
        if (
          err instanceof Error &&
          (err.message === "NEXT_REDIRECT" ||
            (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))
        ) {
          throw err;
        }
        console.error("Delete workspace failed", err);
        toast.error(
          err instanceof Error ? err.message : "Could not delete workspace"
        );
      }
    });
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-raspberry)]/30 bg-[var(--color-raspberry)]/5 p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-raspberry)]/15">
          <AlertTriangle className="h-4 w-4 text-[var(--color-raspberry)]" />
        </div>
        <div className="flex-1">
          <h2 className="app-heading text-sm font-semibold text-[var(--color-raspberry)]">
            Danger zone
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-charcoal-500)]">
            Deleting{" "}
            <span className="font-semibold text-[var(--color-charcoal)]">
              {workspaceName}
            </span>{" "}
            removes the workspace and every record tied to it — prospects,
            messages, posts, contacts, onboarding answers. There is no undo.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={onClick}
              disabled={pending}
            >
              <Trash2 className="h-4 w-4" />
              {pending ? "Deleting…" : "Delete this client"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

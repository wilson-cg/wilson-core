import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/actions";

/**
 * Minimal "what's your client called?" entry point. The display name is
 * the only required field — everything else is filled out from the
 * settings page that opens immediately after creation.
 *
 * createClient seeds 10 default onboarding questions and a membership
 * row for the current user, then redirects to the settings page.
 */
export default async function NewClientPage() {
  await requireRole("ADMIN", "TEAM_MEMBER");

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> All clients
        </Link>
        <h1 className="app-heading mt-2 text-2xl text-[var(--color-charcoal)]">
          New client
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Just the name to get started — you&apos;ll fill out the rest of the
          profile, contacts, and onboarding on the next screen.
        </p>
      </header>

      <div className="mx-auto max-w-xl px-8 py-12">
        <form action={createClient} className="space-y-6">
          <label className="block space-y-2">
            <span className="text-xs font-medium text-[var(--color-charcoal-500)]">
              Client name <span className="text-[var(--color-raspberry)]">*</span>
            </span>
            <Input
              name="name"
              placeholder="e.g. Condor Group"
              required
              minLength={2}
              autoFocus
              className="text-base"
            />
            <span className="block text-[11px] text-[var(--color-muted-foreground)]">
              Use the name you want to see across the app. You can edit this
              later, and add a legal business name separately.
            </span>
          </label>

          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-virgil)] p-4 text-xs text-[var(--color-charcoal-500)]">
            <p className="font-medium text-[var(--color-charcoal)]">
              On the next screen you&apos;ll fill in:
            </p>
            <ul className="mt-2 space-y-1">
              <li>· Logo, business name, LinkedIn, accent colour</li>
              <li>· Approval email + client contacts (one or many)</li>
              <li>· 10 onboarding questions (we&apos;ve seeded the defaults)</li>
            </ul>
          </div>

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-5">
            <Button type="submit" variant="accent">
              Create & continue <ArrowRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href="/dashboard">Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

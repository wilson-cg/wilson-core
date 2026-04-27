import Link from "next/link";
import { requireRole, requireWorkspace } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { draftPost } from "@/lib/actions";

export default async function NewPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireRole("ADMIN", "TEAM_MEMBER");
  const { slug } = await params;
  const { workspace } = await requireWorkspace(slug);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <Link
          href={`/dashboard/workspaces/${slug}/content`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> Content
        </Link>
        <h1 className="app-heading mt-2 text-2xl text-[var(--color-charcoal)]">
          New post
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Drafting for {workspace.name} · {workspace.contactName}&apos;s LinkedIn feed
        </p>
      </header>

      <div className="mx-auto max-w-3xl px-8 py-10">
        <form action={draftPost} className="space-y-5">
          <input type="hidden" name="workspaceSlug" value={slug} />

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--color-charcoal-500)]">
              Working title (internal only)
            </span>
            <Input name="title" placeholder="e.g. Pipeline transparency take" />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--color-charcoal-500)]">
              Post body <span className="text-[var(--color-raspberry)]">*</span>
            </span>
            <textarea
              name="body"
              rows={14}
              required
              minLength={10}
              placeholder={`A CFO asked me last week...`}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-sans text-sm leading-relaxed shadow-[var(--shadow-soft)]"
            />
          </label>

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-5">
            <Button type="submit" variant="accent">
              Save draft
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href={`/dashboard/workspaces/${slug}/content`}>Cancel</Link>
            </Button>
          </div>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            Saving as a draft keeps it in the &ldquo;In progress&rdquo; column. Submit for
            approval when you&apos;re ready.
          </p>
        </form>
      </div>
    </div>
  );
}

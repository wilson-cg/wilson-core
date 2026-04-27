import Link from "next/link";
import { requireRole, requireWorkspace } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { addProspect } from "@/lib/actions";

export default async function NewProspectPage({
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
          href={`/dashboard/workspaces/${slug}/prospects`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> Prospects
        </Link>
        <h1 className="app-heading mt-2 text-2xl text-[var(--color-charcoal)]">
          New prospect
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Adding to {workspace.name}
        </p>
      </header>

      <div className="mx-auto max-w-2xl px-8 py-10">
        <form action={addProspect} className="space-y-6">
          <input type="hidden" name="workspaceSlug" value={slug} />

          <Field label="Full name" required>
            <Input name="fullName" placeholder="Jane Doe" required />
          </Field>

          <Field label="Company" required>
            <Input name="company" placeholder="Helix Biosciences" required />
          </Field>

          <Field label="Title">
            <Input name="title" placeholder="VP Operations" />
          </Field>

          <Field label="LinkedIn URL">
            <Input
              name="linkedinUrl"
              type="url"
              placeholder="https://linkedin.com/in/jane-doe"
            />
          </Field>

          <Field label="ICP fit">
            <select
              name="fitScore"
              defaultValue="POSSIBLE"
              className="flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm shadow-[var(--shadow-soft)]"
            >
              <option value="STRONG">Strong fit</option>
              <option value="POSSIBLE">Possible fit</option>
              <option value="NOT_A_FIT">Not a fit</option>
            </select>
          </Field>

          <Field label="Internal notes">
            <textarea
              name="notes"
              rows={3}
              placeholder="Anything the drafter should know. Internal only."
              className="flex w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
            />
          </Field>

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-6">
            <Button type="submit" variant="accent">
              Add prospect
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href={`/dashboard/workspaces/${slug}/prospects`}>Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-[var(--color-charcoal-500)]">
        {label}
        {required ? <span className="text-[var(--color-raspberry)]"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

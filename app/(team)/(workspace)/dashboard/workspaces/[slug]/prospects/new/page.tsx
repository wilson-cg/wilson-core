import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";
import { NewProspectForm } from "./new-prospect-form";

export default async function NewProspectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace, user } = await requireWorkspace(slug);
  if (user.role === "CLIENT") {
    return (
      <div className="px-8 py-10 text-sm text-[var(--color-muted-foreground)]">
        Read-only access.
      </div>
    );
  }

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
          Capture intent signal
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Adding to {workspace.name}
        </p>
      </header>

      <div className="mx-auto max-w-2xl px-8 py-10">
        <NewProspectForm slug={slug} />
      </div>
    </div>
  );
}

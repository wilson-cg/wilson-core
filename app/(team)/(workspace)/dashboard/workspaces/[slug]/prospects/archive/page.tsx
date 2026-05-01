import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { archivedProspectsForWorkspace } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { UnarchiveRow } from "./unarchive-row";

export default async function ProspectArchivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace, user } = await requireWorkspace(slug);
  const archived = await archivedProspectsForWorkspace(workspace.id);
  const canRestore = user.role !== "CLIENT";

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <Link
          href={`/dashboard/workspaces/${slug}/prospects`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-forest)]"
        >
          <ArrowLeft className="h-3 w-3" /> Back to pipeline
        </Link>
        <h1 className="app-heading mt-2 text-2xl text-[var(--color-charcoal)]">
          Archive
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {archived.length === 0
            ? "Nothing archived yet."
            : `${archived.length} archived prospect${archived.length === 1 ? "" : "s"}.`}
        </p>
      </header>

      {archived.length === 0 ? (
        <div className="px-8 py-10 text-sm text-[var(--color-muted-foreground)]">
          When you archive a prospect from its detail page, it shows up here.{" "}
          <Link
            href={`/dashboard/workspaces/${slug}/prospects`}
            className="text-[var(--color-forest)] hover:underline"
          >
            Back to pipeline
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-x-auto px-8 py-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Company</th>
                <th className="py-2 pr-4">ICP</th>
                <th className="py-2 pr-4">Signal</th>
                <th className="py-2 pr-4">Updated</th>
                <th className="py-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {archived.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="py-2 pr-4">
                    <Link
                      href={`/dashboard/workspaces/${slug}/prospects/${p.id}`}
                      className="text-[var(--color-charcoal)] hover:text-[var(--color-forest)]"
                    >
                      {p.fullName}
                      {p.title ? (
                        <span className="ml-1 text-[10px] text-[var(--color-muted-foreground)]">
                          · {p.title}
                        </span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-[var(--color-charcoal-500)]">
                    {p.company}
                  </td>
                  <td className="py-2 pr-4 text-[var(--color-charcoal-500)]">
                    {p.icpScore}/4
                  </td>
                  <td className="py-2 pr-4 text-[var(--color-charcoal-500)]">
                    {p.signalType ? humanize(p.signalType) : "—"}
                  </td>
                  <td className="py-2 pr-4 text-xs text-[var(--color-muted-foreground)]">
                    {format(p.updatedAt, "d MMM yyyy")}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {canRestore ? (
                      <UnarchiveRow prospectId={p.id} />
                    ) : (
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/dashboard/workspaces/${slug}/prospects/${p.id}`}
                        >
                          View
                        </Link>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function humanize(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Paperclip,
  ChevronDown,
  ChevronRight,
  Clock,
  Check,
  Radio,
  PenLine,
  XCircle,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { STAGES, type KanbanPost, type StageKey } from "./content-kanban";

/**
 * List view of the content pipeline. Posts grouped by stage in collapsible
 * sections. Same data shape as the Kanban; just a denser, table-style
 * rendering for when there are too many posts to scan as cards.
 *
 * No DnD here — list view is for triage and review. Use Board to move
 * things around.
 */
export function ContentList({
  slug,
  posts,
  rejected,
}: {
  slug: string;
  posts: KanbanPost[];
  rejected: KanbanPost[];
}) {
  // All stages plus REJECTED at the bottom (since it's an exception state)
  const allStages: { key: StageKey | "REJECTED"; label: string }[] = [
    ...STAGES,
    { key: "REJECTED", label: "Rejected" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-3 px-8 py-6">
      {allStages.map((s) => {
        const items =
          s.key === "REJECTED"
            ? rejected
            : posts.filter((p) => p.status === s.key);
        return (
          <ListSection
            key={s.key}
            stage={s.key}
            label={s.label}
            items={items}
            slug={slug}
          />
        );
      })}
    </div>
  );
}

function ListSection({
  stage,
  label,
  items,
  slug,
}: {
  stage: StageKey | "REJECTED";
  label: string;
  items: KanbanPost[];
  slug: string;
}) {
  const [collapsed, setCollapsed] = useState(items.length === 0);
  const Icon = ICONS[stage];
  const isDraft = stage === "DRAFT";

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      <div
        className={`flex w-full items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold ${TONE_HEADER[stage]} ${
          collapsed ? "border-b-transparent" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
          className="inline-flex flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/60 transition-colors hover:bg-white">
            {collapsed ? (
              <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
            )}
          </span>
          <Icon className="h-4 w-4" />
          <span className="flex-1">{label}</span>
        </button>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/60 px-1.5 text-[10px] font-semibold text-[var(--color-charcoal)]">
          {items.length}
        </span>
        {isDraft ? (
          <Link
            href={`/dashboard/workspaces/${slug}/content/new`}
            title="New post (⌘⇧N or N)"
            className="-mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/60 hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </Link>
        ) : null}
      </div>

      {collapsed ? null : items.length === 0 ? (
        <div className="px-5 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
          Nothing here yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-virgil)] px-5 py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            <span>Post</span>
            <span>Drafter</span>
            <span>Media</span>
            <span className="text-right">Updated</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {items.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/workspaces/${slug}/content/${p.id}`}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--color-virgil)]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--color-charcoal)]">
                    {p.title ?? <em className="text-[var(--color-muted-foreground)]">Untitled</em>}
                  </div>
                  <div className="truncate text-xs text-[var(--color-charcoal-500)]">
                    {p.body.slice(0, 100)}
                    {p.body.length > 100 ? "…" : ""}
                  </div>
                </div>
                <span className="text-xs text-[var(--color-charcoal-500)]">
                  {p.drafterName.split(" ")[0]}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
                  {p.mediaCount > 0 ? (
                    <>
                      <Paperclip className="h-3 w-3" />
                      {p.mediaCount}
                    </>
                  ) : (
                    <span className="text-[var(--color-charcoal-300)]">—</span>
                  )}
                </span>
                <span className="text-right text-xs text-[var(--color-muted-foreground)]">
                  {formatDistanceToNow(new Date(p.updatedAt), {
                    addSuffix: true,
                  })}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

const ICONS: Record<StageKey | "REJECTED", typeof PenLine> = {
  DRAFT: PenLine,
  PENDING_APPROVAL: Clock,
  APPROVED: Check,
  POSTED: Radio,
  REJECTED: XCircle,
};

const TONE_HEADER: Record<StageKey | "REJECTED", string> = {
  DRAFT: "bg-[var(--color-grapefruit)]/40 text-[var(--color-charcoal)]",
  PENDING_APPROVAL: "bg-[var(--color-bee)]/55 text-[var(--color-charcoal)]",
  APPROVED: "bg-[var(--color-lime)]/70 text-[var(--color-forest-950)]",
  POSTED: "bg-[var(--color-teal)]/70 text-[var(--color-forest-950)]",
  REJECTED: "bg-[var(--color-raspberry)]/20 text-[var(--color-raspberry)]",
};

// Re-export Badge so the component file is consumable on its own
export { Badge };

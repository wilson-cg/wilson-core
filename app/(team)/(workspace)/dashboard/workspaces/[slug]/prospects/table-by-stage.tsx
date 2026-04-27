"use client";

import Link from "next/link";
import { useOptimistic, useTransition, useState, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { PIPELINE, type KanbanProspect, type StageKey } from "./kanban-board";
import { moveProspectToStage } from "@/lib/actions";

/**
 * Table view grouped by pipeline stage. Each stage is its own collapsible
 * section with a table of its prospects. Rows are draggable; stage headers
 * are droppable. Shares the optimistic-move reducer with the Kanban.
 */
export function TableByStage({
  slug,
  prospects,
}: {
  slug: string;
  prospects: KanbanProspect[];
}) {
  const [optimistic, addOptimistic] = useOptimistic(
    prospects,
    (state: KanbanProspect[], move: { id: string; stage: StageKey }) =>
      state.map((p) =>
        p.id === move.id
          ? {
              ...p,
              status: stageCanonical(move.stage),
              updatedAt: new Date().toISOString(),
            }
          : p
      )
  );
  const [, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingRef = useRef<KanbanProspect | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    setDraggingId(id);
    draggingRef.current = prospects.find((p) => p.id === id) ?? null;
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    draggingRef.current = null;
    if (!e.over) return;
    const id = String(e.active.id);
    const stage = String(e.over.id) as StageKey;
    const prospect = optimistic.find((p) => p.id === id);
    if (!prospect) return;
    if (statusStage(prospect.status) === stage) return;

    startTransition(() => {
      addOptimistic({ id, stage });
      const fd = new FormData();
      fd.set("prospectId", id);
      fd.set("stage", stage);
      moveProspectToStage(fd).catch((err) => console.error("Move failed", err));
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mx-auto w-full max-w-6xl space-y-3 px-8 py-6">
        {PIPELINE.map((col) => {
          const items = optimistic.filter((p) => col.match.includes(p.status));
          const isCollapsed = collapsed[col.key] ?? false;
          return (
            <StageSection
              key={col.key}
              id={col.key}
              label={col.label}
              count={items.length}
              collapsed={isCollapsed}
              onToggle={() =>
                setCollapsed((c) => ({ ...c, [col.key]: !isCollapsed }))
              }
            >
              {items.length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
                  Drop a prospect here to move them to {col.label}.
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {items.map((p) => (
                    <DraggableRow
                      key={p.id}
                      prospect={p}
                      slug={slug}
                      dragging={p.id === draggingId}
                    />
                  ))}
                </div>
              )}
            </StageSection>
          );
        })}
      </div>

      <DragOverlay>
        {draggingRef.current ? (
          <DragGhost prospect={draggingRef.current} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ─── Stage section (droppable) ────────────────────────────── */

function StageSection({
  id,
  label,
  count,
  collapsed,
  onToggle,
  children,
}: {
  id: StageKey;
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={`overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)] shadow-[var(--shadow-soft)] transition-colors ${
        isOver
          ? "border-[var(--color-forest)] ring-2 ring-[var(--color-forest)]/30"
          : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold transition-colors ${stageTone(
          id
        )}`}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        <span className="flex-1 text-left">{label}</span>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/60 px-1.5 text-[10px] font-semibold text-[var(--color-charcoal)]">
          {count}
        </span>
      </button>

      {collapsed ? null : (
        <>
          {/* Table header row */}
          {count > 0 ? (
            <div className="grid grid-cols-[auto_2fr_1.5fr_1fr_1fr_auto] items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-virgil)] px-5 py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <span className="w-4">&nbsp;</span>
              <span>Prospect</span>
              <span>Company</span>
              <span>Fit</span>
              <span>Owner</span>
              <span className="text-right">Updated</span>
            </div>
          ) : null}
          {children}
        </>
      )}
    </section>
  );
}

/* ─── Draggable row ────────────────────────────────────────── */

function DraggableRow({
  prospect,
  slug,
  dragging,
}: {
  prospect: KanbanProspect;
  slug: string;
  dragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: prospect.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[auto_2fr_1.5fr_1fr_1fr_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--color-virgil)] ${
        dragging ? "opacity-30" : ""
      }`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label="Drag to move"
        className="cursor-grab text-[var(--color-charcoal-300)] active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Link
        href={`/dashboard/workspaces/${slug}/prospects/${prospect.id}`}
        className="min-w-0"
      >
        <div className="truncate text-sm font-medium text-[var(--color-charcoal)]">
          {prospect.fullName}
        </div>
        <div className="truncate text-xs text-[var(--color-muted-foreground)]">
          {prospect.title ?? "—"}
        </div>
      </Link>
      <Link
        href={`/dashboard/workspaces/${slug}/prospects/${prospect.id}`}
        className="truncate text-sm text-[var(--color-charcoal-500)]"
      >
        {prospect.company}
      </Link>
      <div>
        <Badge variant={fitBadge(prospect.fitScore)}>
          {humanizeFit(prospect.fitScore)}
        </Badge>
      </div>
      <div className="truncate text-xs text-[var(--color-charcoal-500)]">
        {prospect.assigneeName ?? "—"}
      </div>
      <div className="text-right text-xs text-[var(--color-muted-foreground)]">
        {formatDistanceToNow(new Date(prospect.updatedAt), { addSuffix: true })}
      </div>
    </div>
  );
}

function DragGhost({ prospect }: { prospect: KanbanProspect }) {
  return (
    <div className="pointer-events-none w-80 rounded-[var(--radius-md)] border border-[var(--color-forest)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-lifted)]">
      <div className="text-sm font-semibold text-[var(--color-forest)]">
        {prospect.fullName}
      </div>
      <div className="text-xs text-[var(--color-muted-foreground)]">
        {prospect.company}
      </div>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────── */

function stageCanonical(stage: StageKey): string {
  switch (stage) {
    case "IDENTIFIED":
      return "IDENTIFIED";
    case "DRAFTING":
      return "MESSAGE_DRAFTED";
    case "SENT":
      return "SENT";
    case "REPLIED":
      return "REPLIED";
    case "MEETING_BOOKED":
      return "MEETING_BOOKED";
    case "NOT_INTERESTED":
      return "NOT_INTERESTED";
  }
}

function statusStage(status: string): StageKey | null {
  for (const col of PIPELINE) {
    if (col.match.includes(status)) return col.key;
  }
  return null;
}

function stageTone(stage: StageKey): string {
  const map: Record<StageKey, string> = {
    IDENTIFIED: "bg-[var(--color-virgil-dark)] text-[var(--color-charcoal)]",
    DRAFTING: "bg-[var(--color-bee)]/40 text-[var(--color-charcoal)]",
    SENT: "bg-[var(--color-teal)]/50 text-[var(--color-forest-950)]",
    REPLIED: "bg-[var(--color-aperol)]/25 text-[var(--color-charcoal)]",
    MEETING_BOOKED: "bg-[var(--color-forest)] text-[var(--color-lime)]",
    NOT_INTERESTED:
      "bg-[var(--color-raspberry)]/20 text-[var(--color-raspberry)]",
  };
  return map[stage];
}

function fitBadge(s: string) {
  if (s === "STRONG") return "approved" as const;
  if (s === "NOT_A_FIT") return "rejected" as const;
  return "drafted" as const;
}

function humanizeFit(s: string) {
  if (s === "STRONG") return "Strong fit";
  if (s === "NOT_A_FIT") return "Not a fit";
  return "Possible fit";
}

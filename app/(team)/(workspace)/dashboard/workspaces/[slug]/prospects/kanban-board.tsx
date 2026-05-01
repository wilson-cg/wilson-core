"use client";

import { useOptimistic, useTransition, useRef } from "react";
import Link from "next/link";
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
import { moveProspectToStage } from "@/lib/actions";
import { useState } from "react";

/* ─── Pipeline config ────────────────────────────────────────── */

export type StageKey =
  | "IDENTIFIED"
  | "NEEDS_APPROVER_DECISION"
  | "DRAFTING"
  | "SENT"
  | "REPLIED"
  | "MEETING_BOOKED"
  | "NOT_INTERESTED";

export const PIPELINE: { key: StageKey; label: string; match: string[] }[] = [
  { key: "IDENTIFIED", label: "Identified", match: ["IDENTIFIED"] },
  {
    key: "NEEDS_APPROVER_DECISION",
    label: "Needs decision",
    match: ["NEEDS_APPROVER_DECISION"],
  },
  {
    key: "DRAFTING",
    label: "Drafting",
    match: ["MESSAGE_DRAFTED", "PENDING_APPROVAL", "APPROVED"],
  },
  { key: "SENT", label: "Sent", match: ["SENT"] },
  { key: "REPLIED", label: "Replied", match: ["REPLIED"] },
  { key: "MEETING_BOOKED", label: "Meeting booked", match: ["MEETING_BOOKED"] },
  { key: "NOT_INTERESTED", label: "Not interested", match: ["NOT_INTERESTED"] },
];

/* ─── Types ──────────────────────────────────────────────────── */

export type KanbanProspect = {
  id: string;
  fullName: string;
  company: string;
  title: string | null;
  status: string;
  icpScore: number;
  signalType: string | null;
  approverDecision: "PENDING" | "APPROVED" | "DECLINED";
  updatedAt: string;
  assigneeName: string | null;
  lastMessageStatus: string | null;
};

type OptimisticMove = { id: string; stage: StageKey };

function applyMove(
  prospects: KanbanProspect[],
  move: OptimisticMove
): KanbanProspect[] {
  return prospects.map((p) =>
    p.id === move.id
      ? {
          ...p,
          status: stageToCanonicalStatus(move.stage),
          updatedAt: new Date().toISOString(),
        }
      : p
  );
}

function stageToCanonicalStatus(stage: StageKey): string {
  switch (stage) {
    case "IDENTIFIED":
      return "IDENTIFIED";
    case "NEEDS_APPROVER_DECISION":
      return "NEEDS_APPROVER_DECISION";
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

function statusToStage(status: string): StageKey | null {
  for (const col of PIPELINE) {
    if (col.match.includes(status)) return col.key;
  }
  return null;
}

/* ─── The board ──────────────────────────────────────────────── */

export function KanbanBoard({
  slug,
  prospects,
  totals,
}: {
  slug: string;
  prospects: KanbanProspect[];
  totals: {
    totalSent: number;
    replied: number;
    meetings: number;
    notInterested: number;
  };
}) {
  const [optimistic, addOptimistic] = useOptimistic(prospects, applyMove);
  const [, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingRef = useRef<KanbanProspect | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const columns = PIPELINE.map((col) => ({
    ...col,
    items: optimistic.filter((p) => col.match.includes(p.status)),
  }));

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
    const targetStage = String(e.over.id) as StageKey;

    const prospect = optimistic.find((p) => p.id === id);
    if (!prospect) return;
    if (statusToStage(prospect.status) === targetStage) return;

    startTransition(() => {
      addOptimistic({ id, stage: targetStage });
      const fd = new FormData();
      fd.set("prospectId", id);
      fd.set("stage", targetStage);
      moveProspectToStage(fd).catch((err) => {
        console.error("Move failed", err);
      });
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-x-auto">
        <div className="flex min-w-max gap-3 px-8 py-5">
          {columns.map((col) => {
            const stat = columnStat(col.key, {
              count: col.items.length,
              ...totals,
            });
            return (
              <Column
                key={col.key}
                id={col.key}
                label={col.label}
                count={col.items.length}
                statLine={stat}
              >
                {col.items.length === 0 ? (
                  <EmptySlot />
                ) : (
                  col.items.map((p) => (
                    <DraggableCard
                      key={p.id}
                      prospect={p}
                      slug={slug}
                      isDragging={p.id === draggingId}
                    />
                  ))
                )}
              </Column>
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {draggingRef.current ? (
          <CardContent prospect={draggingRef.current} dragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  id,
  label,
  count,
  statLine,
  children,
}: {
  id: StageKey;
  label: string;
  count: number;
  statLine: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-[var(--radius-lg)] border bg-[var(--color-surface)] shadow-[var(--shadow-soft)] transition-colors ${
        isOver
          ? "border-[var(--color-forest)] ring-2 ring-[var(--color-forest)]/30"
          : ""
      }`}
    >
      <div
        className={`flex items-center gap-2 rounded-t-[var(--radius-lg)] border-b border-[var(--color-border)] px-3 py-2.5 text-sm font-semibold ${columnTone(id)}`}
      >
        <span className="flex-1">{label}</span>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/60 px-1.5 text-[10px] font-semibold text-[var(--color-charcoal)]">
          {count}
        </span>
      </div>

      <div className="flex-1 space-y-2 p-2">{children}</div>

      <div className="rounded-b-[var(--radius-lg)] border-t border-[var(--color-border)] bg-[var(--color-virgil)] px-3 py-2 text-[11px] text-[var(--color-charcoal-500)]">
        <div>
          <span className="font-semibold text-[var(--color-charcoal)]">
            {count}
          </span>{" "}
          in stage
        </div>
        {statLine ? (
          <div className="text-[10px] text-[var(--color-muted-foreground)]">
            {statLine}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-virgil)] px-3 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
      Drop here
    </div>
  );
}

function DraggableCard({
  prospect,
  slug,
  isDragging,
}: {
  prospect: KanbanProspect;
  slug: string;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: prospect.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Link
      ref={setNodeRef}
      href={`/dashboard/workspaces/${slug}/prospects/${prospect.id}`}
      {...listeners}
      {...attributes}
      style={style}
      className={`block cursor-grab rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)] transition-opacity hover:border-[var(--color-forest)] hover:shadow-[var(--shadow-card)] active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <CardContent prospect={prospect} />
    </Link>
  );
}

function CardContent({
  prospect,
  dragging = false,
}: {
  prospect: KanbanProspect;
  dragging?: boolean;
}) {
  return (
    <div
      className={
        dragging
          ? "w-72 rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-3 shadow-[var(--shadow-lifted)] ring-2 ring-[var(--color-forest)]/40"
          : ""
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight text-[var(--color-forest)]">
            {prospect.fullName}
          </div>
          <div className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">
            {prospect.title ? `${prospect.title} · ` : ""}
            {prospect.company}
          </div>
        </div>
        <IcpPill score={prospect.icpScore} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {prospect.signalType ? (
          <span className="inline-flex items-center rounded-full border bg-[var(--color-virgil)] px-2 py-px text-[10px] text-[var(--color-charcoal-500)]">
            {humanSignal(prospect.signalType)}
          </span>
        ) : null}
        {prospect.approverDecision === "APPROVED" ? (
          <Badge variant="approved">Approved</Badge>
        ) : prospect.approverDecision === "DECLINED" ? (
          <Badge variant="rejected">Declined</Badge>
        ) : null}
        {prospect.lastMessageStatus ? (
          <Badge variant={msgBadge(prospect.lastMessageStatus)}>
            {humanizeMsg(prospect.lastMessageStatus)}
          </Badge>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--color-muted-foreground)]">
        <span className="truncate">
          {prospect.assigneeName ? prospect.assigneeName.split(" ")[0] : "—"}
        </span>
        <span>
          {formatDistanceToNow(new Date(prospect.updatedAt), {
            addSuffix: true,
          })}
        </span>
      </div>
    </div>
  );
}

/**
 * ICP pill — top-right corner of every Kanban card. Color scale uses only
 * existing brand vars (V1 UX overhaul, 2026-05-01):
 *   4/4 → forest bg, lime text     (strong fit)
 *   3/4 → forest outline, forest text
 *   2/4 → bee bg
 *   1/4 → grapefruit bg
 *   0/4 → charcoal-300 bg, muted text
 */
function IcpPill({ score }: { score: number }) {
  const cls =
    score >= 4
      ? "bg-[var(--color-forest)] text-[var(--color-lime)]"
      : score === 3
        ? "border border-[var(--color-forest)] bg-[var(--color-surface)] text-[var(--color-forest)]"
        : score === 2
          ? "bg-[var(--color-bee)] text-[var(--color-charcoal)]"
          : score === 1
            ? "bg-[var(--color-grapefruit)] text-[var(--color-charcoal)]"
            : "bg-[var(--color-charcoal-200)] text-[var(--color-charcoal-500)]";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${cls}`}
      title={`ICP fit ${score}/4`}
    >
      {score}/4
    </span>
  );
}

function columnTone(key: StageKey): string {
  const map: Record<StageKey, string> = {
    IDENTIFIED: "bg-[var(--color-virgil-dark)] text-[var(--color-charcoal)]",
    NEEDS_APPROVER_DECISION:
      "bg-[var(--color-grapefruit)]/30 text-[var(--color-charcoal)]",
    DRAFTING: "bg-[var(--color-bee)]/40 text-[var(--color-charcoal)]",
    SENT: "bg-[var(--color-teal)]/50 text-[var(--color-forest-950)]",
    REPLIED: "bg-[var(--color-aperol)]/25 text-[var(--color-charcoal)]",
    MEETING_BOOKED: "bg-[var(--color-forest)] text-[var(--color-lime)]",
    NOT_INTERESTED:
      "bg-[var(--color-raspberry)]/20 text-[var(--color-raspberry)]",
  };
  return map[key];
}

function columnStat(
  key: StageKey,
  ctx: {
    count: number;
    totalSent: number;
    replied: number;
    meetings: number;
    notInterested: number;
  }
): string | null {
  const denom = ctx.totalSent + ctx.replied + ctx.meetings + ctx.notInterested;
  if (key === "SENT" && ctx.totalSent > 0) {
    const reach =
      denom > 0
        ? Math.round(((ctx.replied + ctx.meetings) / denom) * 100)
        : 0;
    return `${reach}% reply rate overall`;
  }
  if (key === "REPLIED" && denom > 0) {
    return `${Math.round((ctx.replied / denom) * 100)}% of sent`;
  }
  if (key === "MEETING_BOOKED" && denom > 0) {
    return `${Math.round((ctx.meetings / denom) * 100)}% won`;
  }
  if (key === "NOT_INTERESTED" && denom > 0) {
    return `${Math.round((ctx.notInterested / denom) * 100)}% lost`;
  }
  return null;
}

function humanSignal(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function msgBadge(s: string) {
  const map: Record<
    string,
    "drafted" | "pending" | "approved" | "sent" | "replied" | "rejected"
  > = {
    DRAFT: "drafted",
    PENDING_APPROVAL: "pending",
    APPROVED: "approved",
    SENT: "sent",
    REPLIED: "replied",
    REJECTED: "rejected",
  };
  return map[s] ?? "drafted";
}

function humanizeMsg(s: string) {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    PENDING_APPROVAL: "Pending",
    APPROVED: "Approved",
    SENT: "Sent",
    REPLIED: "Replied",
    REJECTED: "Rejected",
  };
  return map[s] ?? s;
}

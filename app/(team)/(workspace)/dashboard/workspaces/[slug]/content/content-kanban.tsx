"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useOptimistic,
  useTransition,
  useRef,
  useState,
} from "react";
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
import {
  Clock,
  Check,
  Radio,
  PenLine,
  XCircle,
  ArrowRight,
  Paperclip,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { movePostToStage } from "@/lib/actions";

const LIVE_COLLAPSED_KEY = "content-kanban:live-collapsed";

/* ─── Pipeline config ──────────────────────────────────────── */

export type StageKey = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "POSTED";

export const STAGES: { key: StageKey; label: string; tone: Tone }[] = [
  { key: "DRAFT", label: "In progress", tone: "inprogress" },
  { key: "PENDING_APPROVAL", label: "Waiting on approval", tone: "pending" },
  { key: "APPROVED", label: "Approved", tone: "approved" },
  { key: "POSTED", label: "Live", tone: "live" },
];

export type Tone = "inprogress" | "pending" | "approved" | "live";

const TONES: Record<Tone, { header: string; card: string; pill: string; icon: typeof PenLine }> = {
  inprogress: {
    header: "bg-[var(--color-grapefruit)]/50 text-[var(--color-charcoal)]",
    card: "bg-[var(--color-grapefruit)]/25 border-[var(--color-grapefruit)]/40",
    pill: "bg-[var(--color-grapefruit)] text-[var(--color-charcoal)]",
    icon: PenLine,
  },
  pending: {
    header: "bg-[var(--color-bee)]/55 text-[var(--color-charcoal)]",
    card: "bg-[var(--color-bee)]/15 border-[var(--color-bee)]/40",
    pill: "bg-[var(--color-bee)] text-[var(--color-charcoal)]",
    icon: Clock,
  },
  approved: {
    header: "bg-[var(--color-lime)]/70 text-[var(--color-forest-950)]",
    card: "bg-[var(--color-lime)]/15 border-[var(--color-lime)]/40",
    pill: "bg-[var(--color-lime)] text-[var(--color-forest-950)]",
    icon: Check,
  },
  live: {
    header: "bg-[var(--color-teal)]/70 text-[var(--color-forest-950)]",
    card: "bg-[var(--color-teal)]/15 border-[var(--color-teal)]/40",
    pill: "bg-[var(--color-teal)] text-[var(--color-forest-950)]",
    icon: Radio,
  },
};

export type KanbanPost = {
  id: string;
  title: string | null;
  body: string;
  status: string;
  drafterName: string | null;
  updatedAt: string;
  mediaCount: number;
  firstMediaUrl: string | null;
};

export function ContentKanban({
  slug,
  posts,
  rejected,
}: {
  slug: string;
  posts: KanbanPost[];
  rejected: KanbanPost[];
}) {
  const [optimistic, addOptimistic] = useOptimistic(
    posts,
    (state: KanbanPost[], move: { id: string; stage: StageKey }) =>
      state.map((p) =>
        p.id === move.id
          ? { ...p, status: move.stage, updatedAt: new Date().toISOString() }
          : p
      )
  );
  const [, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingRef = useRef<KanbanPost | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveCollapsed, setLiveCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LIVE_COLLAPSED_KEY);
      if (stored === "1") setLiveCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  function toggleLiveCollapsed() {
    setLiveCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(LIVE_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Group once per render instead of doing a full filter pass per stage.
  const itemsByStage = useMemo(() => {
    const groups: Record<StageKey, KanbanPost[]> = {
      DRAFT: [],
      PENDING_APPROVAL: [],
      APPROVED: [],
      POSTED: [],
    };
    for (const p of optimistic) {
      const key = p.status as StageKey;
      if (groups[key]) groups[key].push(p);
    }
    return groups;
  }, [optimistic]);

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    setDraggingId(id);
    draggingRef.current = posts.find((p) => p.id === id) ?? null;
    setErrorMsg(null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    draggingRef.current = null;
    if (!e.over) return;
    const id = String(e.active.id);
    const stage = String(e.over.id) as StageKey;
    const post = optimistic.find((p) => p.id === id);
    if (!post) return;
    if (post.status === stage) return;

    startTransition(async () => {
      addOptimistic({ id, stage });
      const fd = new FormData();
      fd.set("postId", id);
      fd.set("stage", stage);
      try {
        await movePostToStage(fd);
      } catch (err) {
        console.error("Move failed", err);
        setErrorMsg(err instanceof Error ? err.message : "Move failed");
        // The server's revalidatePath will reset state on next pass
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="px-8 py-6">
        {errorMsg ? (
          <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-raspberry)]/40 bg-[var(--color-raspberry)]/5 px-3 py-2 text-xs text-[var(--color-raspberry)]">
            {errorMsg}
          </div>
        ) : null}

        {rejected.length > 0 ? (
          <RejectedStrip slug={slug} posts={rejected} />
        ) : null}

        <div
          className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
            liveCollapsed ? "xl:grid-cols-[1fr_1fr_1fr_auto]" : "xl:grid-cols-4"
          }`}
        >
          {STAGES.map((s) => {
            const items = itemsByStage[s.key];
            const isLive = s.key === "POSTED";
            return (
              <Column
                key={s.key}
                stage={s.key}
                label={s.label}
                tone={s.tone}
                items={items}
                slug={slug}
                draggingId={draggingId}
                collapsible={isLive}
                collapsed={isLive && liveCollapsed}
                onToggleCollapsed={isLive ? toggleLiveCollapsed : undefined}
              />
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {draggingRef.current ? <DragGhost post={draggingRef.current} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ─── Column (droppable) ──────────────────────────────────── */

function Column({
  stage,
  label,
  tone,
  items,
  slug,
  draggingId,
  collapsible = false,
  collapsed = false,
  onToggleCollapsed,
}: {
  stage: StageKey;
  label: string;
  tone: Tone;
  items: KanbanPost[];
  slug: string;
  draggingId: string | null;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const styles = TONES[tone];
  const Icon = styles.icon;
  const isDraftCol = stage === "DRAFT";

  if (collapsible && collapsed) {
    return (
      <div
        ref={setNodeRef}
        className={`flex h-fit flex-col rounded-[var(--radius-lg)] border bg-[var(--color-surface)] shadow-[var(--shadow-soft)] transition-all ${
          isOver
            ? "border-[var(--color-forest)] ring-2 ring-[var(--color-forest)]/30"
            : ""
        }`}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded="false"
          aria-label={`Expand ${label}`}
          className={`flex items-center gap-2 rounded-[var(--radius-lg)] px-4 py-3 text-sm font-semibold transition-colors ${styles.header} hover:brightness-95`}
        >
          <ChevronRight className="h-4 w-4" />
          <Icon className="h-4 w-4" />
          <span className="flex-1 text-left">{label}</span>
          <span
            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${styles.pill}`}
          >
            {items.length}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-[var(--radius-lg)] border bg-[var(--color-surface)] shadow-[var(--shadow-soft)] transition-all ${
        isOver
          ? "border-[var(--color-forest)] ring-2 ring-[var(--color-forest)]/30"
          : ""
      }`}
    >
      <div
        className={`flex items-center gap-2 rounded-t-[var(--radius-lg)] px-4 py-3 text-sm font-semibold ${styles.header} ${
          collapsible ? "cursor-pointer select-none" : ""
        }`}
        onClick={collapsible ? onToggleCollapsed : undefined}
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? "true" : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggleCollapsed?.();
                }
              }
            : undefined
        }
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1">{label}</span>
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${styles.pill}`}
        >
          {items.length}
        </span>
        {isDraftCol ? (
          <Link
            href={`/dashboard/workspaces/${slug}/content/new`}
            title="New post (⌘⇧N or N)"
            className={`-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${styles.pill} hover:brightness-95`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </Link>
        ) : null}
        {collapsible ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapsed?.();
            }}
            aria-label={`Collapse ${label}`}
            title="Collapse"
            className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-2 p-3">
        {items.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-virgil)] px-3 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
            Drop here
          </div>
        ) : (
          items.map((p) => (
            <DraggableCard
              key={p.id}
              post={p}
              slug={slug}
              tone={tone}
              isDragging={p.id === draggingId}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Draggable card ──────────────────────────────────────── */

function DraggableCard({
  post,
  slug,
  tone,
  isDragging,
}: {
  post: KanbanPost;
  slug: string;
  tone: Tone;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: post.id,
  });
  const styles = TONES[tone];
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const preview = (post.body ?? "").split("\n").filter(Boolean).slice(0, 2);

  return (
    <Link
      ref={setNodeRef}
      href={`/dashboard/workspaces/${slug}/content/${post.id}`}
      {...listeners}
      {...attributes}
      style={style}
      className={`block cursor-grab rounded-[var(--radius-md)] border p-3 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] active:cursor-grabbing ${styles.card} ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <CardBody post={post} preview={preview} />
    </Link>
  );
}

function CardBody({
  post,
  preview,
}: {
  post: KanbanPost;
  preview: string[];
}) {
  return (
    <>
      {post.title ? (
        <div className="text-sm font-semibold leading-tight text-[var(--color-charcoal)]">
          {post.title}
        </div>
      ) : (
        <div className="text-sm font-semibold italic text-[var(--color-muted-foreground)]">
          Untitled
        </div>
      )}
      <div className="mt-1 space-y-0.5 text-xs leading-snug text-[var(--color-charcoal-500)]">
        {preview.map((line, i) => (
          <p key={i} className="line-clamp-2">
            {line}
          </p>
        ))}
      </div>
      {post.firstMediaUrl ? (
        <div className="mt-2 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.firstMediaUrl}
            alt=""
            className="h-24 w-full object-cover"
          />
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--color-muted-foreground)]">
        <span className="inline-flex items-center gap-1.5">
          {(post.drafterName ?? "—").split(" ")[0]}
          {post.mediaCount > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <Paperclip className="h-2.5 w-2.5" />
              {post.mediaCount}
            </span>
          ) : null}
        </span>
        <span>
          {formatDistanceToNow(new Date(post.updatedAt), { addSuffix: true })}
        </span>
      </div>
    </>
  );
}

function DragGhost({ post }: { post: KanbanPost }) {
  const preview = (post.body ?? "").split("\n").filter(Boolean).slice(0, 2);
  return (
    <div className="pointer-events-none w-72 rounded-[var(--radius-md)] border border-[var(--color-forest)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-lifted)]">
      <CardBody post={post} preview={preview} />
    </div>
  );
}

/* ─── Rejected strip ──────────────────────────────────────── */

function RejectedStrip({
  slug,
  posts,
}: {
  slug: string;
  posts: KanbanPost[];
}) {
  return (
    <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-raspberry)]/40 bg-[var(--color-raspberry)]/5 p-4">
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-[var(--color-raspberry)]" />
        <span className="text-sm font-semibold text-[var(--color-raspberry)]">
          {posts.length} rejected — needs rewriting
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {posts.map((p) => (
          <li key={p.id}>
            <Link
              href={`/dashboard/workspaces/${slug}/content/${p.id}`}
              className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--color-virgil)]"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-charcoal)]">
                {p.title ?? "Untitled"}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-[var(--color-charcoal-300)]" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

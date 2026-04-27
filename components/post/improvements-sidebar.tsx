"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCw, Trash2, TrendingUp, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Improvements sidebar — modeled after the user's reference screenshot.
 * Two tabs:
 *
 *   Sentence — every harper.js finding grouped by category (Clarity,
 *              Grammar, Style, Repetition, Punctuation, etc.) with a
 *              "Current" snippet vs a "Improved" replacement preview
 *              and an apply button.
 *
 *   Content  — overall readability score (Flesch-Kincaid grade) with
 *              an "Aim for X or lower" hint + a manual re-check button.
 *
 * Powered by harper.js (Apache-2.0). Runs entirely in a Web Worker.
 */
export type Improvement = {
  category: string;
  message: string;
  currentText: string;
  improvedText: string | null; // null when there's no replacement (just a flag)
  start: number;
  end: number;
  // Index into the underlying lints[] array — used for applySuggestion
  lintIndex: number;
  suggestionIndex: number;
};

export function ImprovementsSidebar({
  text,
  onApplySuggestion,
  onClose,
}: {
  text: string;
  onApplySuggestion: (next: string) => void;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<"sentence" | "content">("sentence");
  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // bumped to force re-lint

  const linterRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    linter: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lints: any[];
  } | null>(null);

  // Lazy-load harper.js once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ WorkerLinter }, { binary }] = await Promise.all([
          import("harper.js"),
          import("harper.js/binary"),
        ]);
        if (cancelled) return;
        const linter = new WorkerLinter({ binary });
        await linter.setup();
        if (cancelled) return;
        linterRef.current = { linter, lints: [] };
        setTick((t) => t + 1); // trigger initial lint
      } catch (e) {
        console.error("harper.js failed to load", e);
        setError(
          "Writing checker unavailable in this browser. The editor still works."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced lint
  useEffect(() => {
    const ref = linterRef.current;
    if (!ref || !text.trim()) {
      setImprovements([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const lints = await ref.linter.lint(text);
        ref.lints = lints;
        const next: Improvement[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lints.forEach((l: any, lintIndex: number) => {
          const span = l.span();
          const sugs = l.suggestions();
          const currentText = text.slice(span.start, span.end);
          if (sugs.length === 0) {
            next.push({
              category: l.lint_kind_pretty(),
              message: l.message(),
              currentText,
              improvedText: null,
              start: span.start,
              end: span.end,
              lintIndex,
              suggestionIndex: 0,
            });
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sugs.slice(0, 1).forEach((s: any, sIdx: number) => {
            const replacement = s.get_replacement_text() ?? "";
            // Build an "improved" preview of the surrounding context
            const improvedText = currentText
              ? buildImprovedSnippet(currentText, replacement, s.kind())
              : replacement;
            next.push({
              category: l.lint_kind_pretty(),
              message: l.message(),
              currentText,
              improvedText,
              start: span.start,
              end: span.end,
              lintIndex,
              suggestionIndex: sIdx,
            });
          });
        });
        setImprovements(next);
      } catch (e) {
        console.error("harper lint failed", e);
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [text, tick]);

  async function applyImprovement(imp: Improvement) {
    const ref = linterRef.current;
    if (!ref) return;
    const lint = ref.lints[imp.lintIndex];
    if (!lint) return;
    try {
      const sugs = lint.suggestions();
      const s = sugs[imp.suggestionIndex];
      if (!s) return;
      const newText = await ref.linter.applySuggestion(text, lint, s);
      onApplySuggestion(newText);
    } catch (e) {
      console.error("applySuggestion failed", e);
    }
  }

  // Group findings by category for the Sentence tab
  const grouped = useMemo(() => {
    const map = new Map<string, Improvement[]>();
    for (const imp of improvements) {
      if (!map.has(imp.category)) map.set(imp.category, []);
      map.get(imp.category)!.push(imp);
    }
    return Array.from(map.entries());
  }, [improvements]);

  const fk = useMemo(() => fleschKincaidGrade(text), [text]);

  return (
    <aside className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="app-heading text-base text-[var(--color-charcoal)]">
          Improvements
        </h3>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-charcoal-300)] hover:text-[var(--color-charcoal)]"
            aria-label="Close improvements panel"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)] bg-[var(--color-virgil)] p-1">
        <TabButton
          active={tab === "sentence"}
          onClick={() => setTab("sentence")}
          icon={<BookOpen className="h-3.5 w-3.5" />}
          count={improvements.length}
        >
          Sentence
        </TabButton>
        <TabButton
          active={tab === "content"}
          onClick={() => setTab("content")}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        >
          Content
        </TabButton>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {error ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">{error}</p>
        ) : null}

        {tab === "content" ? (
          <ContentPanel
            grade={fk}
            onRecheck={() => setTick((t) => t + 1)}
            loading={loading}
            text={text}
          />
        ) : (
          <SentencePanel
            grouped={grouped}
            loading={loading}
            empty={!text.trim()}
            onApply={applyImprovement}
          />
        )}
      </div>
    </aside>
  );
}

/* ─── Content tab ──────────────────────────────────────────── */

function ContentPanel({
  grade,
  onRecheck,
  loading,
  text,
}: {
  grade: number | null;
  onRecheck: () => void;
  loading: boolean;
  text: string;
}) {
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const sentenceCount = (text.match(/[.!?]+/g) ?? []).length || (text.trim() ? 1 : 0);
  return (
    <div className="space-y-3">
      <section className="rounded-[var(--radius-md)] border border-[var(--color-aperol)]/40 bg-[var(--color-aperol)]/5 p-4">
        <header className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Overall score
          </span>
        </header>
        <p className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[var(--color-aperol)]" />
          <span className="app-heading text-2xl text-[var(--color-charcoal)]">
            {grade !== null ? `${grade.toFixed(1)} grade` : "—"}
          </span>
        </p>
        <p className="mt-3 text-xs text-[var(--color-charcoal-500)]">
          The lower the grade, the easier it is to read. Aim for grade 6 or
          lower for LinkedIn — most successful posts are around grade 4–7.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={onRecheck}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Re-checking
            </>
          ) : (
            <>
              <RotateCw className="h-3.5 w-3.5" /> Get new content review
            </>
          )}
        </Button>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-virgil)] p-3 text-xs text-[var(--color-charcoal-500)]">
        <p className="font-medium text-[var(--color-charcoal)]">Stats</p>
        <dl className="mt-1.5 grid grid-cols-2 gap-1">
          <dt>Words</dt>
          <dd className="text-right font-mono">{wordCount}</dd>
          <dt>Sentences</dt>
          <dd className="text-right font-mono">{sentenceCount}</dd>
          <dt>Avg words/sentence</dt>
          <dd className="text-right font-mono">
            {sentenceCount > 0
              ? (wordCount / sentenceCount).toFixed(1)
              : "—"}
          </dd>
        </dl>
      </section>
    </div>
  );
}

/* ─── Sentence tab ─────────────────────────────────────────── */

function SentencePanel({
  grouped,
  loading,
  empty,
  onApply,
}: {
  grouped: [string, Improvement[]][];
  loading: boolean;
  empty: boolean;
  onApply: (imp: Improvement) => void;
}) {
  if (empty) {
    return (
      <p className="px-2 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
        Start writing — suggestions will appear here as you go.
      </p>
    );
  }
  if (loading && grouped.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 px-2 py-8 text-xs text-[var(--color-muted-foreground)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
      </p>
    );
  }
  if (grouped.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-xs text-[var(--color-forest)]">
        Looks clean. Nothing to flag.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([category, items]) => (
        <section key={category}>
          <header className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-charcoal-500)]">
            <span className="inline-block h-3 w-1 rounded-full bg-[var(--color-forest)]" />
            {category}
            <span className="ml-auto rounded-full bg-[var(--color-virgil-dark)] px-1.5 text-[9px] font-semibold">
              {items.length}
            </span>
          </header>
          <div className="space-y-2">
            {items.map((imp, i) => (
              <ImprovementCard
                key={`${category}-${i}`}
                imp={imp}
                onApply={() => onApply(imp)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ImprovementCard({
  imp,
  onApply,
}: {
  imp: Improvement;
  onApply: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]">
      <p className="mb-2 text-[11px] text-[var(--color-charcoal-500)]">
        {imp.message}
      </p>
      <div className="space-y-1.5">
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-virgil)] p-2">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="text-[var(--color-muted-foreground)]">Current</span>
          </div>
          <p className="mt-0.5 break-words font-mono text-[11px] text-[var(--color-charcoal)]">
            {imp.currentText || "(empty)"}
          </p>
        </div>
        {imp.improvedText !== null ? (
          <div className="rounded-[var(--radius-sm)] border-l-2 border-[var(--color-lime)] bg-[var(--color-lime)]/10 p-2">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="font-semibold text-[var(--color-forest)]">
                Improved
              </span>
              <button
                type="button"
                onClick={onApply}
                className="rounded-full bg-[var(--color-forest)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-virgil)] hover:bg-[var(--color-forest-900)]"
              >
                Apply
              </button>
            </div>
            <p className="mt-0.5 break-words font-mono text-[11px] text-[var(--color-charcoal)]">
              {imp.improvedText || "(remove)"}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Tab button ───────────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-[var(--color-surface)] text-[var(--color-charcoal)] shadow-[var(--shadow-soft)]"
          : "text-[var(--color-charcoal-500)] hover:text-[var(--color-charcoal)]"
      }`}
    >
      {icon}
      {children}
      {count !== undefined && count > 0 ? (
        <span className="ml-1 rounded-full bg-[var(--color-forest)] px-1.5 text-[9px] font-semibold text-[var(--color-virgil)]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

/* ─── Helpers ──────────────────────────────────────────────── */

/** Build an "improved" snippet preview for a suggestion kind. */
function buildImprovedSnippet(
  current: string,
  replacement: string,
  kind: number
): string {
  // SuggestionKind enum: 0=Replace, 1=Remove, 2=InsertAfter
  if (kind === 1) return ""; // Remove
  if (kind === 2) return current + replacement; // InsertAfter
  return replacement; // Replace
}

/** Flesch-Kincaid Grade Level. Uses a syllable-counting heuristic. */
function fleschKincaidGrade(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const sentences = (trimmed.match(/[.!?]+/g) ?? []).length || 1;
  const words = trimmed.split(/\s+/);
  const wordCount = words.length;
  if (wordCount === 0) return null;
  let syllables = 0;
  for (const w of words) syllables += countSyllables(w);
  // 0.39 * (words/sentences) + 11.8 * (syllables/words) − 15.59
  const grade =
    0.39 * (wordCount / sentences) + 11.8 * (syllables / wordCount) - 15.59;
  return Math.max(0, grade);
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return Math.max(1, w.length === 0 ? 0 : 1);
  // Strip silent e
  const stripped = w.replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const vowelGroups = stripped.match(/[aeiouy]+/g);
  return Math.max(1, vowelGroups?.length ?? 1);
}

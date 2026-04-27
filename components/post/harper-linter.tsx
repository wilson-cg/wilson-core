"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Sparkles, Loader2 } from "lucide-react";

/**
 * Grammar / writing checker powered by harper.js (Apache-2.0).
 * Runs entirely client-side in a Web Worker — text never leaves the browser.
 *
 * harper.js is dynamically imported because:
 *   - It uses Web Workers + WASM, neither of which exist during SSR
 *   - WorkerLinter throws during construction in Node-like environments
 *
 * UX:
 *   - Debounces 700ms after typing stops, then lints
 *   - Renders each lint as a row with explanation + apply-suggestion button
 *   - Calls onApplySuggestion(text) when the user accepts a fix so the
 *     parent textarea updates
 */
export type HarperFinding = {
  start: number;
  end: number;
  message: string;
  kind: string;
  suggestions: { text: string; kind: number }[];
};

export function HarperLinter({
  text,
  onApplySuggestion,
}: {
  text: string;
  onApplySuggestion: (newText: string) => void;
}) {
  const [findings, setFindings] = useState<HarperFinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Holds the Linter instance + the original Lint objects so we can
  // call applySuggestion against them later.
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
      } catch (e) {
        console.error("harper.js failed to load", e);
        setError(
          "Writing checker couldn't load. The editor still works — just no live suggestions."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced lint pass
  useEffect(() => {
    if (!linterRef.current || !text.trim()) {
      setFindings([]);
      return;
    }
    const timer = setTimeout(async () => {
      const ref = linterRef.current;
      if (!ref) return;
      setLoading(true);
      try {
        const lints = await ref.linter.lint(text);
        ref.lints = lints;
        const next: HarperFinding[] = lints.map((l: never) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lint = l as any;
          const span = lint.span();
          const sugs = lint.suggestions();
          return {
            start: span.start,
            end: span.end,
            message: lint.message(),
            kind: lint.lint_kind_pretty(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            suggestions: sugs.map((s: any) => ({
              text: s.get_replacement_text(),
              kind: s.kind(),
            })),
          };
        });
        setFindings(next);
      } catch (e) {
        console.error("harper lint failed", e);
      } finally {
        setLoading(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [text]);

  async function applyByIndex(findingIndex: number, suggestionIndex: number) {
    const ref = linterRef.current;
    if (!ref) return;
    const lint = ref.lints[findingIndex];
    if (!lint) return;
    try {
      const sugs = lint.suggestions();
      const s = sugs[suggestionIndex];
      if (!s) return;
      const newText = await ref.linter.applySuggestion(text, lint, s);
      onApplySuggestion(newText);
    } catch (e) {
      console.error("applySuggestion failed", e);
    }
  }

  if (error) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-virgil)] p-3 text-xs text-[var(--color-muted-foreground)]">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> Writing check
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-1 text-[10px] normal-case tracking-normal">
            <Loader2 className="h-3 w-3 animate-spin" /> checking…
          </span>
        ) : findings.length > 0 ? (
          <span className="text-[10px] normal-case tracking-normal text-[var(--color-charcoal-500)]">
            {findings.length} suggestion
            {findings.length === 1 ? "" : "s"}
          </span>
        ) : !text.trim() ? null : (
          <span className="text-[10px] normal-case tracking-normal text-[var(--color-forest)]">
            Looks clean
          </span>
        )}
      </div>

      {findings.length > 0 ? (
        <ul className="space-y-1.5">
          {findings.map((f, i) => (
            <li
              key={`${f.start}-${f.end}-${i}`}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="font-medium text-[var(--color-charcoal)]">
                  {f.kind}
                </span>
                <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                  {text.slice(f.start, f.end)}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-charcoal-500)]">
                {f.message}
              </p>
              {f.suggestions.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {f.suggestions.slice(0, 4).map((s, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => applyByIndex(i, sIdx)}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-virgil)] px-2 py-0.5 text-[11px] text-[var(--color-forest)] hover:border-[var(--color-forest)] hover:bg-white"
                    >
                      {s.kind === 1 ? (
                        <em>Remove</em>
                      ) : s.kind === 2 ? (
                        <em>Insert &ldquo;{s.text}&rdquo;</em>
                      ) : (
                        s.text || <em>(empty)</em>
                      )}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

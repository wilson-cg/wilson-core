"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/wordmark";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { submitOnboardingByToken } from "@/lib/actions";

/**
 * Typeform-style onboarding flow. One question at a time, big serif heading,
 * generous textarea, keyboard-driven navigation:
 *   - Enter to advance
 *   - Shift+Enter for newline inside the textarea
 *   - Cmd/Ctrl+Enter also advances
 *   - Esc to go back
 *
 * Each answer auto-saves on advance via the token-scoped server action.
 */
type Question = {
  id: string;
  question: string;
  answer: string;
  fieldType: "TEXT" | "LONGTEXT" | "URL" | "NUMBER";
};

export function TypeformOnboarding({
  token,
  workspaceName,
  logoUrl,
  accentColor,
  questions,
}: {
  token: string;
  workspaceName: string;
  logoUrl: string | null;
  accentColor: string | null;
  questions: Question[];
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.answer]))
  );
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const total = questions.length;
  const current = questions[index];
  const answered = Object.values(answers).filter((a) => a.trim().length > 0)
    .length;

  // Focus the textarea when changing questions
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end for prefilled answers
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [index]);

  function saveAndAdvance(direction: 1 | -1) {
    if (!current) return;
    const value = answers[current.id] ?? "";
    const original = questions.find((q) => q.id === current.id)?.answer ?? "";

    const proceed = () => {
      const next = index + direction;
      if (next < 0) return;
      if (next >= total) {
        setDone(true);
        return;
      }
      setIndex(next);
    };

    if (value !== original) {
      const fd = new FormData();
      fd.set("token", token);
      fd.set("responseId", current.id);
      fd.set("answer", value);
      startTransition(async () => {
        try {
          await submitOnboardingByToken(fd);
        } catch (e) {
          console.error("Save failed", e);
        }
        proceed();
      });
    } else {
      proceed();
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveAndAdvance(1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      saveAndAdvance(-1);
    }
  }

  if (done) {
    return <Completion workspaceName={workspaceName} logoUrl={logoUrl} accentColor={accentColor} answered={answered} total={total} />;
  }

  if (!current) {
    return (
      <div className="grid min-h-screen place-items-center bg-grid-forest text-[var(--color-virgil)]">
        <div className="text-center">
          <p className="font-display text-3xl">No questions yet</p>
          <p className="mt-2 text-sm opacity-70">
            Your Wilson&apos;s team will add questions here soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-grid-forest text-[var(--color-virgil)]">
      {/* Header — workspace identity + progress */}
      <header className="flex items-center justify-between px-6 py-5 lg:px-12">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${workspaceName} logo`}
              className="h-8 w-8 rounded-md object-cover"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold text-[var(--color-lime)]"
              style={{ background: accentColor ?? "#17614F" }}
            >
              {workspaceName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm font-medium leading-tight">
              {workspaceName}
            </div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-70">
              powered by
              <Wordmark tone="virgil" className="h-2.5" />
            </div>
          </div>
        </div>

        <div className="text-xs tabular-nums opacity-80">
          {index + 1} of {total}
        </div>
      </header>

      {/* Progress bar */}
      <div className="mx-6 h-1 overflow-hidden rounded-full bg-white/10 lg:mx-12">
        <div
          className="h-full bg-[var(--color-lime)] transition-all duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* Question */}
      <main className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-2xl">
          <p className="text-xs uppercase tracking-wider opacity-70">
            Question {index + 1}
          </p>
          <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl lg:text-6xl">
            {current.question}
          </h1>

          <textarea
            ref={textareaRef}
            value={answers[current.id] ?? ""}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, [current.id]: e.target.value }))
            }
            onKeyDown={handleKey}
            rows={4}
            placeholder="Type your answer here…"
            className="mt-8 w-full resize-none rounded-[var(--radius-md)] border border-white/20 bg-white/5 px-4 py-3 text-base leading-relaxed text-[var(--color-virgil)] placeholder:text-[var(--color-virgil)]/40 focus:border-[var(--color-lime)] focus:outline-none focus:ring-2 focus:ring-[var(--color-lime)]/50 md:text-lg"
          />

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghostOnDark"
                onClick={() => saveAndAdvance(-1)}
                disabled={index === 0 || isPending}
                size="sm"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <span className="hidden text-[11px] opacity-60 md:inline">
                Press Enter to continue · Shift+Enter for newline
              </span>
            </div>
            <Button
              type="button"
              variant="accent"
              onClick={() => saveAndAdvance(1)}
              disabled={isPending}
              size="lg"
            >
              {index === total - 1 ? "Finish" : "Next"}{" "}
              {index === total - 1 ? (
                <Check className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </Button>
          </div>

          {isPending ? (
            <p className="mt-3 text-[11px] opacity-60">Saving…</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/* ─── Completion screen ─────────────────────────────────────── */

function Completion({
  workspaceName,
  logoUrl,
  accentColor,
  answered,
  total,
}: {
  workspaceName: string;
  logoUrl: string | null;
  accentColor: string | null;
  answered: number;
  total: number;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-grid-forest px-6 py-12 text-[var(--color-virgil)]">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-lime)] text-[var(--color-forest-950)]">
          <Check className="h-8 w-8" strokeWidth={3} />
        </div>

        <p className="text-xs uppercase tracking-wider opacity-70">
          Thank you, {workspaceName}
        </p>
        <h1 className="mt-2 font-display text-5xl leading-tight md:text-6xl">
          That&apos;s a <span className="display-italic">wrap.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-md text-base opacity-80 md:text-lg">
          You answered {answered} of {total} questions. Your Wilson&apos;s
          team will review your answers and start building your campaign.
        </p>

        <div className="mt-10 flex items-center justify-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${workspaceName} logo`}
              className="h-10 w-10 rounded-md object-cover"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-md text-base font-semibold text-[var(--color-lime)]"
              style={{ background: accentColor ?? "#17614F" }}
            >
              {workspaceName.charAt(0).toUpperCase()}
            </div>
          )}
          <Wordmark tone="virgil" className="h-7" />
        </div>

        <p className="mt-12 text-[11px] opacity-50">
          You can close this window. Your answers are saved.
        </p>
      </div>
    </div>
  );
}

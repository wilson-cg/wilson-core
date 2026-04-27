"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import {
  addOnboardingQuestion,
  updateOnboardingAnswer,
  updateOnboardingQuestion,
  removeOnboardingQuestion,
} from "@/lib/actions";
import { ShareOnboardingLink } from "./share-onboarding-link";

export type OnboardingRow = {
  id: string;
  question: string;
  answer: string | null;
  fieldType: "TEXT" | "LONGTEXT" | "URL" | "NUMBER";
  orderIndex: number;
};

/**
 * Onboarding questionnaire — Google Sheets-style table. Each row is a
 * question + answer pair. Click an answer cell to edit it; click the pencil
 * to edit the question itself; click "Add question" for a new row. Empty
 * answers render with a placeholder so completion progress is obvious.
 */
export function OnboardingSection({
  slug,
  rows,
  onboardingToken,
}: {
  slug: string;
  rows: OnboardingRow[];
  onboardingToken: string | null;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const completed = rows.filter((r) => r.answer && r.answer.trim().length > 0)
    .length;

  return (
    <section className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="app-heading text-lg text-[var(--color-forest)]">
            Onboarding
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            The brief your Wilson&apos;s team works from. Edit any cell —
            saves on blur. Share the link to send the client a
            Typeform-style version.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--color-muted-foreground)]">
            {completed}/{rows.length} answered
          </span>
          {!addingNew ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddingNew(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Add question
            </Button>
          ) : null}
        </div>
      </header>

      {onboardingToken ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-forest-300)] bg-[var(--color-forest-100)]/40 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Public onboarding link
            </div>
            <div className="truncate font-mono text-xs text-[var(--color-charcoal)]">
              /onboard/{onboardingToken}
            </div>
          </div>
          <ShareOnboardingLink token={onboardingToken} />
        </div>
      ) : null}

      {/* Progress bar */}
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-[var(--color-virgil)]">
        <div
          className="h-full rounded-full bg-[var(--color-lime)] transition-all"
          style={{
            width: `${rows.length > 0 ? (completed / rows.length) * 100 : 0}%`,
          }}
        />
      </div>

      {addingNew ? (
        <NewQuestionForm slug={slug} onClose={() => setAddingNew(false)} />
      ) : null}

      {rows.length === 0 && !addingNew ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-virgil)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          No onboarding questions yet. Add the first one above.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
        {rows.map((row, i) => (
          <OnboardingRowView
            key={row.id}
            slug={slug}
            row={row}
            index={i + 1}
          />
        ))}
      </div>
    </section>
  );
}

/* ─── Row view ──────────────────────────────────────────────── */

function OnboardingRowView({
  slug,
  row,
  index,
}: {
  slug: string;
  row: OnboardingRow;
  index: number;
}) {
  const [editingQuestion, setEditingQuestion] = useState(false);

  return (
    <div className="grid grid-cols-[2.5rem_1fr_1px_2fr_auto] items-stretch border-t border-[var(--color-border)] first:border-t-0">
      <div className="flex items-center justify-center bg-[var(--color-virgil)] text-[11px] font-medium text-[var(--color-muted-foreground)]">
        {index}
      </div>

      {/* Question cell */}
      <div className="border-l border-[var(--color-border)] bg-[var(--color-virgil)] p-3">
        {editingQuestion ? (
          <form
            action={updateOnboardingQuestion}
            onSubmit={() => setEditingQuestion(false)}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="workspaceSlug" value={slug} />
            <input type="hidden" name="responseId" value={row.id} />
            <Input
              name="question"
              defaultValue={row.question}
              autoFocus
              required
              minLength={2}
              className="h-8 text-xs"
            />
            <Button type="submit" variant="ghost" size="sm">
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditingQuestion(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditingQuestion(true)}
            className="group flex w-full items-start gap-1 text-left text-xs font-medium text-[var(--color-charcoal)] hover:text-[var(--color-forest)]"
          >
            <span className="flex-1">{row.question}</span>
            <Pencil className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
      </div>

      {/* Vertical divider */}
      <div className="bg-[var(--color-border)]" />

      {/* Answer cell — auto-saves on blur */}
      <AnswerCell slug={slug} row={row} />

      {/* Delete column */}
      <form
        action={removeOnboardingQuestion}
        className="flex items-center border-l border-[var(--color-border)]"
      >
        <input type="hidden" name="workspaceSlug" value={slug} />
        <input type="hidden" name="responseId" value={row.id} />
        <button
          type="submit"
          aria-label="Remove question"
          className="flex h-full w-9 items-center justify-center text-[var(--color-charcoal-300)] hover:bg-[var(--color-raspberry)]/10 hover:text-[var(--color-raspberry)]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

function AnswerCell({ slug, row }: { slug: string; row: OnboardingRow }) {
  const [value, setValue] = useState(row.answer ?? "");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const empty = !row.answer || row.answer.trim().length === 0;

  return (
    <form
      action={updateOnboardingAnswer}
      className={`p-3 ${empty ? "bg-[var(--color-bee)]/10" : ""}`}
      onSubmit={() => setSavedAt(Date.now())}
    >
      <input type="hidden" name="workspaceSlug" value={slug} />
      <input type="hidden" name="responseId" value={row.id} />
      <textarea
        name="answer"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => {
          if (e.currentTarget.value !== (row.answer ?? "")) {
            (e.currentTarget.form as HTMLFormElement).requestSubmit();
          }
        }}
        rows={value.length > 80 ? 3 : 1}
        placeholder="Click to answer…"
        className="w-full resize-none border-0 bg-transparent text-xs text-[var(--color-charcoal)] outline-none placeholder:italic placeholder:text-[var(--color-muted-foreground)] focus:bg-white"
      />
      {savedAt ? (
        <span className="text-[10px] text-[var(--color-forest)]">Saved</span>
      ) : null}
    </form>
  );
}

/* ─── New question form ─────────────────────────────────────── */

function NewQuestionForm({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  return (
    <form
      action={addOnboardingQuestion}
      onSubmit={() => onClose()}
      className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-forest-300)] bg-[var(--color-forest-100)]/40 p-3"
    >
      <input type="hidden" name="workspaceSlug" value={slug} />
      <Input
        name="question"
        placeholder="What's your one-sentence value proposition?"
        required
        minLength={2}
        autoFocus
        className="flex-1"
      />
      <Button type="submit" variant="accent" size="sm">
        Add
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>
        Cancel
      </Button>
    </form>
  );
}

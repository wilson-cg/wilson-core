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
  fieldType:
    | "TEXT"
    | "LONGTEXT"
    | "URL"
    | "NUMBER"
    | "SINGLE_CHOICE"
    | "MULTI_CHOICE";
  options: string | null;
  minSelections: number | null;
  maxSelections: number | null;
  required: boolean;
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
            className="group flex w-full items-start gap-1.5 text-left text-xs font-medium text-[var(--color-charcoal)] hover:text-[var(--color-forest)]"
          >
            <span className="flex-1">
              {row.question}
              {row.required ? (
                <span className="ml-1 text-[var(--color-raspberry)]">*</span>
              ) : null}
            </span>
            <FieldTypeBadge type={row.fieldType} />
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

  // Choice questions are answered via the typeform — show read-only summary
  // (decoded for MULTI_CHOICE) so the spreadsheet stays scannable.
  if (row.fieldType === "SINGLE_CHOICE" || row.fieldType === "MULTI_CHOICE") {
    return (
      <div className={`p-3 ${empty ? "bg-[var(--color-bee)]/10" : ""}`}>
        {empty ? (
          <span className="text-xs italic text-[var(--color-muted-foreground)]">
            Awaiting answer via the share link
          </span>
        ) : (
          <ChoiceAnswerDisplay row={row} />
        )}
      </div>
    );
  }

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

function ChoiceAnswerDisplay({ row }: { row: OnboardingRow }) {
  if (row.fieldType === "SINGLE_CHOICE") {
    return (
      <span className="inline-flex rounded-full bg-[var(--color-lime)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-forest-950)]">
        {row.answer}
      </span>
    );
  }
  // MULTI_CHOICE — answer is a JSON array of strings
  let picks: string[] = [];
  try {
    picks = row.answer ? (JSON.parse(row.answer) as string[]) : [];
    if (!Array.isArray(picks)) picks = [];
  } catch {
    picks = [];
  }
  if (picks.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {picks.map((p) => (
        <span
          key={p}
          className="inline-flex rounded-full bg-[var(--color-forest-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-forest-900)]"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

function FieldTypeBadge({ type }: { type: OnboardingRow["fieldType"] }) {
  const label = {
    TEXT: "Text",
    LONGTEXT: "Long text",
    URL: "URL",
    NUMBER: "Number",
    SINGLE_CHOICE: "Single choice",
    MULTI_CHOICE: "Multi-choice",
  }[type];
  return (
    <span className="shrink-0 rounded-full bg-[var(--color-virgil-dark)] px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-[var(--color-charcoal-500)]">
      {label}
    </span>
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
  const [fieldType, setFieldType] = useState<
    "TEXT" | "LONGTEXT" | "URL" | "NUMBER" | "SINGLE_CHOICE" | "MULTI_CHOICE"
  >("LONGTEXT");
  const isChoice =
    fieldType === "SINGLE_CHOICE" || fieldType === "MULTI_CHOICE";
  const isMulti = fieldType === "MULTI_CHOICE";

  return (
    <form
      action={addOnboardingQuestion}
      onSubmit={() => onClose()}
      className="mb-4 space-y-3 rounded-[var(--radius-md)] border border-[var(--color-forest-300)] bg-[var(--color-forest-100)]/40 p-3"
    >
      <input type="hidden" name="workspaceSlug" value={slug} />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="question"
          placeholder="Pick your top traits you want to come through on LinkedIn."
          required
          minLength={2}
          autoFocus
          className="min-w-[16rem] flex-1"
        />
        <select
          name="fieldType"
          value={fieldType}
          onChange={(e) =>
            setFieldType(e.target.value as typeof fieldType)
          }
          className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 text-xs shadow-[var(--shadow-soft)]"
          title="Question type"
        >
          <option value="LONGTEXT">Long text</option>
          <option value="TEXT">Short text</option>
          <option value="URL">URL</option>
          <option value="NUMBER">Number</option>
          <option value="SINGLE_CHOICE">Single choice</option>
          <option value="MULTI_CHOICE">Multi-choice</option>
        </select>
        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-charcoal-500)]">
          <input
            type="checkbox"
            name="required"
            className="accent-[var(--color-forest)]"
          />
          Required
        </label>
      </div>

      {isChoice ? (
        <div className="space-y-2">
          <label className="block">
            <span className="block text-[11px] font-medium text-[var(--color-charcoal-500)]">
              Options{" "}
              <span className="text-[var(--color-muted-foreground)]">
                (one per line)
              </span>
            </span>
            <textarea
              name="options"
              rows={5}
              required
              placeholder={
                isMulti
                  ? "Direct\nOpinionated\nWarm\nFunny\nAuthoritative"
                  : "Fully comfortable, no limits\nMostly comfortable, selective\nComfortable with professional stories, not personal\nUncomfortable with personal content"
              }
              className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-xs shadow-[var(--shadow-soft)]"
            />
          </label>

          {isMulti ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-[var(--color-charcoal-500)]">
                  Minimum selections
                </span>
                <Input
                  type="number"
                  name="minSelections"
                  min={0}
                  defaultValue={3}
                  className="h-8 text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-[var(--color-charcoal-500)]">
                  Maximum selections
                </span>
                <Input
                  type="number"
                  name="maxSelections"
                  min={1}
                  defaultValue={5}
                  className="h-8 text-xs"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="accent" size="sm">
          Add question
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

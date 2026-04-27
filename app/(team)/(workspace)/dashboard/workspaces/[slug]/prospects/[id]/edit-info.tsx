"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, X, Check } from "lucide-react";
import { updateProspectInfo } from "@/lib/actions";

type Props = {
  prospectId: string;
  fullName: string;
  title: string | null;
  company: string;
  email: string | null;
  location: string | null;
  linkedinUrl: string;
  tags: string | null;
  fitScore: "STRONG" | "POSSIBLE" | "NOT_A_FIT";
  notes: string | null;
};

/** Edit-in-place form for the CRM info panel. Toggles between view & edit. */
export function EditInfoIsland(props: Props) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3 w-3" /> Edit
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lifted)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="app-heading text-lg text-[var(--color-forest)]">
            Edit prospect
          </h3>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-[var(--color-charcoal-300)] hover:text-[var(--color-charcoal)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          action={updateProspectInfo}
          className="space-y-3"
          onSubmit={() => setEditing(false)}
        >
          <input type="hidden" name="prospectId" value={props.prospectId} />

          <Field label="Full name" required>
            <Input name="fullName" defaultValue={props.fullName} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title">
              <Input name="title" defaultValue={props.title ?? ""} />
            </Field>
            <Field label="Company" required>
              <Input name="company" defaultValue={props.company} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input
                type="email"
                name="email"
                defaultValue={props.email ?? ""}
              />
            </Field>
            <Field label="Location">
              <Input name="location" defaultValue={props.location ?? ""} />
            </Field>
          </div>
          <Field label="LinkedIn URL">
            <Input
              type="url"
              name="linkedinUrl"
              defaultValue={props.linkedinUrl}
            />
          </Field>
          <Field label="Tags (comma separated)">
            <Input name="tags" defaultValue={props.tags ?? ""} />
          </Field>
          <Field label="ICP fit">
            <select
              name="fitScore"
              defaultValue={props.fitScore}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm shadow-[var(--shadow-soft)]"
            >
              <option value="STRONG">Strong fit</option>
              <option value="POSSIBLE">Possible fit</option>
              <option value="NOT_A_FIT">Not a fit</option>
            </select>
          </Field>
          <Field label="Internal notes">
            <textarea
              name="notes"
              rows={3}
              defaultValue={props.notes ?? ""}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
            />
          </Field>

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-4">
            <Button type="submit" variant="accent">
              <Check className="h-4 w-4" /> Save changes
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-[var(--color-charcoal-500)]">
        {label}
        {required ? (
          <span className="text-[var(--color-raspberry)]"> *</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

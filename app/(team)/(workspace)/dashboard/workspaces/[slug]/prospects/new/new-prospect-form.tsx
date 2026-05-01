"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2 } from "lucide-react";
import {
  addProspect,
  autofillProspectFromLinkedIn,
  type AutofillResult,
} from "@/lib/actions";

/**
 * New-prospect capture form. Required: full name, LinkedIn URL, signal type.
 * "Auto-fill from LinkedIn" calls Coresignal's Base Employee API and populates
 * name / title / company / location.
 */
export function NewProspectForm({ slug }: { slug: string }) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [autofillStatus, setAutofillStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function handleAutofill() {
    setAutofillStatus({ kind: "loading" });
    startTransition(async () => {
      const result: AutofillResult =
        await autofillProspectFromLinkedIn(linkedinUrl);
      if (!result.ok) {
        setAutofillStatus({ kind: "error", message: result.error });
        return;
      }
      const p = result.profile;
      if (p.fullName) setFullName(p.fullName);
      if (p.title) setTitle(p.title);
      if (p.company) setCompany(p.company);
      if (p.location) setLocation(p.location);
      setAutofillStatus({ kind: "ok" });
    });
  }

  const canAutofill = linkedinUrl.trim().length > 0 && !pending;

  return (
    <form action={addProspect} className="space-y-6">
      <input type="hidden" name="workspaceSlug" value={slug} />

      <Field label="LinkedIn URL" required>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            name="linkedinUrl"
            type="url"
            placeholder="https://linkedin.com/in/jane-doe"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            required
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canAutofill}
            onClick={handleAutofill}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {pending ? "Looking up…" : "Auto-fill from LinkedIn"}
          </Button>
        </div>
        {autofillStatus.kind === "ok" ? (
          <p className="text-[11px] text-[var(--color-forest)]">
            Found a profile. Review the fields below before saving.
          </p>
        ) : null}
        {autofillStatus.kind === "error" ? (
          <p className="text-[11px] text-[var(--color-raspberry)]">
            {autofillStatus.message}
          </p>
        ) : null}
      </Field>

      <Field label="Full name" required>
        <Input
          name="fullName"
          placeholder="Jane Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title">
          <Input
            name="title"
            placeholder="VP Operations"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Company">
          <Input
            name="company"
            placeholder="Helix Biosciences"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Location">
        <Input
          name="location"
          placeholder="London, UK"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </Field>

      <Field label="Signal type" required>
        <select
          name="signalType"
          required
          defaultValue=""
          className="flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm shadow-[var(--shadow-soft)]"
        >
          <option value="" disabled>
            Select…
          </option>
          <option value="REACTION">Reaction</option>
          <option value="COMMENT">Comment</option>
          <option value="CONNECTION_REQUEST">Connection request</option>
          <option value="POST">Post</option>
          <option value="REPEATED_ENGAGEMENT">Repeated engagement</option>
          <option value="CUSTOM">Custom</option>
        </select>
      </Field>

      <Field label="Post / engagement context">
        <textarea
          name="signalContext"
          rows={3}
          placeholder="Link to the post, quote of the comment, or one-line note about the engagement."
          className="flex w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
        />
      </Field>

      <Field label="Internal notes">
        <textarea
          name="notes"
          rows={3}
          placeholder="Anything the drafter should know. Internal only."
          className="flex w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
        />
      </Field>

      <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-6">
        <Button type="submit" variant="accent">
          Add prospect
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href={`/dashboard/workspaces/${slug}/prospects`}>Cancel</Link>
        </Button>
      </div>
    </form>
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
    <label className="block space-y-1.5">
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

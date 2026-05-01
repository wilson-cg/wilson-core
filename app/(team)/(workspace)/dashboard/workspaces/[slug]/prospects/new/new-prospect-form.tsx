"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addProspect } from "@/lib/actions";

/**
 * New-prospect capture form. Required: full name, LinkedIn URL, signal type.
 */
export function NewProspectForm({ slug }: { slug: string }) {
  const [linkedinUrl, setLinkedinUrl] = useState("");

  return (
    <form action={addProspect} className="space-y-6">
      <input type="hidden" name="workspaceSlug" value={slug} />

      <Field label="LinkedIn URL" required>
        <Input
          name="linkedinUrl"
          type="url"
          placeholder="https://linkedin.com/in/jane-doe"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          required
        />
      </Field>

      <Field label="Full name" required>
        <Input name="fullName" placeholder="Jane Doe" required />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title">
          <Input name="title" placeholder="VP Operations" />
        </Field>
        <Field label="Company">
          <Input name="company" placeholder="Helix Biosciences" />
        </Field>
      </div>

      <Field label="Location">
        <Input name="location" placeholder="London, UK" />
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

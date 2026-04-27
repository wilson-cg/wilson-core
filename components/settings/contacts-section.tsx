"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  X,
  Star,
  Trash2,
  ExternalLink,
  Mail,
  Check,
} from "lucide-react";
import {
  addClientContact,
  updateClientContact,
  removeClientContact,
  setPrimaryContact,
} from "@/lib/actions";

export type ContactRow = {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  isPrimary: boolean;
};

/**
 * Contacts list — multiple client contacts per workspace. Primary contact's
 * email is the default approval recipient (unless workspace.approvalEmail is
 * set explicitly).
 */
export function ContactsSection({
  slug,
  contacts,
}: {
  slug: string;
  contacts: ContactRow[];
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
      <header className="mb-5 flex items-baseline justify-between">
        <div>
          <h2 className="app-heading text-lg text-[var(--color-forest)]">
            Client contacts
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Everyone on the client side who should know what&apos;s happening.
            One contact is marked primary — they receive approval requests by
            default.
          </p>
        </div>
        {!addingNew ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddingNew(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Add contact
          </Button>
        ) : null}
      </header>

      {addingNew ? (
        <ContactForm
          slug={slug}
          mode="add"
          onClose={() => setAddingNew(false)}
        />
      ) : null}

      {contacts.length === 0 && !addingNew ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-virgil)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          No contacts yet. Add the primary client contact to get started.
        </div>
      ) : null}

      <ul className="space-y-2">
        {contacts.map((c) =>
          editingId === c.id ? (
            <li key={c.id}>
              <ContactForm
                slug={slug}
                mode="edit"
                contact={c}
                onClose={() => setEditingId(null)}
              />
            </li>
          ) : (
            <ContactRowView
              key={c.id}
              slug={slug}
              contact={c}
              onEdit={() => setEditingId(c.id)}
            />
          )
        )}
      </ul>
    </section>
  );
}

/* ─── Row view ──────────────────────────────────────────────── */

function ContactRowView({
  slug,
  contact,
  onEdit,
}: {
  slug: string;
  contact: ContactRow;
  onEdit: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-soft)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest)] text-sm font-semibold text-[var(--color-lime)]">
        {contact.fullName
          .split(" ")
          .map((s) => s[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-[var(--color-charcoal)]">
            {contact.fullName}
          </span>
          {contact.isPrimary ? <Badge variant="approved">Primary</Badge> : null}
        </div>
        <p className="truncate text-xs text-[var(--color-muted-foreground)]">
          {contact.title ?? "—"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="inline-flex items-center gap-1 text-[var(--color-forest)] hover:underline"
            >
              <Mail className="h-3 w-3" /> {contact.email}
            </a>
          ) : (
            <span className="italic text-[var(--color-muted-foreground)]">
              no email
            </span>
          )}
          {contact.linkedinUrl ? (
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--color-forest)] hover:underline"
            >
              LinkedIn <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!contact.isPrimary ? (
          <form action={setPrimaryContact}>
            <input type="hidden" name="workspaceSlug" value={slug} />
            <input type="hidden" name="contactId" value={contact.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              title="Make primary"
            >
              <Star className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <form action={removeClientContact}>
          <input type="hidden" name="workspaceSlug" value={slug} />
          <input type="hidden" name="contactId" value={contact.id} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            title="Remove"
            className="text-[var(--color-raspberry)] hover:bg-[var(--color-raspberry)]/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </li>
  );
}

/* ─── Form (add or edit) ─────────────────────────────────────── */

function ContactForm({
  slug,
  mode,
  contact,
  onClose,
}: {
  slug: string;
  mode: "add" | "edit";
  contact?: ContactRow;
  onClose: () => void;
}) {
  return (
    <form
      action={mode === "add" ? addClientContact : updateClientContact}
      onSubmit={() => onClose()}
      className="mb-3 grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-forest-300)] bg-[var(--color-forest-100)]/40 p-4 md:grid-cols-2"
    >
      <input type="hidden" name="workspaceSlug" value={slug} />
      {mode === "edit" && contact ? (
        <input type="hidden" name="contactId" value={contact.id} />
      ) : null}

      <Field label="Full name" required>
        <Input
          name="fullName"
          defaultValue={contact?.fullName ?? ""}
          required
        />
      </Field>
      <Field label="Title">
        <Input name="title" defaultValue={contact?.title ?? ""} />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          name="email"
          defaultValue={contact?.email ?? ""}
        />
      </Field>
      <Field label="LinkedIn URL">
        <Input
          type="url"
          name="linkedinUrl"
          defaultValue={contact?.linkedinUrl ?? ""}
        />
      </Field>

      <div className="md:col-span-2 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
        <Button type="submit" variant="accent" size="sm">
          <Check className="h-3.5 w-3.5" />
          {mode === "add" ? "Add contact" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          <X className="h-3.5 w-3.5" /> Cancel
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
    <label className="space-y-1">
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

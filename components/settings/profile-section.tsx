import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceLogo } from "./workspace-logo";
import { updateWorkspaceProfile } from "@/lib/actions";

/**
 * Profile section — displays current logo + form for the workspace's
 * top-level branding fields (name, business name, logo URL, LinkedIn,
 * approval email, accent color).
 *
 * Submits to updateWorkspaceProfile server action.
 */
export function ProfileSection({
  slug,
  name,
  businessName,
  logoUrl,
  linkedinUrl,
  approvalEmail,
  accentColor,
}: {
  slug: string;
  name: string;
  businessName: string | null;
  logoUrl: string | null;
  linkedinUrl: string | null;
  approvalEmail: string | null;
  accentColor: string | null;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
      <header className="mb-5">
        <h2 className="app-heading text-lg text-[var(--color-forest)]">
          Profile
        </h2>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          What this workspace looks and feels like across the portal.
        </p>
      </header>

      <div className="mb-5 flex items-center gap-4">
        <WorkspaceLogo
          name={name}
          logoUrl={logoUrl}
          accentColor={accentColor}
          size="lg"
        />
        <div className="text-xs text-[var(--color-muted-foreground)]">
          Logo previews here. Paste a URL below — supports https links and
          data: URLs (SVG / base64 PNG up to ~200 KB).
        </div>
      </div>

      <form action={updateWorkspaceProfile} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="workspaceSlug" value={slug} />

        <Field label="Display name" required>
          <Input name="name" defaultValue={name} required />
        </Field>
        <Field label="Legal business name">
          <Input
            name="businessName"
            defaultValue={businessName ?? ""}
            placeholder={`${name} Limited`}
          />
        </Field>
        <Field label="Logo URL" hint="https://… or data:image/svg+xml,…">
          <Input
            name="logoUrl"
            defaultValue={logoUrl ?? ""}
            placeholder="https://example.com/logo.png"
          />
        </Field>
        <Field label="Company LinkedIn">
          <Input
            type="url"
            name="linkedinUrl"
            defaultValue={linkedinUrl ?? ""}
            placeholder="https://linkedin.com/company/…"
          />
        </Field>
        <Field
          label="Approval email"
          hint="Where approval notifications get routed. Defaults to primary contact."
        >
          <Input
            type="email"
            name="approvalEmail"
            defaultValue={approvalEmail ?? ""}
            placeholder="approvals@company.com"
          />
        </Field>
        <Field label="Accent colour" hint="Used on the workspace avatar tile.">
          <Input
            name="accentColor"
            defaultValue={accentColor ?? ""}
            placeholder="#17614F"
            pattern="^#[0-9A-Fa-f]{6}$"
          />
        </Field>

        <div className="md:col-span-2 flex items-center gap-2 border-t border-[var(--color-border)] pt-4">
          <Button type="submit" variant="accent" size="sm">
            Save profile
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
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
      {hint ? (
        <span className="block text-[10px] text-[var(--color-muted-foreground)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

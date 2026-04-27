import { notFound } from "next/navigation";
import { requireRole, requireWorkspace } from "@/lib/auth";
import { workspaceSettings } from "@/lib/queries";
import { ProfileSection } from "@/components/settings/profile-section";
import { ContactsSection } from "@/components/settings/contacts-section";
import { OnboardingSection } from "@/components/settings/onboarding-section";

/**
 * Team-side workspace settings. Hosts the same three sections the client
 * sees, with the workspace sidebar/chrome from the (workspace) route group.
 */
export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireRole("ADMIN", "TEAM_MEMBER");
  const { slug } = await params;
  const { workspace } = await requireWorkspace(slug);
  const data = await workspaceSettings(workspace.id);
  if (!data.workspace) notFound();

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] px-8 py-5">
        <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Workspace settings
        </p>
        <h1 className="app-heading mt-0.5 text-2xl text-[var(--color-charcoal)]">
          {data.workspace.name}
        </h1>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-8 py-8">
        <ProfileSection
          slug={slug}
          name={data.workspace.name}
          businessName={data.workspace.businessName}
          logoUrl={data.workspace.logoUrl}
          linkedinUrl={data.workspace.linkedinUrl}
          approvalEmail={data.workspace.approvalEmail}
          accentColor={data.workspace.accentColor}
        />

        <ContactsSection slug={slug} contacts={data.contacts} />

        <OnboardingSection
          slug={slug}
          rows={data.onboarding}
          onboardingToken={data.workspace.onboardingToken}
        />
      </div>
    </div>
  );
}

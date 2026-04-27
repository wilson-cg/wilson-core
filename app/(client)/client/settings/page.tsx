import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { workspaceSettings } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { ProfileSection } from "@/components/settings/profile-section";
import { ContactsSection } from "@/components/settings/contacts-section";
import { OnboardingSection } from "@/components/settings/onboarding-section";

/**
 * Client-side settings — same three sections the team sees, scoped to the
 * client's own workspace. Lives at /client/settings (not nested under a
 * workspace slug because the client only has one).
 */
export default async function ClientSettingsPage() {
  const user = await requireRole("CLIENT");
  const membership = user.memberships[0];
  if (!membership) redirect("/client/dashboard");

  const workspace = await prisma.workspace.findUnique({
    where: { id: membership.workspaceId },
  });
  if (!workspace) redirect("/client/dashboard");

  const data = await workspaceSettings(workspace.id);
  if (!data.workspace) redirect("/client/dashboard");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <header className="mb-2">
        <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Settings
        </p>
        <h1 className="app-heading mt-0.5 text-2xl text-[var(--color-charcoal)]">
          {data.workspace.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Update your profile, contacts, and onboarding answers. Your
          Wilson&apos;s team sees these changes immediately.
        </p>
      </header>

      <ProfileSection
        slug={data.workspace.slug}
        name={data.workspace.name}
        businessName={data.workspace.businessName}
        logoUrl={data.workspace.logoUrl}
        linkedinUrl={data.workspace.linkedinUrl}
        approvalEmail={data.workspace.approvalEmail}
        accentColor={data.workspace.accentColor}
      />

      <ContactsSection slug={data.workspace.slug} contacts={data.contacts} />

      <OnboardingSection
        slug={data.workspace.slug}
        rows={data.onboarding}
        onboardingToken={data.workspace.onboardingToken}
      />
    </div>
  );
}

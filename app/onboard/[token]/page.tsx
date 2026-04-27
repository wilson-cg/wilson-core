import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TypeformOnboarding } from "./typeform-onboarding";

/**
 * Public token-scoped onboarding. The token unlocks exactly one workspace's
 * questionnaire. No auth required — the team shares the URL with the client
 * and the client fills it in. Each answer is saved to the workspace's
 * OnboardingResponse rows, scoped strictly by token on every write.
 */
export default async function PublicOnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { onboardingToken: token },
    include: {
      onboarding: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!workspace) notFound();

  return (
    <TypeformOnboarding
      token={token}
      workspaceName={workspace.name}
      logoUrl={workspace.logoUrl}
      accentColor={workspace.accentColor}
      questions={workspace.onboarding.map((q) => ({
        id: q.id,
        question: q.question,
        answer: q.answer ?? "",
        fieldType: q.fieldType,
        options: q.options ? q.options.split("|") : null,
        minSelections: q.minSelections,
        maxSelections: q.maxSelections,
        required: q.required,
      }))}
    />
  );
}

export const dynamic = "force-dynamic";

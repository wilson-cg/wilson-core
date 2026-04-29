import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { prisma } from "@/lib/db";
import { InviteAcceptForm } from "./invite-accept-form";

export const dynamic = "force-dynamic";

/**
 * Public invite landing. Token-scoped — anyone with the link can land here,
 * but only emails matching the invite row will be admitted by signIn().
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { workspace: true, invitedBy: true },
  });

  const expired =
    !invite ||
    invite.acceptedAt !== null ||
    invite.expiresAt.getTime() < Date.now();

  return (
    <main className="min-h-screen bg-grid-forest">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-12">
        <Link
          href="/"
          className="mb-10 inline-flex items-center"
          aria-label="Wilson's home"
        >
          <Wordmark tone="virgil" className="h-9" />
        </Link>

        <div className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
          {expired ? (
            <ExpiredState />
          ) : (
            <ActiveState
              email={invite.email}
              systemRole={invite.systemRole}
              workspaceName={invite.workspace?.name ?? null}
              inviterName={invite.invitedBy.name}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function ExpiredState() {
  return (
    <>
      <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
        Invite
      </p>
      <h1 className="app-heading mt-1 text-2xl text-[var(--color-forest)]">
        This invite has expired
      </h1>
      <p className="mt-3 text-sm text-[var(--color-charcoal-300)]">
        The link is no longer valid — it&rsquo;s either been used already or
        expired. Ask your Wilson&rsquo;s contact to send you a fresh invite.
      </p>
      <div className="mt-6">
        <Link
          href="/login"
          className="inline-flex items-center text-sm font-medium text-[var(--color-forest)] underline-offset-2 hover:underline"
        >
          Already signed up? Sign in →
        </Link>
      </div>
    </>
  );
}

function ActiveState(props: {
  email: string;
  systemRole: string;
  workspaceName: string | null;
  inviterName: string | null;
}) {
  const { email, systemRole, workspaceName, inviterName } = props;

  const audience =
    systemRole === "CLIENT" && workspaceName
      ? `the ${workspaceName} workspace`
      : systemRole === "ADMIN"
        ? "Wilson's as an admin"
        : "the Wilson's team";

  return (
    <>
      <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
        You&rsquo;re invited
      </p>
      <h1 className="app-heading mt-1 text-2xl text-[var(--color-forest)]">
        Welcome to Wilson&rsquo;s
      </h1>
      <p className="mt-3 text-sm text-[var(--color-charcoal-300)]">
        {inviterName ? `${inviterName} invited you` : "You&rsquo;ve been invited"}{" "}
        to {audience}. Continue with the email below to receive your sign-in
        link.
      </p>

      <div className="mt-6">
        <InviteAcceptForm email={email} />
      </div>
    </>
  );
}

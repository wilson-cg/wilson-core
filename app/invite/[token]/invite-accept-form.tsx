"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { sendMagicLink } from "@/app/(auth)/login/actions";

type State = { error?: string };

async function submit(_prev: State, formData: FormData): Promise<State> {
  try {
    await sendMagicLink(formData);
    return {};
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export function InviteAcceptForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<State, FormData>(submit, {});

  return (
    <form action={action} className="space-y-3" noValidate>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-[var(--color-charcoal)]">
          Your email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          defaultValue={email}
          readOnly
          className="block w-full cursor-not-allowed rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-virgil-dark)]/50 px-3 py-2.5 text-sm text-[var(--color-charcoal)] outline-none"
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] border border-[var(--color-raspberry)]/30 bg-[var(--color-raspberry)]/5 px-3 py-2 text-xs text-[var(--color-raspberry)]"
        >
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Sending link…" : "Continue to sign in"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}

function isNextRedirect(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

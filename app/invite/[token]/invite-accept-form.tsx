"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import {
  sendMagicLink,
  type SendMagicLinkState,
} from "@/app/(auth)/login/actions";

const INITIAL: SendMagicLinkState = { ok: null };

export function InviteAcceptForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<
    SendMagicLinkState,
    FormData
  >(sendMagicLink, INITIAL);

  const errorMessage =
    state.ok === false && state.error ? state.error : null;

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

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] border border-[var(--color-raspberry)]/30 bg-[var(--color-raspberry)]/5 px-3 py-2 text-xs text-[var(--color-raspberry)]"
        >
          {errorMessage}
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

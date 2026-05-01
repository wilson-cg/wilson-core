"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { sendMagicLink, type SendMagicLinkState } from "./actions";

const INITIAL: SendMagicLinkState = { ok: null };

export function LoginForm() {
  const [state, action, pending] = useActionState<
    SendMagicLinkState,
    FormData
  >(sendMagicLink, INITIAL);

  const errorMessage =
    state.ok === false && state.error ? state.error : null;

  return (
    <form action={action} className="mt-8 space-y-3" noValidate>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-[var(--color-charcoal)]">
          Work email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@company.com"
          className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm shadow-[var(--shadow-soft)] outline-none transition-colors focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20"
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
        {pending ? "Sending link…" : "Send sign-in link"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}

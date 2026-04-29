"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { sendMagicLink } from "./actions";

type State = { error?: string };

async function submit(_prev: State, formData: FormData): Promise<State> {
  try {
    await sendMagicLink(formData);
    return {};
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return {
      error: e instanceof Error ? e.message : "Something went wrong.",
    };
  }
}

export function LoginForm() {
  const [state, action, pending] = useActionState<State, FormData>(submit, {});

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
        {pending ? "Sending link…" : "Send sign-in link"}
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

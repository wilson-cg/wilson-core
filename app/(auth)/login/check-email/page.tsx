import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Mail } from "lucide-react";

export default function CheckEmailPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* ── Left: confirmation ── */}
      <div className="flex items-center justify-center px-8 py-16 lg:px-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="inline-flex items-center">
            <Wordmark tone="forest" className="h-10" />
          </Link>

          <div className="mt-12 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-forest)]/10 text-[var(--color-forest)]">
            <Mail className="h-5 w-5" />
          </div>

          <h1 className="app-heading mt-6 text-3xl text-[var(--color-forest)]">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            We&rsquo;ve sent a sign-in link to your email. Click the button in
            the email to finish signing in. The link expires in 24 hours.
          </p>

          <div className="mt-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-virgil-dark)]/40 px-4 py-3 text-xs text-[var(--color-charcoal-300)]">
            Didn&rsquo;t get the email? Check your spam folder, or{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--color-forest)] underline-offset-2 hover:underline"
            >
              try again
            </Link>
            .
          </div>
        </div>
      </div>

      {/* ── Right: brand panel ── */}
      <div className="relative hidden overflow-hidden bg-grid-forest lg:block">
        <div className="pointer-events-none absolute -bottom-20 -right-16 select-none opacity-[0.06]">
          <span
            className="display-italic text-[26rem] leading-none text-[var(--color-virgil)]"
            aria-hidden
          >
            W
          </span>
        </div>
        <div className="relative flex h-full flex-col justify-between p-16">
          <Wordmark tone="virgil" className="h-8" />
          <div>
            <p className="font-display text-5xl leading-[1.1] text-[var(--color-virgil)]">
              Connecting{" "}
              <span className="display-italic">you</span>{" "}
              with{" "}
              <span className="display-italic">your</span>{" "}
              perfect{" "}
              <span className="display-italic">buyer.</span>
            </p>
            <p className="mt-8 max-w-md text-sm text-[var(--color-virgil)]/70">
              Wilson&apos;s is the operations platform for leaders at the
              world&apos;s most influential companies.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

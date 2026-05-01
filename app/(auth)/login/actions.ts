"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";

const emailSchema = z.email({ message: "Enter a valid email address." });

export type SendMagicLinkState =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: null }; // initial state

/**
 * Send a magic-link sign-in email via Auth.js + Resend.
 *
 * Returns a discriminated state shape so React's useActionState can
 * read the result without surfacing internal NEXT_REDIRECT errors as
 * "An error occurred in the Server Components render". On success we
 * redirect server-side to the verifyRequest page; the redirect throws
 * a NEXT_REDIRECT which is the documented Next.js way to handle this.
 *
 * IMPORTANT: we pass `redirect: false` to signIn so it does NOT throw
 * its own redirect — we own the redirect flow here.
 */
export async function sendMagicLink(
  _prev: SendMagicLinkState,
  formData: FormData
): Promise<SendMagicLinkState> {
  const raw = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid email.",
    };
  }

  try {
    // redirect: false → signIn does NOT throw NEXT_REDIRECT. It returns
    // (or returns void) once the verification request has been sent.
    await signIn("resend", {
      email: parsed.data,
      redirect: false,
    });
  } catch (e) {
    // signIn() may still throw a redirect for the error path (e.g. the
    // signIn callback returned false). Let that bubble through to Next.
    if (isNextRedirect(e)) throw e;
    const msg =
      e instanceof Error ? e.message : "Could not send the sign-in link.";
    return { ok: false, error: msg };
  }

  // Success: redirect to the check-your-email page. redirect() throws a
  // NEXT_REDIRECT which Next.js handles internally — the form action
  // returns ok before this throws when called from a useActionState
  // context, but in practice we want the redirect to win.
  redirect("/login/check-email");
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

function isNextRedirect(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

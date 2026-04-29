"use server";

import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";

const emailSchema = z.email({ message: "Enter a valid email address." });

/**
 * Send a magic-link sign-in email via Auth.js + Resend.
 *
 * On success Auth.js redirects to /login/check-email (configured via
 * pages.verifyRequest in lib/auth.ts). On error we throw a friendly
 * message; the form catches it via React's useActionState and shows it.
 */
export async function sendMagicLink(formData: FormData): Promise<void> {
  const raw = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid email.");
  }

  // signIn() throws a Next redirect error (NEXT_REDIRECT) on the success
  // path — that's how Auth.js triggers the verifyRequest page redirect.
  // Let the redirect bubble; only intercept *real* errors.
  try {
    await signIn("resend", {
      email: parsed.data,
      redirectTo: "/dashboard",
    });
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    const msg =
      e instanceof Error ? e.message : "Could not send the sign-in link.";
    throw new Error(msg);
  }
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

function isNextRedirect(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

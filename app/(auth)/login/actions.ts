"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clearSession, setSession } from "@/lib/auth";

/** Stress-test login — pick any seeded user by id. */
export async function loginAs(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  await setSession(user.id);
  redirect(user.role === "CLIENT" ? "/client/dashboard" : "/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

/**
 * Wilson's Portal V1 wipe + reseed (2026-04-30 client meeting pivot).
 *
 * 1. Wipe everything in dependency order EXCEPT the two ADMIN accounts:
 *      - marketing@wilson-cg.com
 *      - stan@wilson-cg.com
 * 2. Wipe the rest of the User table.
 * 3. Create 3 fresh workspaces — Joe / Graham / Richard — with the default
 *    onboarding questions, an ADMIN membership for each preserved admin,
 *    and a placeholder ClientContact.
 * 4. Do NOT seed any prospects, messages, or posts (clean pipelines for
 *    the live demo).
 *
 * Run with `npm run db:seed-v2`. Prints the DATABASE_URL host before any
 * destructive op so the operator can confirm against production.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_ONBOARDING_QUESTIONS } from "../lib/default-onboarding";

const PRESERVED_ADMINS = [
  "marketing@wilson-cg.com",
  "stan@wilson-cg.com",
] as const;

const WORKSPACES = [
  {
    name: "Joe",
    slug: "joe",
    contactName: "Joe",
    contactEmail: "joe@example.com",
  },
  {
    name: "Graham",
    slug: "graham",
    contactName: "Graham",
    contactEmail: "graham@example.com",
  },
  {
    name: "Richard",
    slug: "richard",
    contactName: "Richard",
    contactEmail: "richard@example.com",
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set. Export DATABASE_URL or use --env-file.");
    process.exit(1);
  }
  const host = url.match(/@([^/]+)/)?.[1] ?? "(unknown)";
  console.log(`▶ DATABASE_URL host: ${host}`);
  console.log("▶ Preserving ADMIN users:", PRESERVED_ADMINS.join(", "));

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  // 1) Look up the preserved admin user ids — we want to keep these rows.
  const keepers = await prisma.user.findMany({
    where: { email: { in: [...PRESERVED_ADMINS] } },
    select: { id: true, email: true },
  });
  console.log(
    `▶ Found ${keepers.length} preserved admin user row(s):`,
    keepers.map((k) => `${k.email} (${k.id})`).join(", ") || "(none)"
  );
  const keeperIds = keepers.map((k) => k.id);

  // 2) Wipe in dependency order. Cascade-delete relations are mostly handled
  //    by the schema, but explicit deletes are safer + clearer.
  console.log("▶ Wiping data tables…");
  await prisma.$transaction(async (tx) => {
    await tx.prospectEvent.deleteMany({});
    await tx.messageEvent.deleteMany({});
    await tx.postEvent.deleteMany({});
    await tx.message.deleteMany({});
    await tx.postMedia.deleteMany({});
    await tx.post.deleteMany({});
    await tx.prospect.deleteMany({});
    await tx.notification.deleteMany({});
    await tx.onboardingResponse.deleteMany({});
    await tx.clientContact.deleteMany({});
    await tx.icp.deleteMany({});
    await tx.inviteWorkspaceAccess.deleteMany({});
    await tx.invite.deleteMany({});
    await tx.membership.deleteMany({});
    await tx.workspace.deleteMany({});
    await tx.account.deleteMany({});
    await tx.session.deleteMany({});
    await tx.verificationToken.deleteMany({});
    // 3) Wipe non-preserved users.
    await tx.user.deleteMany({
      where: { id: { notIn: keeperIds.length > 0 ? keeperIds : ["__none__"] } },
    });
  });

  // 4) Make sure both preserved admins exist (create if missing).
  console.log("▶ Ensuring preserved admin users exist…");
  for (const email of PRESERVED_ADMINS) {
    await prisma.user.upsert({
      where: { email },
      create: { email, role: "ADMIN", name: email.split("@")[0] },
      update: { role: "ADMIN" },
    });
  }
  const admins = await prisma.user.findMany({
    where: { email: { in: [...PRESERVED_ADMINS] } },
    select: { id: true, email: true },
  });

  // 5) Create the 3 workspaces with default onboarding + ADMIN memberships.
  console.log("▶ Creating workspaces: Joe, Graham, Richard…");
  for (const w of WORKSPACES) {
    const workspace = await prisma.workspace.create({
      data: {
        name: w.name,
        slug: w.slug,
        contactName: w.contactName,
        contacts: {
          create: {
            fullName: w.contactName,
            email: w.contactEmail,
            isPrimary: true,
          },
        },
        onboarding: {
          create: DEFAULT_ONBOARDING_QUESTIONS.map((q, i) => ({
            question: q.question,
            fieldType: q.fieldType,
            options: q.options ? q.options.join("|") : null,
            minSelections: q.minSelections ?? null,
            maxSelections: q.maxSelections ?? null,
            required: q.required ?? false,
            orderIndex: i,
          })),
        },
        memberships: {
          create: admins.map((a) => ({
            userId: a.id,
            role: "ADMIN" as const,
          })),
        },
      },
    });
    console.log(`  · ${workspace.slug} (${workspace.id})`);
  }

  console.log("✓ Wipe + reseed complete.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("✗ seed-v2 failed:", err);
  process.exit(1);
});

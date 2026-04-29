import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Resend } from "resend";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run db:bootstrap-admin <email>");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Run with --env-file=.env or export it.");
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });
const resend = process.env.AUTH_RESEND_KEY ? new Resend(process.env.AUTH_RESEND_KEY) : null;
const APP_URL = process.env.AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
const TTL_DAYS = 7;

async function main() {
  const lower = email.toLowerCase();

  // Find or create a "system" inviter user — use the first existing ADMIN if any,
  // otherwise create a placeholder system user that owns the bootstrap invite.
  let inviter = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!inviter) {
    inviter = await prisma.user.upsert({
      where: { email: "system+bootstrap@wilsons.local" },
      update: {},
      create: {
        email: "system+bootstrap@wilsons.local",
        name: "System (bootstrap)",
        role: "ADMIN",
      },
    });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86400_000);

  const invite = await prisma.invite.create({
    data: {
      email: lower,
      token,
      systemRole: "ADMIN",
      invitedById: inviter.id,
      expiresAt,
    },
  });

  const url = `${APP_URL}/invite/${token}`;
  console.log(`\n\u2713 Bootstrap admin invite created for ${lower}`);
  console.log(`  Expires: ${expiresAt.toISOString()}`);
  console.log(`  URL:     ${url}\n`);

  if (resend && process.env.AUTH_EMAIL_FROM) {
    try {
      await resend.emails.send({
        from: process.env.AUTH_EMAIL_FROM,
        to: lower,
        subject: "Bootstrap admin invite \u2014 Wilson's",
        html: `<p>You've been invited as the first ADMIN. <a href="${url}">Accept here</a>. Expires in 7 days.</p>`,
      });
      console.log(`  \u2713 Email sent via Resend`);
    } catch (e) {
      console.warn(`  ! Email send failed:`, (e as Error).message);
      console.warn(`    The invite URL above still works.`);
    }
  } else {
    console.log(`  (No AUTH_RESEND_KEY set \u2014 email NOT sent. Use the URL above.)`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

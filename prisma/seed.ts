/**
 * Seed the Wilson's Client Portal stress-test DB.
 *
 * Creates:
 *   - 2 Wilson's agency users (Admin + Team Member)
 *   - 3 client workspaces (Condor Group, Clearlake Group, Rook)
 *   - 3 client users (one per workspace)
 *   - Memberships wiring everyone up
 *   - ICPs per workspace
 *   - ~15 prospects per workspace, mixed statuses
 *   - Messages in every status (DRAFT, PENDING_APPROVAL, APPROVED, REJECTED,
 *     SENT, REPLIED) so every UI surface has real data to render
 *
 * Idempotent — wipes and re-creates every run.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_ONBOARDING_QUESTIONS } from "../lib/default-onboarding";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. export DATABASE_URL=… or use a .env file.");
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000);

async function main() {
  console.log("🧹 Wiping existing data…");
  // Delete in order that respects FKs
  await db.notification.deleteMany();
  await db.postEvent.deleteMany();
  await db.post.deleteMany();
  await db.prospectEvent.deleteMany();
  await db.messageEvent.deleteMany();
  await db.message.deleteMany();
  await db.prospect.deleteMany();
  await db.icp.deleteMany();
  await db.onboardingResponse.deleteMany();
  await db.clientContact.deleteMany();
  await db.membership.deleteMany();
  await db.workspace.deleteMany();
  await db.user.deleteMany();

  console.log("👥 Creating users…");

  // Wilson's staff
  const max = await db.user.create({
    data: {
      email: "max@wilsons.com",
      name: "Max Gowing",
      role: "ADMIN",
    },
  });

  const sarah = await db.user.create({
    data: {
      email: "sarah@wilsons.com",
      name: "Sarah Chen",
      role: "TEAM_MEMBER",
    },
  });

  // Client users
  const stan = await db.user.create({
    data: {
      email: "stan@condor.com",
      name: "Stan Williams",
      role: "CLIENT",
    },
  });

  const james = await db.user.create({
    data: {
      email: "james@clearlake.com",
      name: "James Watt",
      role: "CLIENT",
    },
  });

  const hexemer = await db.user.create({
    data: {
      email: "max@rook.com",
      name: "Max Hexemer",
      role: "CLIENT",
    },
  });

  console.log("🏢 Creating workspaces…");

  const condor = await db.workspace.create({
    data: {
      name: "Condor Group",
      slug: "condor",
      businessName: "Condor Group Limited",
      contactName: "Stan Williams",
      accentColor: "#17614F",
      logoUrl: makeLogoDataUrl("C", "#17614F", "#CAF530"),
      linkedinUrl: "https://linkedin.com/company/condor-group",
      approvalEmail: "stan@condor.com",
      onboardingToken: makeToken(),
      icp: {
        create: {
          summary:
            "B2B SaaS COOs and VPs of Operations at companies with 200-2000 employees. Mid-market, post-Series B, scaling ops function from firefighting to strategic.",
          toneOfVoice:
            "Direct, warm, operator-to-operator. No corporate speak. Reference their specific post or project.",
          mustNotDo:
            "salesy opener, 'hope this finds you well', mentioning 'leveraging', mentioning 'synergy'",
        },
      },
    },
  });

  const clearlake = await db.workspace.create({
    data: {
      name: "Clearlake Group",
      slug: "clearlake",
      businessName: "Clearlake Capital Partners",
      contactName: "James Watt",
      accentColor: "#1C2D22",
      logoUrl: makeLogoDataUrl("C", "#1C2D22", "#FAD85A"),
      linkedinUrl: "https://linkedin.com/company/clearlake-group",
      approvalEmail: "approvals@clearlake.com",
      onboardingToken: makeToken(),
      icp: {
        create: {
          summary:
            "Founders and CEOs at portfolio-scale B2B companies ($5M-$50M ARR). Typically raising or recently raised Series A/B.",
          toneOfVoice:
            "Founder-to-founder, peer energy. Reference their thesis or recent round.",
          mustNotDo: "generic compliments, vague 'love what you're doing'",
        },
      },
    },
  });

  const rook = await db.workspace.create({
    data: {
      name: "Rook",
      slug: "rook",
      businessName: "Rook Brand Co.",
      contactName: "Max Hexemer",
      accentColor: "#EB595C",
      logoUrl: makeLogoDataUrl("R", "#EB595C", "#F9F5EE"),
      linkedinUrl: "https://linkedin.com/company/rook-brand",
      approvalEmail: "max@rook.com",
      onboardingToken: makeToken(),
      icp: {
        create: {
          summary:
            "Heads of Brand and CMOs at DTC brands $10M-$100M revenue. Usually owner-operators or close to them.",
          toneOfVoice:
            "Creative, slightly playful. Show you've actually looked at their brand.",
          mustNotDo: "growth-hack language, 'scale' as a verb, quoting follower counts",
        },
      },
    },
  });

  console.log("👤 Creating client contacts…");
  await seedContacts(condor.id, [
    {
      fullName: "Stan Williams",
      title: "Founder & CEO",
      email: "stan@condor.com",
      linkedinUrl: "https://linkedin.com/in/stan-williams",
      isPrimary: true,
    },
    {
      fullName: "Priya Iyer",
      title: "Executive Assistant to Stan",
      email: "priya@condor.com",
      linkedinUrl: null,
      isPrimary: false,
    },
  ]);
  await seedContacts(clearlake.id, [
    {
      fullName: "James Watt",
      title: "Managing Partner",
      email: "james@clearlake.com",
      linkedinUrl: "https://linkedin.com/in/james-watt",
      isPrimary: true,
    },
    {
      fullName: "Hana Cole",
      title: "Chief of Staff",
      email: "hana@clearlake.com",
      linkedinUrl: "https://linkedin.com/in/hana-cole",
      isPrimary: false,
    },
    {
      fullName: "Robert Quinn",
      title: "General Partner",
      email: "rob@clearlake.com",
      linkedinUrl: null,
      isPrimary: false,
    },
  ]);
  await seedContacts(rook.id, [
    {
      fullName: "Max Hexemer",
      title: "Founder",
      email: "max@rook.com",
      linkedinUrl: "https://linkedin.com/in/max-hexemer",
      isPrimary: true,
    },
  ]);

  console.log("🎓 Creating onboarding questionnaires…");
  // Each workspace gets the canonical 10-question set. Sample answers
  // demonstrate the "completed" state for some questions. Indexed by the
  // question's position in DEFAULT_ONBOARDING_QUESTIONS (0-based).
  await seedOnboarding(condor.id, {
    0: "We help mid-market B2B SaaS leaders turn ops from firefighting into the engine that scales the business.",
    1: "Currently working with Helix Biosciences (rebuilt their ops onboarding), Northbridge Capital (pipeline reporting), and Fulcrum Systems (ops org redesign).",
    2: "B2B SaaS COOs and VP-Ops at 200–2000 employees, post-Series B, scaling ops function from firefighting to strategic.",
    3: "\"We're spending too much time fixing the same problems and not enough time stopping them happening.\"",
    4: "Hired a generalist ops manager who couldn't handle the systems work. Tried tooling-led fixes (Asana, ClickUp) that papered over the org problem.",
    5: "1) Designing cross-functional ops orgs that don't break at scale. 2) Translating CFO/CEO ops asks into shippable systems. 3) Hiring + comp for ops leaders.",
    6: "Ops people should report to the CEO, not the COO. Most companies get this wrong by burying ops two layers deep.",
    7: "1) When do I hire my first ops person? 2) What's the difference between a COO and a Head of Ops? 3) How do I measure ops productivity? 4) Should ops own customer success?",
    8: JSON.stringify(["Direct", "Operator-led", "Educational", "Authoritative"]),
    9: "Mostly comfortable, selective",
  });
  await seedOnboarding(clearlake.id, {
    0: "Series A capital and a real partner who's been in the founder seat. We back B2B SaaS founders post-PMF, $1-3M ARR.",
    1: "Recent investments: Ansible Bio (lead Series A), Orchard OS (participated). Earlier: Stagecoach, Halevine, Northpoint.",
    2: "Founders raising Series A in B2B vertical SaaS, $1-3M ARR, 6-12 months from product-market fit signal.",
    3: "\"I need a partner who's actually been in this seat, not someone who'll add me to a 50-portfolio mailing list.\"",
    4: "Tier-1 funds that gave them money but no time. Or angels who couldn't help with hiring + go-to-market.",
    5: "1) Founder vetting under uncertainty. 2) The 12-month pre-Series-B operating cadence. 3) Hiring the first VP Sales.",
    6: null,
    7: "1) How do you decide between two co-founders' visions? 2) When is the right time to raise Series B? 3) What's your portfolio support model?",
    8: JSON.stringify(["Direct", "Authoritative", "Personal"]),
    9: "Mostly comfortable, selective",
  });
  await seedOnboarding(rook.id, {
    0: null,
    1: "Maison Brook (rebrand), Otterwood (campaign refresh), Common Thread (positioning).",
    2: "DTC brand founders / CMOs at $10-100M revenue, owner-operators or close to them, brand-first not growth-hack.",
    3: null,
    4: null,
    5: "1) Category design and positioning. 2) Voice + copy systems for DTC. 3) Knowing when to spend on brand vs performance.",
    6: "Most DTC brands optimize their funnel before they have a brand worth optimizing. The bucket has a leak at the top.",
    7: null,
    8: JSON.stringify(["Creative", "Playful", "Personal", "Direct"]),
    9: "Fully comfortable, no limits",
  });

  console.log("🔗 Creating memberships…");

  // Admin (Max) has access to everything
  await db.membership.createMany({
    data: [
      { userId: max.id, workspaceId: condor.id, role: "ADMIN" },
      { userId: max.id, workspaceId: clearlake.id, role: "ADMIN" },
      { userId: max.id, workspaceId: rook.id, role: "ADMIN" },
    ],
  });

  // Sarah (team member) assigned to Condor + Clearlake
  await db.membership.createMany({
    data: [
      { userId: sarah.id, workspaceId: condor.id, role: "TEAM_MEMBER" },
      { userId: sarah.id, workspaceId: clearlake.id, role: "TEAM_MEMBER" },
    ],
  });

  // Clients each on their own workspace
  await db.membership.create({
    data: { userId: stan.id, workspaceId: condor.id, role: "CLIENT" },
  });
  await db.membership.create({
    data: { userId: james.id, workspaceId: clearlake.id, role: "CLIENT" },
  });
  await db.membership.create({
    data: { userId: hexemer.id, workspaceId: rook.id, role: "CLIENT" },
  });

  console.log("🎯 Creating prospects + messages…");

  // ─── CONDOR GROUP ─────────────────────────────────────────────
  // Pipeline spread: draft, pending (x3), approved (x2), sent (x5), replied (x2), meeting (x1), identified (x2)

  await seedProspect(condor.id, max.id, stan.id, {
    name: "Jane Doe",
    company: "Helix Biosciences",
    title: "VP Operations",
    fit: "STRONG",
    status: "REPLIED",
    message: {
      body: "Hi Jane, I came across your piece on turning ops from a cost-centre into a growth function — hit a nerve for me because we're doing the same work at Condor right now. Would love to swap notes.",
      status: "REPLIED",
      approvedDaysAgo: 3,
      sentDaysAgo: 2,
      repliedHoursAgo: 4,
    },
  });

  await seedProspect(condor.id, max.id, stan.id, {
    name: "Marcus Reid",
    company: "Northbridge Capital",
    title: "Founder",
    fit: "STRONG",
    status: "REPLIED",
    message: {
      body: "Marcus — saw your recent thread on pipeline transparency. We built the Condor reporting layer for exactly that reason. 30 mins next week?",
      status: "REPLIED",
      approvedDaysAgo: 4,
      sentDaysAgo: 3,
      repliedHoursAgo: 20,
    },
  });

  await seedProspect(condor.id, max.id, stan.id, {
    name: "Priya Shah",
    company: "Fulcrum Systems",
    title: "COO",
    fit: "STRONG",
    status: "MEETING_BOOKED",
    message: {
      body: "Priya, noticed you're expanding the Fulcrum ops team rapidly — congrats. Happy to share what's worked for us at Condor if useful.",
      status: "REPLIED",
      approvedDaysAgo: 7,
      sentDaysAgo: 6,
      repliedHoursAgo: 96,
    },
  });

  await seedProspect(condor.id, max.id, stan.id, {
    name: "Tomás Alvarez",
    company: "Wavecrest",
    title: "VP Operations",
    fit: "POSSIBLE",
    status: "SENT",
    message: {
      body: "Tomás — your ops retrospective at SaaStr stuck with me. We're landing at similar conclusions from a different angle at Condor.",
      status: "SENT",
      approvedDaysAgo: 2,
      sentDaysAgo: 1,
    },
  });

  await seedProspect(condor.id, sarah.id, stan.id, {
    name: "Evelyn Park",
    company: "Meridian Labs",
    title: "COO",
    fit: "STRONG",
    status: "SENT",
    message: {
      body: "Evelyn, your thread on async-first ops was the most honest take I've read this year. Want to compare notes on the hiring side?",
      status: "SENT",
      approvedDaysAgo: 2,
      sentDaysAgo: 1,
    },
  });

  await seedProspect(condor.id, sarah.id, stan.id, {
    name: "Liam Osei",
    company: "Topo Insights",
    title: "Head of Ops",
    fit: "POSSIBLE",
    status: "SENT",
    message: {
      body: "Liam — the Topo approach to forecasting ops has been on my list for months. Would love a short call.",
      status: "SENT",
      approvedDaysAgo: 3,
      sentDaysAgo: 2,
    },
  });

  await seedProspect(condor.id, sarah.id, stan.id, {
    name: "Nina Laurent",
    company: "Bluecrest AI",
    title: "Head of Operations",
    fit: "STRONG",
    status: "SENT",
    message: {
      body: "Nina, Bluecrest's ops post-Series B is the closest thing to what we're doing at Condor. Would a 20-minute swap be useful?",
      status: "SENT",
      approvedDaysAgo: 5,
      sentDaysAgo: 4,
    },
  });

  await seedProspect(condor.id, sarah.id, stan.id, {
    name: "Robert Chen",
    company: "Dayline",
    title: "COO",
    fit: "STRONG",
    status: "SENT",
    message: {
      body: "Robert, your talk on ops comp structures was unusually specific for the genre. We've been grappling with similar questions at Condor.",
      status: "SENT",
      approvedDaysAgo: 6,
      sentDaysAgo: 5,
    },
  });

  // Approved, not yet sent
  await seedProspect(condor.id, max.id, stan.id, {
    name: "Dahlia Okonkwo",
    company: "Primer Health",
    title: "VP Ops",
    fit: "STRONG",
    status: "APPROVED",
    message: {
      body: "Dahlia, your piece on ops-as-a-growth-function at Primer mapped almost exactly to what we're shipping at Condor next quarter. Would a 25-min swap make sense?",
      status: "APPROVED",
      approvedDaysAgo: 0,
    },
  });

  await seedProspect(condor.id, sarah.id, stan.id, {
    name: "Felix Iwata",
    company: "Rootstack",
    title: "Head of Ops",
    fit: "POSSIBLE",
    status: "APPROVED",
    message: {
      body: "Felix — Rootstack's transparency around operational headcount is admirable. We're thinking through similar disclosures at Condor.",
      status: "APPROVED",
      approvedDaysAgo: 0,
    },
  });

  // Pending approval (the 7 drafts waiting 2 days in the dashboard hero)
  const pendingCondorNames = [
    { name: "Grace Adebayo", company: "Kettle", title: "COO" },
    { name: "Hugo Rinaldi", company: "Lodestar Bio", title: "VP Ops" },
    { name: "Aisha Mohamed", company: "Finchpath", title: "Head of Ops" },
    { name: "Diego Ruiz", company: "Sable Labs", title: "Director of Ops" },
    { name: "Petra Svensson", company: "Mapview", title: "COO" },
    { name: "Kai Nakamura", company: "Harbor Cloud", title: "VP Operations" },
    { name: "Isla Fernandez", company: "Meldwork", title: "Head of Ops" },
  ];

  for (const p of pendingCondorNames) {
    await seedProspect(condor.id, sarah.id, stan.id, {
      name: p.name,
      company: p.company,
      title: p.title,
      fit: "STRONG",
      status: "PENDING_APPROVAL",
      message: {
        body: `Hi ${p.name.split(" ")[0]}, I've been tracking ${p.company}'s work in ops for a while — your recent post on team structure made me want to reach out. I run Condor Group and we've been navigating similar questions. Would love 20 minutes to compare notes.`,
        status: "PENDING_APPROVAL",
        submittedDaysAgo: 2,
      },
    });
  }

  // Pure drafts (team working on them)
  for (const p of [
    { name: "Yusuf Karim", company: "Prism Cloud", title: "VP Ops" },
    { name: "Clara Hensley", company: "Outpath", title: "Head of Ops" },
  ]) {
    await seedProspect(condor.id, sarah.id, stan.id, {
      name: p.name,
      company: p.company,
      title: p.title,
      fit: "POSSIBLE",
      status: "MESSAGE_DRAFTED",
      message: {
        body: `Hi ${p.name.split(" ")[0]}, [draft in progress — referencing their recent post about scaling ops]`,
        status: "DRAFT",
      },
    });
  }

  // Identified, no message yet
  for (const p of [
    { name: "Eitan Mizrahi", company: "Axis Research", title: "COO" },
    { name: "Freya Lindqvist", company: "Trellishouse", title: "Head of Operations" },
  ]) {
    await seedProspect(condor.id, sarah.id, stan.id, {
      name: p.name,
      company: p.company,
      title: p.title,
      fit: "POSSIBLE",
      status: "IDENTIFIED",
    });
  }

  // ─── CLEARLAKE GROUP ─────────────────────────────────────────
  // James Watt — founders at portfolio companies. Includes a REJECTED to show rejection flow.

  await seedProspect(clearlake.id, max.id, james.id, {
    name: "Emma Lindqvist",
    company: "Riverline",
    title: "Founder & CEO",
    fit: "STRONG",
    status: "MESSAGE_DRAFTED",
    message: {
      body: "Emma, love what Riverline is doing post-Series A. Would be great to grab 20 minutes — your thesis overlaps ours in interesting ways.",
      status: "REJECTED",
      submittedDaysAgo: 1,
      rejectedHoursAgo: 18,
      rejectionNote: "Too generic. Reference her actual YC demo day pitch, not 'thesis overlaps'.",
    },
  });

  await seedProspect(clearlake.id, max.id, james.id, {
    name: "David Oyelowo",
    company: "Pivotline",
    title: "Founder",
    fit: "POSSIBLE",
    status: "MESSAGE_DRAFTED",
    message: {
      body: "David — Pivotline's recent round is impressive. Would love to connect.",
      status: "REJECTED",
      submittedDaysAgo: 1,
      rejectedHoursAgo: 18,
      rejectionNote: "Way too short. Bring the actual hook.",
    },
  });

  // Pending approval — the 4 on the dashboard
  for (const p of [
    { name: "Isabel Moreno", company: "Halevine", title: "Co-founder & CEO" },
    { name: "Oscar Feldman", company: "Stagecoach", title: "Founder" },
    { name: "Léa Dubois", company: "Northpoint", title: "CEO" },
    { name: "Rahul Mehta", company: "Basebeam", title: "Founder & CEO" },
  ]) {
    await seedProspect(clearlake.id, sarah.id, james.id, {
      name: p.name,
      company: p.company,
      title: p.title,
      fit: "STRONG",
      status: "PENDING_APPROVAL",
      message: {
        body: `${p.name.split(" ")[0]} — your Series A thesis at ${p.company} sits right next to what James is backing at Clearlake. Worth a 20-minute conversation?`,
        status: "PENDING_APPROVAL",
        submittedDaysAgo: 1,
      },
    });
  }

  await seedProspect(clearlake.id, max.id, james.id, {
    name: "Andreas Novak",
    company: "Orchard OS",
    title: "Founder",
    fit: "STRONG",
    status: "SENT",
    message: {
      body: "Andreas, Orchard OS's land-and-expand motion is the cleanest I've seen this year. Would you be up for a 25-minute call?",
      status: "SENT",
      approvedDaysAgo: 4,
      sentDaysAgo: 3,
    },
  });

  await seedProspect(clearlake.id, max.id, james.id, {
    name: "Maya Patel",
    company: "Paperlake",
    title: "Co-founder",
    fit: "POSSIBLE",
    status: "SENT",
    message: {
      body: "Maya — Paperlake's pivot write-up was more candid than anything I've read lately. Happy to trade notes from Clearlake's side.",
      status: "SENT",
      approvedDaysAgo: 5,
      sentDaysAgo: 4,
    },
  });

  await seedProspect(clearlake.id, max.id, james.id, {
    name: "Theo Richter",
    company: "Ansible Bio",
    title: "Founder & CEO",
    fit: "STRONG",
    status: "REPLIED",
    message: {
      body: "Theo, Ansible's approach to scientific rigour at early-stage is exactly what Clearlake is looking to back more of. Quick call?",
      status: "REPLIED",
      approvedDaysAgo: 10,
      sentDaysAgo: 9,
      repliedHoursAgo: 72,
    },
  });

  // Identified
  for (const p of [
    { name: "Noémie Blanc", company: "Glasscurve", title: "CEO" },
    { name: "Vikram Soni", company: "Foundry Nine", title: "Founder" },
  ]) {
    await seedProspect(clearlake.id, sarah.id, james.id, {
      name: p.name,
      company: p.company,
      title: p.title,
      fit: "POSSIBLE",
      status: "IDENTIFIED",
    });
  }

  // ─── ROOK ─────────────────────────────────────────────────────

  for (const p of [
    { name: "Sophia Delacroix", company: "Maison Brook", title: "Head of Brand" },
  ]) {
    await seedProspect(rook.id, max.id, hexemer.id, {
      name: p.name,
      company: p.company,
      title: p.title,
      fit: "STRONG",
      status: "PENDING_APPROVAL",
      message: {
        body: `Sophia — the ${p.company} holiday drop was the first DTC campaign I've shown friends in months. Rook is working in a similar register. Would love a 20.`,
        status: "PENDING_APPROVAL",
        submittedDaysAgo: 1,
      },
    });
  }

  for (const p of [
    { name: "Elena Rossi", company: "Otterwood", title: "CMO" },
    { name: "Jamal Carter", company: "Common Thread", title: "Head of Brand" },
    { name: "Maggie O'Neill", company: "Rivet & Rye", title: "CMO" },
  ]) {
    await seedProspect(rook.id, max.id, hexemer.id, {
      name: p.name,
      company: p.company,
      title: p.title,
      fit: "STRONG",
      status: "SENT",
      message: {
        body: `${p.name.split(" ")[0]} — ${p.company}'s last launch hit the rare balance between taste and conversion. We'd love to talk shop.`,
        status: "SENT",
        approvedDaysAgo: 3,
        sentDaysAgo: 2,
      },
    });
  }

  await seedProspect(rook.id, max.id, hexemer.id, {
    name: "Nadia Okafor",
    company: "Goldengrove",
    title: "Brand Director",
    fit: "STRONG",
    status: "REPLIED",
    message: {
      body: "Nadia — Goldengrove's editorial work has been a reference point for Rook for a year. Would a 30-minute conversation make sense?",
      status: "REPLIED",
      approvedDaysAgo: 5,
      sentDaysAgo: 4,
      repliedHoursAgo: 30,
    },
  });

  // Identified
  for (const p of [
    { name: "Lucas Meijer", company: "Paperboat", title: "Head of Brand" },
    { name: "Simone Laurent", company: "Moss & Oak", title: "CMO" },
    { name: "Ari Goldstein", company: "Fieldhouse", title: "Head of Marketing" },
  ]) {
    await seedProspect(rook.id, max.id, hexemer.id, {
      name: p.name,
      company: p.company,
      title: p.title,
      fit: "POSSIBLE",
      status: "IDENTIFIED",
    });
  }

  console.log("📝 Creating posts…");

  // ─── CONDOR posts ────────────────────────────────────────────
  await seedPost(condor.id, max.id, stan.id, stan.email, {
    title: "Ops is not a cost centre — post #1",
    body: `A CFO asked me last week: "what's your ops team actually worth?"\n\nI didn't have a clean answer. So we built one.\n\nOver the past quarter we tracked every hour the ops team saved other functions. Sales won 23 hours back on pipeline hygiene. Finance closed 2 days earlier on the monthly. Product shipped one full extra cycle.\n\nOps isn't overhead. It's the function that makes every other function 15% better. If your CFO doesn't see it that way, your reporting is the problem — not your ops team.`,
    status: "POSTED",
    submittedDaysAgo: 5,
    approvedDaysAgo: 5,
    postedDaysAgo: 4,
  });

  await seedPost(condor.id, max.id, stan.id, stan.email, {
    title: "Hiring ops people from finance",
    body: `Our best ops hire last year came from a Big Four audit team.\n\nCounterintuitive? Not really. Finance people already think in systems, controls, and accuracy. The 'operator' instinct — what should happen, what can break, how do we measure it — is exactly what finance does every day.\n\nIf you're struggling to find ops candidates, stop looking for "operators." Look for finance managers who are tired of being reactive and want to build something.`,
    status: "APPROVED",
    submittedDaysAgo: 1,
    approvedHoursAgo: 6,
  });

  await seedPost(condor.id, sarah.id, stan.id, stan.email, {
    title: "Pipeline transparency",
    body: `Most ops teams hide pipeline data from sales. "They'll game it."\n\nThat's a trust problem, not a data problem.\n\nWe made every single ops dashboard visible to every salesperson at Condor two quarters ago. Conversion rate went UP, not down. Because once sales could see the bottleneck in real time, they stopped arguing with us about it — and started fixing the inputs.`,
    status: "PENDING_APPROVAL",
    submittedDaysAgo: 2,
    notify: true,
  });

  await seedPost(condor.id, sarah.id, stan.id, stan.email, {
    title: "Monday comp structure thoughts",
    body: `[Draft — riffing on a few angles about ops team comp. Need to pick one before submitting.]\n\nAngle 1: base+bonus hybrid\nAngle 2: pure salary with long vesting\nAngle 3: why RSUs don't work for ops`,
    status: "DRAFT",
  });

  await seedPost(condor.id, max.id, stan.id, stan.email, {
    title: "Async-first ops",
    body: `We killed our weekly ops sync last month. No more 9am Monday 60-minute meeting.\n\nReplaced it with a shared Notion doc that gets updated by 8am every Monday. 10 minutes of async reading, 15 minutes of threaded questions, the whole team moves on with their day by 9.\n\nOps doesn't need meetings. Ops needs clear writing.`,
    status: "REJECTED",
    submittedDaysAgo: 3,
    rejectedDaysAgo: 2,
    rejectionNote: "Feels a bit too absolute. Some ops teams DO need syncs. Can we add a 'when to still run one' caveat?",
  });

  // ─── CLEARLAKE posts ─────────────────────────────────────────
  await seedPost(clearlake.id, max.id, james.id, james.email, {
    title: "What I underwrite vs what I back",
    body: `Clearest lesson from 6 years of early-stage investing:\n\nThe metrics I underwrite are not the reasons a company wins.\n\nI underwrite: TAM, team, traction, thesis.\nCompanies win on: founder judgment under uncertainty, speed of learning loops, and a frankly irrational level of conviction.\n\nThe first three are measurable. The last three aren't. And the last three are everything.`,
    status: "POSTED",
    submittedDaysAgo: 7,
    approvedDaysAgo: 7,
    postedDaysAgo: 6,
  });

  await seedPost(clearlake.id, sarah.id, james.id, james.email, {
    title: "Founder mental models I invest behind",
    body: `A founder DM'd me last week: "what's the #1 thing you look for?"\n\nHonest answer: how they talk about their customers when they don't think I'm evaluating.\n\nThe ones who describe specific customer behavior in specific language — that's the signal. The ones who describe customers in market-map abstractions are usually one step removed from the actual problem. Good pitch deck, mediocre investment.`,
    status: "PENDING_APPROVAL",
    submittedDaysAgo: 1,
    notify: true,
  });

  await seedPost(clearlake.id, max.id, james.id, james.email, {
    title: "Series A writeups",
    body: `Public post on our approach to Series A diligence at Clearlake — the 90-minute call, the 5-question memo, the 3-person partner review. Aim: make the whole process visible to founders so they know exactly what's happening on our side.`,
    status: "APPROVED",
    submittedDaysAgo: 1,
    approvedHoursAgo: 20,
  });

  // ─── ROOK posts ──────────────────────────────────────────────
  await seedPost(rook.id, max.id, hexemer.id, hexemer.email, {
    title: "Brand first, funnel second",
    body: `Every DTC founder I talk to wants to optimize their funnel before they've built a brand.\n\nThis is backwards. An optimized funnel on a weak brand is a leaky bucket with the leak at the top.\n\nSpend the first $250k of paid on brand research and testing, not on ROAS. Your CAC will thank you in 18 months.`,
    status: "POSTED",
    submittedDaysAgo: 10,
    approvedDaysAgo: 10,
    postedDaysAgo: 9,
  });

  await seedPost(rook.id, max.id, hexemer.id, hexemer.email, {
    title: "The copywriting test",
    body: `If I could only interview a brand hire with one question, it would be this: "Show me a product description you wrote that made someone cry laugh and also buy the product."\n\nBecause great brand copy does all three. If they can only do one, they're a decent copywriter, not a brand person.`,
    status: "PENDING_APPROVAL",
    submittedDaysAgo: 1,
    notify: true,
  });

  await seedPost(rook.id, max.id, hexemer.id, hexemer.email, {
    title: "Draft: category design vs category entry",
    body: `[Thinking through this one — about when to position as 'best in category' vs 'we're making a new category'. Needs structure.]`,
    status: "DRAFT",
  });

  // ─── Realistic depth — features only show when data exists ──
  console.log("🧵 Adding follow-up message threads…");
  await seedFollowUpThreads(condor.id, sarah.id, stan.id);
  await seedClearlakeFollowUpThreads(clearlake.id, max.id, james.id);

  console.log("📞 Adding manual activity events…");
  await seedActivityVariety(condor.id, sarah.id);
  await seedActivityVariety(clearlake.id, max.id);

  console.log("📨 Adding varied notifications…");
  await seedNotificationVariety(condor.id, "stan@condor.com");
  await seedNotificationVariety(clearlake.id, "approvals@clearlake.com");
  await seedNotificationVariety(rook.id, "max@rook.com");

  const counts = {
    users: await db.user.count(),
    workspaces: await db.workspace.count(),
    contacts: await db.clientContact.count(),
    onboarding: await db.onboardingResponse.count(),
    prospects: await db.prospect.count(),
    prospectEvents: await db.prospectEvent.count(),
    messages: await db.message.count(),
    messageEvents: await db.messageEvent.count(),
    posts: await db.post.count(),
    postEvents: await db.postEvent.count(),
    notifications: await db.notification.count(),
  };

  console.log("✅ Seed complete:");
  console.table(counts);

  console.log("\nTest accounts:");
  console.log("  Admin:        max@wilsons.com");
  console.log("  Team member:  sarah@wilsons.com");
  console.log("  Client (Condor):    stan@condor.com");
  console.log("  Client (Clearlake): james@clearlake.com");
  console.log("  Client (Rook):      max@rook.com");
}

// ─── Prospect + message helper ────────────────────────────────────

type SeedProspectInput = {
  name: string;
  company: string;
  title?: string;
  fit: "STRONG" | "POSSIBLE" | "NOT_A_FIT";
  status:
    | "IDENTIFIED"
    | "MESSAGE_DRAFTED"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "SENT"
    | "REPLIED"
    | "MEETING_BOOKED"
    | "NOT_INTERESTED"
    | "NURTURE";
  message?: {
    body: string;
    status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SENT" | "REPLIED";
    submittedDaysAgo?: number;
    approvedDaysAgo?: number;
    sentDaysAgo?: number;
    repliedHoursAgo?: number;
    rejectedHoursAgo?: number;
    rejectionNote?: string;
  };
};

async function seedProspect(
  workspaceId: string,
  drafterId: string,
  clientId: string,
  input: SeedProspectInput
) {
  // Deterministic pseudo-randomness so the seed output is stable
  const hash = hashCode(input.name);
  const locations = ["London, UK", "New York, NY", "San Francisco, CA", "Berlin, DE", "Singapore", "Austin, TX", "Toronto, ON", "Lisbon, PT"];
  const tagPool = ["warm-intro", "ic-event-speaker", "thought-leader", "recent-round", "past-portfolio", "referred", "cold", "2024-target", "priority", "skeptical"];
  const location = locations[hash % locations.length];
  const tagCount = 1 + (hash % 3);
  const tags = Array.from({ length: tagCount }, (_, i) => tagPool[(hash + i * 7) % tagPool.length]).join(", ");

  // Most prospects we've been engaging with have a LinkedIn connection already
  const connectionOffsetDays = (hash % 60) + 7; // 7–66 days ago
  const addedOffsetDays = Math.max((hash % 20) + 2, connectionOffsetDays - 30);

  const emailHandle = input.name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, ".");
  const companyDomain = input.company
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);

  const prospect = await db.prospect.create({
    data: {
      workspaceId,
      assigneeId: drafterId,
      fullName: input.name,
      company: input.company,
      title: input.title,
      linkedinUrl: `https://linkedin.com/in/${input.name.toLowerCase().replace(/[^a-z]/g, "-")}`,
      email: `${emailHandle}@${companyDomain}.com`,
      location,
      tags,
      fitScore: input.fit,
      status: input.status,
      linkedinConnectedAt: daysAgo(connectionOffsetDays),
      lastContactedAt: input.message?.sentDaysAgo !== undefined
        ? daysAgo(input.message.sentDaysAgo)
        : null,
      createdAt: daysAgo(addedOffsetDays),
    },
  });

  // Base prospect events: added + LinkedIn connection request/accepted
  await db.prospectEvent.create({
    data: {
      prospectId: prospect.id,
      workspaceId,
      actorId: drafterId,
      eventType: "ADDED",
      note: `Added to ${input.company} prospects (${humanFit(input.fit)})`,
      occurredAt: daysAgo(addedOffsetDays),
    },
  });
  await db.prospectEvent.create({
    data: {
      prospectId: prospect.id,
      workspaceId,
      actorId: drafterId,
      eventType: "LINKEDIN_CONNECTION_SENT",
      note: null,
      occurredAt: daysAgo(connectionOffsetDays + 2),
    },
  });
  await db.prospectEvent.create({
    data: {
      prospectId: prospect.id,
      workspaceId,
      actorId: drafterId,
      eventType: "LINKEDIN_CONNECTION_ACCEPTED",
      note: null,
      occurredAt: daysAgo(connectionOffsetDays),
    },
  });

  if (!input.message) return;

  const m = input.message;
  const data: Record<string, unknown> = {
    workspaceId,
    prospectId: prospect.id,
    drafterId,
    body: m.body,
    status: m.status,
  };

  if (m.approvedDaysAgo !== undefined) {
    data.approverId = clientId;
    data.approvedAt = daysAgo(m.approvedDaysAgo);
  }
  if (m.sentDaysAgo !== undefined) {
    data.senderId = drafterId;
    data.sentAt = daysAgo(m.sentDaysAgo);
  }
  if (m.repliedHoursAgo !== undefined) {
    data.repliedAt = hoursAgo(m.repliedHoursAgo);
  }
  if (m.rejectionNote) {
    data.rejectionNote = m.rejectionNote;
    data.approverId = clientId;
    data.approvedAt = hoursAgo(m.rejectedHoursAgo ?? 24);
  }

  const message = await db.message.create({ data: data as never });

  // Minimal event trail
  const events: { type: string; date: Date }[] = [
    { type: "DRAFTED", date: m.submittedDaysAgo ? daysAgo(m.submittedDaysAgo + 1) : daysAgo(1) },
  ];
  if (m.status !== "DRAFT") {
    events.push({
      type: "SUBMITTED_FOR_APPROVAL",
      date: daysAgo(m.submittedDaysAgo ?? m.approvedDaysAgo ?? 1),
    });
  }
  if (m.approvedDaysAgo !== undefined && m.status !== "REJECTED") {
    events.push({ type: "APPROVED", date: daysAgo(m.approvedDaysAgo) });
  }
  if (m.status === "REJECTED") {
    events.push({ type: "REJECTED", date: hoursAgo(m.rejectedHoursAgo ?? 24) });
  }
  if (m.sentDaysAgo !== undefined) {
    events.push({ type: "SENT", date: daysAgo(m.sentDaysAgo) });
  }
  if (m.repliedHoursAgo !== undefined) {
    events.push({ type: "REPLIED", date: hoursAgo(m.repliedHoursAgo) });
  }

  for (const e of events) {
    await db.messageEvent.create({
      data: {
        messageId: message.id,
        workspaceId,
        actorId: drafterId,
        eventType: e.type as never,
        createdAt: e.date,
      },
    });
  }
}

/* ─── Post seed helper ───────────────────────────────────────── */

type SeedPostInput = {
  title?: string;
  body: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "POSTED";
  submittedDaysAgo?: number;
  approvedDaysAgo?: number;
  approvedHoursAgo?: number;
  rejectedDaysAgo?: number;
  postedDaysAgo?: number;
  rejectionNote?: string;
  notify?: boolean;
};

async function seedPost(
  workspaceId: string,
  drafterId: string,
  clientId: string,
  clientEmail: string,
  input: SeedPostInput
) {
  const data: Record<string, unknown> = {
    workspaceId,
    drafterId,
    title: input.title,
    body: input.body,
    status: input.status,
  };

  if (input.approvedDaysAgo !== undefined) {
    data.approverId = clientId;
    data.approvedAt = daysAgo(input.approvedDaysAgo);
  } else if (input.approvedHoursAgo !== undefined) {
    data.approverId = clientId;
    data.approvedAt = hoursAgo(input.approvedHoursAgo);
  }
  if (input.rejectedDaysAgo !== undefined) {
    data.approverId = clientId;
    data.approvedAt = daysAgo(input.rejectedDaysAgo);
    data.rejectionNote = input.rejectionNote;
  }
  if (input.postedDaysAgo !== undefined) {
    data.posterId = drafterId;
    data.postedAt = daysAgo(input.postedDaysAgo);
  }

  const post = await db.post.create({ data: data as never });

  const events: { type: string; date: Date }[] = [
    { type: "DRAFTED", date: daysAgo((input.submittedDaysAgo ?? 1) + 1) },
  ];
  if (input.status !== "DRAFT") {
    events.push({
      type: "SUBMITTED_FOR_APPROVAL",
      date: daysAgo(input.submittedDaysAgo ?? 1),
    });
  }
  if (input.approvedDaysAgo !== undefined) {
    events.push({ type: "APPROVED", date: daysAgo(input.approvedDaysAgo) });
  }
  if (input.approvedHoursAgo !== undefined) {
    events.push({ type: "APPROVED", date: hoursAgo(input.approvedHoursAgo) });
  }
  if (input.rejectedDaysAgo !== undefined) {
    events.push({ type: "REJECTED", date: daysAgo(input.rejectedDaysAgo) });
  }
  if (input.postedDaysAgo !== undefined) {
    events.push({ type: "POSTED", date: daysAgo(input.postedDaysAgo) });
  }

  for (const e of events) {
    await db.postEvent.create({
      data: {
        postId: post.id,
        workspaceId,
        actorId: drafterId,
        eventType: e.type as never,
        createdAt: e.date,
      },
    });
  }

  if (input.notify) {
    await db.notification.create({
      data: {
        workspaceId,
        channel: "EMAIL",
        recipient: clientEmail,
        subject: `New post ready for approval — ${input.title ?? "Untitled"}`,
        body: `Your Wilson's team has drafted a new post for your review. Open the portal to approve, edit, or reject with notes.`,
        relatedType: "post",
        relatedId: post.id,
        status: "QUEUED",
        createdAt: daysAgo(input.submittedDaysAgo ?? 1),
      },
    });
  }
}

/* ─── Logo helper ────────────────────────────────────────────── */

function makeLogoDataUrl(letter: string, bg: string, fg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="${bg}"/><text x="50%" y="58%" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="56" font-weight="600" fill="${fg}" text-anchor="middle" dominant-baseline="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeToken(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

/* ─── Contact + onboarding helpers ───────────────────────────── */

type ContactSeed = {
  fullName: string;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  isPrimary: boolean;
};

async function seedContacts(workspaceId: string, contacts: ContactSeed[]) {
  for (const c of contacts) {
    await db.clientContact.create({
      data: {
        workspaceId,
        fullName: c.fullName,
        title: c.title ?? undefined,
        email: c.email ?? undefined,
        linkedinUrl: c.linkedinUrl ?? undefined,
        isPrimary: c.isPrimary,
      },
    });
  }
}

async function seedOnboarding(
  workspaceId: string,
  answersByIndex: Record<number, string | null>
) {
  // Use the same default question set as createClient so every workspace
  // (seeded or freshly created) starts with the same canonical questions.
  for (let i = 0; i < DEFAULT_ONBOARDING_QUESTIONS.length; i++) {
    const q = DEFAULT_ONBOARDING_QUESTIONS[i];
    const answer = answersByIndex[i] ?? null;
    await db.onboardingResponse.create({
      data: {
        workspaceId,
        question: q.question,
        answer: answer ?? undefined,
        fieldType: q.fieldType,
        options: q.options ? q.options.join("|") : undefined,
        minSelections: q.minSelections ?? undefined,
        maxSelections: q.maxSelections ?? undefined,
        required: q.required ?? false,
        orderIndex: i,
      },
    });
  }
}

/* ─── Realistic depth helpers ────────────────────────────────
 *
 * These run after the basic seed and add the kind of data that exposes
 * every UI surface: prospects with multi-message threads, manual activity
 * events outside the LinkedIn auto-generated ones, and notifications
 * spread across channel + status combinations.
 */

async function seedFollowUpThreads(
  workspaceId: string,
  drafterId: string,
  clientId: string
) {
  // Find 3 Condor prospects that already have a settled message and add
  // chronologically-correct follow-up threads on top.

  // 1. Marcus Reid (REPLIED) — opener replied, follow-up sent, awaiting reply
  const marcus = await db.prospect.findFirst({
    where: { workspaceId, fullName: "Marcus Reid" },
  });
  if (marcus) {
    const followUp = await db.message.create({
      data: {
        workspaceId,
        prospectId: marcus.id,
        drafterId,
        body: "Marcus — quick follow-up on my note last week. The thread you just posted on pipeline transparency lines up almost exactly with what we built at Condor. Genuinely curious to hear how you're thinking about the messy middle. 20 mins?",
        status: "SENT",
        approverId: clientId,
        approvedAt: daysAgo(2),
        senderId: drafterId,
        sentAt: daysAgo(1),
      },
    });
    for (const ev of [
      { type: "DRAFTED", date: daysAgo(3) },
      { type: "SUBMITTED_FOR_APPROVAL", date: daysAgo(2) },
      { type: "APPROVED", date: daysAgo(2) },
      { type: "SENT", date: daysAgo(1) },
    ]) {
      await db.messageEvent.create({
        data: {
          messageId: followUp.id,
          workspaceId,
          actorId: drafterId,
          eventType: ev.type as never,
          createdAt: ev.date,
        },
      });
    }
  }

  // 2. Priya Shah (MEETING_BOOKED) — opener replied, met, post-meeting touch in DRAFT
  const priya = await db.prospect.findFirst({
    where: { workspaceId, fullName: "Priya Shah" },
  });
  if (priya) {
    const postMeeting = await db.message.create({
      data: {
        workspaceId,
        prospectId: priya.id,
        drafterId,
        body: "Priya, great call last week — really enjoyed your perspective on the ops org chart. Sharing the two case studies you asked about. Happy to set up a follow-up with the team if useful.",
        status: "DRAFT",
      },
    });
    await db.messageEvent.create({
      data: {
        messageId: postMeeting.id,
        workspaceId,
        actorId: drafterId,
        eventType: "DRAFTED",
        createdAt: hoursAgo(20),
      },
    });
  }

  // 3. Evelyn Park (SENT) — opener pending reply, but already a draft of a follow-up nudge
  const evelyn = await db.prospect.findFirst({
    where: { workspaceId, fullName: "Evelyn Park" },
  });
  if (evelyn) {
    const nudge = await db.message.create({
      data: {
        workspaceId,
        prospectId: evelyn.id,
        drafterId,
        body: "Evelyn, no pressure on the earlier note — wanted to share one more data point that might be relevant to the async-ops piece. Happy to send the link if useful.",
        status: "PENDING_APPROVAL",
      },
    });
    for (const ev of [
      { type: "DRAFTED", date: daysAgo(2) },
      { type: "SUBMITTED_FOR_APPROVAL", date: daysAgo(1) },
    ]) {
      await db.messageEvent.create({
        data: {
          messageId: nudge.id,
          workspaceId,
          actorId: drafterId,
          eventType: ev.type as never,
          createdAt: ev.date,
        },
      });
    }
  }
}

async function seedClearlakeFollowUpThreads(
  workspaceId: string,
  drafterId: string,
  clientId: string
) {
  // Theo Richter (REPLIED) — full multi-touch sequence: opener replied,
  // follow-up replied, third message sent, awaiting another reply.
  const theo = await db.prospect.findFirst({
    where: { workspaceId, fullName: "Theo Richter" },
  });
  if (!theo) return;

  // Follow-up #1 — replied
  const followUp1 = await db.message.create({
    data: {
      workspaceId,
      prospectId: theo.id,
      drafterId,
      body: "Theo, hopping back in — let me know which week works for that 30 min. Genuinely think the Series A diligence parallels are striking.",
      status: "REPLIED",
      approverId: clientId,
      approvedAt: daysAgo(7),
      senderId: drafterId,
      sentAt: daysAgo(6),
      repliedAt: daysAgo(5),
    },
  });
  for (const ev of [
    { type: "DRAFTED", date: daysAgo(8) },
    { type: "SUBMITTED_FOR_APPROVAL", date: daysAgo(7) },
    { type: "APPROVED", date: daysAgo(7) },
    { type: "SENT", date: daysAgo(6) },
    { type: "REPLIED", date: daysAgo(5) },
  ]) {
    await db.messageEvent.create({
      data: {
        messageId: followUp1.id,
        workspaceId,
        actorId: drafterId,
        eventType: ev.type as never,
        createdAt: ev.date,
      },
    });
  }

  // Follow-up #2 — sent, awaiting reply
  const followUp2 = await db.message.create({
    data: {
      workspaceId,
      prospectId: theo.id,
      drafterId,
      body: "Theo, sending my partner Marcus's calendar — happy to align on a slot that works on your end. Looking forward to it.",
      status: "SENT",
      approverId: clientId,
      approvedAt: daysAgo(2),
      senderId: drafterId,
      sentAt: daysAgo(1),
    },
  });
  for (const ev of [
    { type: "DRAFTED", date: daysAgo(3) },
    { type: "SUBMITTED_FOR_APPROVAL", date: daysAgo(2) },
    { type: "APPROVED", date: daysAgo(2) },
    { type: "SENT", date: daysAgo(1) },
  ]) {
    await db.messageEvent.create({
      data: {
        messageId: followUp2.id,
        workspaceId,
        actorId: drafterId,
        eventType: ev.type as never,
        createdAt: ev.date,
      },
    });
  }
}

async function seedActivityVariety(workspaceId: string, actorId: string) {
  // Pick a few prospects in this workspace and add manual activity events
  // to demonstrate the timeline beyond the auto-generated LinkedIn ones.
  const prospects = await db.prospect.findMany({
    where: { workspaceId, status: { in: ["REPLIED", "MEETING_BOOKED", "SENT"] } },
    take: 4,
  });

  const events: Array<{
    fullName: string;
    type: "CALL" | "EMAIL" | "MEETING" | "NOTE_ADDED" | "CONTACTED";
    note: string;
    daysOffset: number;
  }> = [
    {
      fullName: prospects[0]?.fullName ?? "",
      type: "CALL",
      note:
        "30-min intro call. They're 6 months into a similar ops rebuild — looking for a sounding board. Sending case study #2 next week.",
      daysOffset: 4,
    },
    {
      fullName: prospects[1]?.fullName ?? "",
      type: "MEETING",
      note:
        "In-person at SaaStr afterparty. Real chemistry with the product side. Asked us to send a deck on the org-chart playbook.",
      daysOffset: 8,
    },
    {
      fullName: prospects[2]?.fullName ?? "",
      type: "EMAIL",
      note:
        "External email exchange — they sent over their FY plan. Confidential. Not posted in the portal but flagged here so the team knows it exists.",
      daysOffset: 6,
    },
    {
      fullName: prospects[3]?.fullName ?? "",
      type: "NOTE_ADDED",
      note:
        "Their CEO is interviewing for a new VP Ops in Q3 — worth re-engaging then with a different angle.",
      daysOffset: 3,
    },
  ];

  for (const e of events) {
    if (!e.fullName) continue;
    const p = prospects.find((x) => x.fullName === e.fullName);
    if (!p) continue;
    await db.prospectEvent.create({
      data: {
        prospectId: p.id,
        workspaceId,
        actorId,
        eventType: e.type,
        note: e.note,
        occurredAt: daysAgo(e.daysOffset),
      },
    });
  }
}

async function seedNotificationVariety(
  workspaceId: string,
  recipientEmail: string
) {
  // Spread across QUEUED / SENT / FAILED and EMAIL / SLACK so the
  // notifications outbox UI is exercised properly.
  const messages: Array<{
    channel: "EMAIL" | "SLACK";
    recipient: string;
    subject: string;
    body: string;
    relatedType: string;
    status: "QUEUED" | "SENT" | "FAILED";
    sentAtDaysAgo?: number;
    createdDaysAgo: number;
  }> = [
    {
      channel: "EMAIL",
      recipient: recipientEmail,
      subject: "Outreach ready for approval — Jane Doe at Helix Biosciences",
      body: "Your Wilson's team has drafted a new outbound message. Open the portal to approve.",
      relatedType: "message",
      status: "SENT",
      sentAtDaysAgo: 6,
      createdDaysAgo: 6,
    },
    {
      channel: "EMAIL",
      recipient: recipientEmail,
      subject: "Weekly summary — 3 meetings booked this week",
      body: "3 meetings booked, 34% response rate, 18% follower growth.",
      relatedType: "summary",
      status: "SENT",
      sentAtDaysAgo: 7,
      createdDaysAgo: 7,
    },
    {
      channel: "SLACK",
      recipient: "#wilsons-approvals",
      subject: "New post awaiting approval — Pipeline transparency",
      body: "Wilson's team submitted a new post for your approval.",
      relatedType: "post",
      status: "SENT",
      sentAtDaysAgo: 2,
      createdDaysAgo: 2,
    },
    {
      channel: "EMAIL",
      recipient: recipientEmail,
      subject: "Outreach ready for approval — 4 prospects",
      body: "Your Wilson's team has drafted 4 new outbound messages.",
      relatedType: "message",
      status: "QUEUED",
      createdDaysAgo: 1,
    },
    {
      channel: "EMAIL",
      recipient: "no-longer-valid@bouncedomain.com",
      subject: "Outreach ready for approval — Robert Chen at Dayline",
      body: "Your Wilson's team has drafted a new outbound message.",
      relatedType: "message",
      status: "FAILED",
      createdDaysAgo: 5,
    },
  ];

  for (const m of messages) {
    await db.notification.create({
      data: {
        workspaceId,
        channel: m.channel,
        recipient: m.recipient,
        subject: m.subject,
        body: m.body,
        relatedType: m.relatedType,
        status: m.status,
        sentAt:
          m.sentAtDaysAgo !== undefined ? daysAgo(m.sentAtDaysAgo) : null,
        createdAt: daysAgo(m.createdDaysAgo),
      },
    });
  }
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function humanFit(f: "STRONG" | "POSSIBLE" | "NOT_A_FIT"): string {
  if (f === "STRONG") return "strong fit";
  if (f === "NOT_A_FIT") return "not a fit";
  return "possible fit";
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

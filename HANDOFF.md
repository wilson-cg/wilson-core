# Wilson's Client Portal — Agent Handoff

> Comprehensive onboarding doc for any agent (or human) picking this project up
> mid-flight. Last updated 29 April 2026.

---

## V1 pivot (2026-04-30)

The 2026-04-30 client meeting reset scope: **the client keeps Plannable for
content** and asked us to focus on what's actually missing — **intent tracking**.
The product is now a workspace-scoped pipeline of LinkedIn engagement signals
worked through a manual approval flow, used by 3 client teams (Joe, Graham,
Richard). Same view for everyone — no client-vs-agency split for prospects in
V1.

**What's hidden (not deleted)**
- Workspace sidebar drops the Content + Approvals nav. Adds Archive.
- `/dashboard/workspaces/[slug]` redirects to `/prospects` (was `/content`).
- `/dashboard/workspaces/[slug]/content/*` routes redirect to `/prospects`
  with a `// HIDDEN-V1` comment marker. Components, queries, harper.js
  wiring, and the `/dashboard/approvals` cross-workspace queue stay intact;
  revive when Plannable replacement is V2.
- `/client/dashboard` (the LinkedIn-feed approval cards) bounces CLIENTs to
  their first workspace's `/prospects`.

**Schema additions (migration `4_intent_tracking_pivot`)**

New columns on `Prospect`:
- `signalType` (`SignalType?` — `REACTION | COMMENT | CONNECTION_REQUEST | POST | REPEATED_ENGAGEMENT | CUSTOM`)
- `signalContext` (`String?`)
- 4 ICP booleans: `icpCompanyFit`, `icpSeniorityFit`, `icpContextFit`, `icpGeographyFit`
- `icpScore` (0–4, recomputed in app on every flip)
- `approverDecision` (`PENDING | APPROVED | DECLINED`)
- `messageAngle` (`String?`)
- `approverNotes` (`String?`) — separate from internal `notes`
- `archived` (`Boolean`)

`fitScore` + `FitScore` enum dropped. The migration backfills the booleans
from the old enum: `STRONG → all 4 + score 4`, `POSSIBLE → company+seniority + score 2`,
`NOT_A_FIT → all false + score 0`.

`ProspectStatus` gains `NEEDS_APPROVER_DECISION` between `IDENTIFIED` and
`MESSAGE_DRAFTED`.

**New stages on the Kanban**: Identified → Needs decision → Drafting → Sent →
Replied → Meeting booked → Not interested. Nurture pool stays separate.

**Coresignal LinkedIn auto-fill** — `lib/coresignal.ts` calls the Base Employee
API collect endpoint (`https://api.coresignal.com/cdapi/v2/employee_base/collect/{shorthand}`,
`apikey` header). 1 credit per lookup, no free tier. Wired from a button on
the new-prospect form. `CORESIGNAL_API_KEY` is in `.env.example`. Rate-limited
per URL via the existing token limiter.

**Seed wipe** — `npm run db:seed-v2` runs `prisma/seed-v2.ts`, which preserves
`marketing@wilson-cg.com` + `stan@wilson-cg.com` and wipes everyone/everything
else, then creates 3 fresh workspaces (Joe / Graham / Richard) with default
onboarding questions and ADMIN memberships for both preserved admins. No
prospects / messages / posts seeded — clean pipelines for the live demo.
Already executed once against Railway prod (`shuttle.proxy.rlwy.net:43333`).

---

## TL;DR

**Wilson's Client Portal** is a multi-tenant LinkedIn outreach + content
operations platform for the Wilson's agency (consumer-facing brand) /
Wilson CG (legal entity). Source: `wilsons_cg_client_portal_overview_v2.docx`
in the original brief, plus a `Wilson Group Concept One.pdf` brand deck
that defines the visual language.

**Stack:** Next.js 15.5.15 (App Router) · React 19 · TypeScript · Tailwind v4 ·
Prisma 7 · PostgreSQL · @dnd-kit · Zod · harper.js (grammar) · Apache 2.0
licensed open-source where possible.

**Hosting:** Railway. Production URL is provisioned per their dashboard;
Postgres runs as a sibling service with internal DNS (`postgres.railway.internal`).

**Repo:** `https://github.com/wilson-cg/wilson-core` (branch: `main`).

**Local path:** `/Users/maxgowing/Desktop/gstack-main/wilsons-portal/`.

---

## What's been built (chronological)

### Phase 1 — Skeleton + brand
- Next.js 15 + Tailwind v4 scaffold
- Wilson's brand tokens baked into `app/globals.css` as CSS vars: forest
  (#17614F), virgil cream (#F9F5EE), lime (#CAF530), charcoal, raspberry,
  bee, teal, aperol, grapefruit
- Instrument Serif (display) + Inter (UI). **Display serif is RESERVED
  for marketing site / brand graphics. In-app surfaces use Inter via the
  `app-heading` utility class.** This rule was set by the user explicitly.
- Wilson's wordmark + W mark stored at `public/brand/wilsons-wordmark-light.svg`
  + `public/brand/wilsons-mark-light.svg` (user-supplied SVGs)

### Phase 2 — Auth + data model
- SQLite first → migrated to Postgres for Railway deployment
- Cookie-based session auth (NOT production-grade — just a userId stored
  in a `wilsons_session` cookie). Login page is a user-switcher that
  lists all seeded users for stress testing.
- Roles: `ADMIN` (Wilson's agency admin, sees all), `TEAM_MEMBER` (assigned
  workspaces only), `CLIENT` (their own workspace only)
- Workspace-scoping enforced via `requireWorkspace(slug)` guard in `lib/auth.ts`
- Middleware (`middleware.ts`) gates everything except `/`, `/login`,
  `/onboard/*` (public typeform), `/_next`, `/favicon.svg`

### Phase 3 — Two parallel approval streams
The original spec had ONE stream (prospect outreach). User clarified there
are TWO:
1. **Prospect messages** (1:1 outbound to specific people)
2. **Content posts** (the client's own LinkedIn feed)

Both flow through the same approval pattern but live in separate UI
surfaces and database models.

### Phase 4 — Prospect CRM (HubSpot-style pipeline)
- 6-column Kanban: Identified · Drafting · Sent · Replied · Meeting booked · Not interested
- Plus a Nurture pool footer for prospects who don't fit the pipeline yet
- Drag-and-drop between stages (powered by `@dnd-kit/core`) with
  optimistic UI via `useOptimistic`
- Table view alternative grouped by stage
- Search + Owner filter + Fit filter; URL-driven (`?view=board&q=...`)
- Per-prospect detail page = full CRM:
  - Contact panel (LinkedIn URL, email, location, tags)
  - Editable date fields (LinkedIn connected on, last contacted)
  - **Multi-message thread** with forward-only status (drafting a follow-up
    to a REPLIED prospect doesn't drag them back to MESSAGE_DRAFTED)
  - Activity timeline (merges ProspectEvent + MessageEvent rows)
  - Log activity inline (call / email / meeting / note / custom)

### Phase 5 — Content Kanban + drafting
- 4 primary columns: In progress (DRAFT) · Waiting on approval · Approved · Live (POSTED)
- Rejected posts surface as a pinned strip above the board (Board) /
  collapsible section at the bottom (List)
- **Constrained DnD** — see `lib/actions.ts > movePostToStage`. Team CAN'T
  drag posts INTO Approved or Rejected (those belong to the client).
- Board / List view toggle in the page header (URL-driven)
- ⌘⇧N or single-key `N` shortcut for "new post" (registered via
  `useNewPostShortcut` hook)
- `+` button on the "In progress" column / section header for visual discovery

### Phase 6 — Post drafting workbench (the deepest part of the app)
- **PostEditor** (`components/post/post-editor.tsx`) — card-style with toolbar:
  - Bold / Italic — uses Unicode mathematical symbols that survive in the
    LinkedIn feed (NOT markdown)
  - Emoji picker — lazy-loaded via `emoji-picker-element` web component
    (Apache-2.0, ~50KB only when opened)
  - Image attach — drag-and-drop or click to browse, 2MB cap, PNG/JPEG/GIF/WEBP
- **WritingMetrics** — char / word / read time / hashtag count + soft warnings
  tuned for LinkedIn (140 char mobile cut, 1200-1500 char sweet spot, 3000 hard cap)
- **LinkedInPreview** — faithful preview card matching LinkedIn's actual feed
  rendering, with proper truncation (first paragraph break OR ~140 chars,
  whichever comes first)
- **ImprovementsSidebar** (`components/post/improvements-sidebar.tsx`) —
  grammar/style checker matching the user's reference screenshot:
  - Powered by `harper.js` (Apache-2.0, runs in a Web Worker, text never
    leaves the browser)
  - Two tabs: **Sentence** (grouped findings with Current vs Improved diff)
    and **Content** (Flesch-Kincaid grade level + re-check button)
  - Uses the **inlined** binary (`harper.js/binaryInlined`) because Next.js
    doesn't auto-serve raw .wasm from node_modules in production. ~700KB
    on the editor page only, lazy-loaded.
- **Unsaved-changes guard** — `useUnsavedGuard` hook intercepts both
  `beforeunload` (tab close / refresh) AND in-app `<Link>` clicks. Falls
  back to a confirm() prompt. Bypass with `data-skip-guard="true"` on a link.

### Phase 7 — Client approval surface
- Client dashboard at `/client/dashboard` shows two queues:
  - **Posts for your LinkedIn feed** — rendered as **LinkedIn-style feed
    cards** (white background, blue author name, image grid, like/comment/
    repost/send strip). Wilson's-branded approval action band sits below
    the feed card so the visual separation is clear.
  - **Outreach to your prospects** — message approval cards
- Client can: Approve · Edit & approve · Reject with notes
- Recent replies feed below
- Weekly metrics: Approved, Sent, Replied + response rate, Posts live

### Phase 8 — Workspace settings (3 sections)
- **Profile** — display name, business name, logo URL (paste-or-data-URL),
  LinkedIn, approval email, accent color
- **Client contacts** — multiple per workspace, one primary. Primary's
  email becomes the default approval recipient (overridden by
  `workspace.approvalEmail` if set).
- **Onboarding** — Google-Sheets-style table:
  - 10 default questions seeded for every workspace via `lib/default-onboarding.ts`
  - Field types: TEXT / LONGTEXT / URL / NUMBER / SINGLE_CHOICE / MULTI_CHOICE
  - Choice questions support options + min/max selections + required flag
  - Inline editor expands when SINGLE_CHOICE / MULTI_CHOICE is picked

### Phase 9 — Public Typeform-style onboarding
- Each workspace has an `onboardingToken` (32-char hex)
- Public URL: `/onboard/[token]` — no auth required, scoped strictly to
  the matching workspace's questionnaire
- Forest grid backdrop, big serif question, white answer box, progress bar,
  keyboard-driven (Enter / Esc / Shift+Enter)
- Renders TEXT/LONGTEXT as textarea, SINGLE_CHOICE as A/B/C/D auto-advance
  cards, MULTI_CHOICE as toggle cards with min/max enforcement
- "Share link" button in workspace settings copies the URL to clipboard

### Phase 10 — Notifications outbox
- Every approval submission queues a `Notification` row (EMAIL or SLACK)
- Recipient resolved by priority: `workspace.approvalEmail` →
  primary `ClientContact.email` → fallback to first CLIENT user
- Outbox view at `/dashboard/notifications` for the team
- **No real delivery yet** — rows just sit at status QUEUED. Wiring Resend
  for email / Slack webhook is a single-file swap (`lib/actions.ts`
  notification creation).

### Phase 11 — New client onboarding flow
- `+ New client` button at the bottom of the workspace sidebar
- `/dashboard/new-client` is a minimal entry: just the client name
- `createClient` server action slugifies the name, creates the workspace,
  seeds the 10 default onboarding questions, generates an `onboardingToken`,
  adds a `Membership` for the creator, redirects to settings to fill in
  the rest

---

## Project structure

```
wilsons-portal/
├── app/
│   ├── (auth)/login/                 ← Test-user picker (NOT prod auth)
│   ├── (team)/
│   │   ├── layout.tsx                ← Auth gate only
│   │   ├── nav-item.tsx              ← Path-aware sidebar link
│   │   ├── (global)/                 ← Cross-workspace views
│   │   │   ├── layout.tsx            ← Global sidebar (clients list)
│   │   │   └── dashboard/
│   │   │       ├── page.tsx          ← Team home (priorities + funnel)
│   │   │       ├── approvals/page.tsx
│   │   │       ├── notifications/page.tsx
│   │   │       ├── new-client/page.tsx
│   │   │       └── prospects/[id]/page.tsx  ← Legacy redirect
│   │   └── (workspace)/dashboard/workspaces/[slug]/
│   │       ├── layout.tsx            ← Workspace sidebar (logo, content/prospects/etc)
│   │       ├── page.tsx              ← Redirects to /content
│   │       ├── content/              ← Post pipeline
│   │       │   ├── page.tsx          ← Board + List + view toggle
│   │       │   ├── content-kanban.tsx ← DnD client island
│   │       │   ├── content-list.tsx   ← List view client island
│   │       │   ├── new-post-shortcut.tsx ← ⌘⇧N hook mount
│   │       │   ├── new/page.tsx      ← New post entry
│   │       │   ├── new/new-post-workbench.tsx ← Editor on new-post
│   │       │   └── [id]/
│   │       │       ├── page.tsx      ← Post detail server wrapper
│   │       │       └── post-workbench.tsx ← Editor + preview + improvements
│   │       ├── prospects/            ← Prospect CRM
│   │       │   ├── page.tsx          ← Pipeline Kanban + Table
│   │       │   ├── kanban-board.tsx  ← DnD Kanban (client)
│   │       │   ├── table-by-stage.tsx ← Table grouped by stage (client)
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/
│   │       │       ├── page.tsx
│   │       │       ├── message-thread.tsx
│   │       │       ├── log-activity.tsx
│   │       │       ├── edit-info.tsx
│   │       │       ├── edit-dates.tsx
│   │       │       └── copy-client-button.tsx
│   │       └── settings/page.tsx     ← Profile, Contacts, Onboarding
│   ├── (client)/
│   │   ├── layout.tsx                ← Client header (logo + Settings nav)
│   │   ├── client-nav-link.tsx       ← Path-aware client nav
│   │   ├── client/
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx          ← LinkedIn-feed-style approval cards
│   │   │   │   ├── message-actions.tsx
│   │   │   │   └── post-actions.tsx
│   │   │   └── settings/page.tsx     ← Same 3 sections, scoped to own workspace
│   ├── onboard/[token]/              ← PUBLIC typeform (no auth)
│   │   ├── page.tsx
│   │   └── typeform-onboarding.tsx
│   ├── design-system/page.tsx        ← Internal design vocabulary showcase
│   ├── layout.tsx                    ← Root layout (fonts, metadata)
│   ├── page.tsx                      ← Smart redirect (login / team / client)
│   └── globals.css                   ← Brand tokens + app-heading utility
├── components/
│   ├── brand/wordmark.tsx            ← Wordmark + MarkW (placeholder if real SVG missing)
│   ├── settings/
│   │   ├── workspace-logo.tsx        ← Logo display (img if URL set, avatar fallback)
│   │   ├── profile-section.tsx
│   │   ├── contacts-section.tsx
│   │   ├── onboarding-section.tsx
│   │   └── share-onboarding-link.tsx
│   ├── post/
│   │   ├── post-editor.tsx           ← Toolbar + textarea + drag-drop + emoji
│   │   ├── linkedin-preview.tsx
│   │   ├── writing-metrics.tsx
│   │   ├── improvements-sidebar.tsx  ← harper.js findings UI
│   │   ├── use-unsaved-guard.ts      ← Hook
│   │   └── use-new-post-shortcut.ts  ← Hook
│   └── ui/                           ← Button, Card, Badge, Input
├── lib/
│   ├── auth.ts                       ← currentUser, requireRole, requireWorkspace
│   ├── db.ts                         ← Prisma client (lazy proxy + pg adapter)
│   ├── queries.ts                    ← All data-access functions
│   ├── actions.ts                    ← All server actions (700+ lines, well sectioned)
│   ├── default-onboarding.ts         ← The 10 canonical questions
│   └── utils.ts                      ← cn() helper
├── prisma/
│   ├── schema.prisma                 ← Postgres datasource
│   └── seed.ts                       ← Demo data (700+ lines)
├── public/
│   ├── brand/
│   │   ├── wilsons-wordmark-light.svg
│   │   └── wilsons-mark-light.svg
│   └── favicon.svg
├── prisma.config.ts                  ← Prisma 7 datasource config (reads DATABASE_URL)
├── middleware.ts                     ← Route gating
├── next.config.ts
├── package.json                      ← Build script: prisma generate && next build
└── HANDOFF.md                        ← This file
```

---

## Database schema (key models)

See `prisma/schema.prisma` for the canonical version. High-level:

```
User (id, email, name, role)
  → memberships
  → draftedMessages / approvedMessages / sentMessages
  → draftedPosts / approvedPosts / postedPosts
  → assignedProspects
  → all events (MessageEvent, PostEvent, ProspectEvent)

Workspace (id, name, slug, businessName, contactName, accentColor,
           logoUrl, linkedinUrl, approvalEmail, onboardingToken)
  → memberships
  → contacts (ClientContact[]) — primary contact's email is approval default
  → onboarding (OnboardingResponse[]) — Q&A pairs with field types
  → icp (Icp?)
  → prospects, messages, posts, notifications, ...

Membership (userId, workspaceId, role)
  Role enum: ADMIN | TEAM_MEMBER | CLIENT

Prospect (workspaceId, fullName, linkedinUrl, company, title, email,
          location, tags, fitScore, status, assigneeId,
          linkedinConnectedAt, lastContactedAt, notes)
  Status: IDENTIFIED | MESSAGE_DRAFTED | PENDING_APPROVAL | APPROVED |
          SENT | REPLIED | MEETING_BOOKED | NOT_INTERESTED | NURTURE

Message (workspaceId, prospectId, body, status, version, drafterId,
         approverId, sentAt, repliedAt, rejectionNote)
  Status: DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | SENT | REPLIED

Post (workspaceId, title, body, status, version, drafterId, approverId,
      posterId, postedUrl, rejectionNote)
  Status: DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | POSTED
  → media (PostMedia[]) — data URL or remote URL

PostMedia (postId, url, filename, contentType, orderIndex)

ClientContact (workspaceId, fullName, title, email, linkedinUrl, isPrimary)

OnboardingResponse (workspaceId, question, answer, fieldType, options,
                    minSelections, maxSelections, orderIndex, required)
  Fieldtype: TEXT | LONGTEXT | URL | NUMBER | SINGLE_CHOICE | MULTI_CHOICE

Notification (workspaceId, channel, recipient, subject, body,
              relatedType, relatedId, status, sentAt)
  Channel: EMAIL | SLACK
  Status: QUEUED | SENT | FAILED

ProspectEvent / MessageEvent / PostEvent — append-only audit logs
```

### Key workflow rules baked into the model
1. **Forward-only prospect status** (`shouldAdvance` in `lib/actions.ts`)
   — drafting a follow-up to a REPLIED prospect doesn't drag them back
2. **Approval recipient priority** (`pickApprovalRecipient`):
   `workspace.approvalEmail` → primary `ClientContact.email` → first
   CLIENT user's email
3. **Constrained post DnD** (`movePostToStage`):
   - DRAFT ↔ PENDING_APPROVAL ✓
   - APPROVED ↔ POSTED ✓
   - REJECTED → DRAFT ✓
   - **CANNOT** drag into APPROVED (client's call) or REJECTED (needs note)

---

## Test accounts (seeded)

| User | Email | Role | Access |
|---|---|---|---|
| Max Gowing | `max@wilsons.com` | ADMIN | All workspaces |
| Sarah Chen | `sarah@wilsons.com` | TEAM_MEMBER | Condor + Clearlake |
| Stan Williams | `stan@condor.com` | CLIENT | Condor Group only |
| James Watt | `james@clearlake.com` | CLIENT | Clearlake Group only |
| Max Hexemer | `max@rook.com` | CLIENT | Rook only |

The login page is a user-switcher — pick one to impersonate. There's no
real auth; this is for stress testing.

### Seeded workspaces

- **Condor Group** (B2B SaaS COOs and VP-Ops)
- **Clearlake Group** (Series A founders)
- **Rook** (DTC brands)

Each workspace has:
- A logo (data URL SVG with their initial on accent color)
- LinkedIn URL
- Approval email (Clearlake uses `approvals@clearlake.com` as a deliberate
  override-the-primary-contact example)
- 1-3 client contacts
- 10 onboarding questions (8 long-text + 1 multi-choice + 1 single-choice)
- ~13 prospects each, in mixed pipeline states
- 3-4 posts each in mixed states
- A handful of activity events + notifications

Total seeded counts (after `npm run db:seed`):
- 5 users · 3 workspaces · 6 contacts · 30 onboarding rows
- 40 prospects · 127 prospect events
- 38 messages · 119 message events
- 11 posts · 29 post events
- 18 notifications

---

## Local development

```bash
cd ~/Desktop/gstack-main/wilsons-portal

# 1. Install
npm install

# 2. Set DATABASE_URL — point at any Postgres (local Docker, Neon, or
#    the Railway public proxy URL from the Railway dashboard).
cp .env.example .env
# edit .env to set DATABASE_URL

# 3. Push schema + seed
npm run db:push
npm run db:seed

# 4. Run
npm run dev
# http://localhost:3000

# Other useful scripts
npm run db:studio   # Prisma Studio GUI
```

### Important: prisma generate

The `postinstall` script runs `prisma generate` automatically. If types
get out of sync after a schema change, run `npx prisma generate` manually.

### Re-seed against Railway

```bash
DATABASE_URL="<railway-public-url>" npx tsx prisma/seed.ts
```

The Railway public URL is exposed in their dashboard → Postgres service
→ Connect tab → "Public Networking URL" (uses `*.proxy.rlwy.net`).

---

## Deploy to Railway

The current Railway setup:
1. App service connected to GitHub `wilson-cg/wilson-core`
2. Postgres service running alongside, linked into the app via
   `DATABASE_URL` reference variable
3. Build pipeline (in `package.json`):
   - `postinstall`: `prisma generate`
   - `build`: `prisma generate && next build`
   - `start`: `prisma db push --accept-data-loss && next start`

**Why `db push` runs at start, not build:**
Railway's internal DNS (`postgres.railway.internal`) only resolves at
runtime. Build containers can't reach the Postgres. `db push` at start
is idempotent — it's a no-op when the schema is already in sync.

### Deploy a new commit

Push to `main` on GitHub. Railway auto-deploys. ~2 minutes.

### After a schema change

1. Edit `prisma/schema.prisma`
2. Test locally: `npx prisma db push --accept-data-loss` against your
   local Postgres
3. Commit + push
4. After Railway redeploys, the start script runs `db push` against the
   prod DB automatically

### One-off DB scripts (e.g. re-seed)

Use the **Railway public URL** from your local terminal. Don't try to
run things over the internal DNS — that only works inside Railway's
network.

---

## Open-source dependencies (worth knowing)

| Package | License | What it does |
|---|---|---|
| `next` | MIT | Framework |
| `react` | MIT | UI |
| `prisma` | Apache-2.0 | ORM |
| `@prisma/adapter-pg` | Apache-2.0 | Postgres adapter for Prisma 7 |
| `@dnd-kit/core` | MIT | Drag-and-drop |
| `harper.js` | Apache-2.0 | Grammar checker (browser, in-worker, no API) |
| `emoji-picker-element` | Apache-2.0 | Emoji picker web component |
| `lucide-react` | ISC | Icons |
| `date-fns` | MIT | Date formatting |
| `zod` | MIT | Schema validation |
| `@radix-ui/react-slot` | MIT | Polymorphic Button asChild |
| `tailwindcss` | MIT | Styles |

---

## Things the user has been explicit about (DO NOT BREAK)

1. **Display serif (Instrument Serif) is for marketing only.** In-app surfaces
   use Inter via the `app-heading` utility class. The user explicitly asked
   for this in Phase 1.
2. **Brand tokens are the brand deck colors.** Don't introduce custom hex
   values; use the CSS vars in `globals.css`.
3. **Wilson's wordmark + W mark are user-supplied SVGs** at `public/brand/`.
   Use them as-is; don't substitute.
4. **The product is for Wilson's** (not Wilson CG — that's the legal entity).
   UI says "Wilson's" everywhere customer-facing.
5. **All buttons must be uniform.** Use the `Button` primitive from
   `components/ui/button.tsx`. The `asChild` prop is wired with Radix Slot
   so `<Button asChild><Link>...</Link></Button>` produces a single `<a>`
   element with the button's classes — DO NOT nest a button inside a link
   or vice versa, that breaks the icon flex layout.
6. **No LinkedIn integration in v1.** The original spec had Unipile read-only
   integration; user explicitly removed this for v1. Sending stays manual.
   Keep it that way.
7. **Wilson's voice in copy: human, direct, intentional.** "Real people deserve
   real stories." Keep it warm and operator-tone, not corporate.
8. **The user doesn't want AI vocabulary in copy** ("delve", "robust",
   "comprehensive", "leverage"). See ETHOS.md in the parent gstack repo
   for full guidance.

---

## Known issues / nice-to-haves not yet built

### Not built yet (deliberate v1 cuts)
- Real auth (currently a userId cookie). User said this is fine for stress
  testing. Production cutover should swap to Clerk or NextAuth.
- Real email/Slack delivery for notifications. Currently just queues rows
  in the DB. One-file swap when ready (Resend for email, incoming webhook
  for Slack).
- Image storage on a real CDN. Currently data URLs. Swap to Cloudflare R2
  or Railway volume when post-media volume picks up.
- Reports page (sidebar link exists; route doesn't)
- Team page (sidebar link exists; route doesn't)
- ICP reference dedicated page (sidebar link exists; uses inline ICP from
  workspace settings instead)
- ⌘K command palette (sidebar shows the affordance; not wired)
- Bulk operations on prospects
- Saved views on prospect Kanban
- CSV import/export for prospects
- Prospect post-pulling from LinkedIn (Unipile integration — explicitly
  out of scope for v1)

### Things to be aware of
- **harper.js inlines a 700KB WASM blob** into the post-editor page bundle.
  This is intentional (Next.js can't reliably serve raw .wasm from
  node_modules in production), but it does bloat that page. Lazy-loaded
  only on `/content/[id]` and `/content/new`.
- **The unsaved-changes guard uses `confirm()`** which is browser-native
  and ugly. Could be upgraded to a custom modal. Not a priority.
- **`db push --accept-data-loss` runs at every deploy.** This is fine in
  the current dev/demo phase but is risky for real production. Switch to
  Prisma migrations (`migrate deploy`) before any real client data lands.

---

## Critical commands cheatsheet

```bash
# From project root:
npm run dev                # local dev server
npm run build              # production build (won't touch DB)
npm run db:push            # apply schema to current DATABASE_URL
npm run db:seed            # repopulate demo data
npm run db:studio          # open Prisma Studio GUI

# When schema changes:
npx prisma generate        # regenerate Prisma client (also runs on postinstall)

# When DB drifts (rare):
DATABASE_URL=... npx prisma db push --accept-data-loss --force-reset
# WARNING: --force-reset wipes data. Use only on dev/demo DBs.

# Smoke-test the deployed app from local terminal:
DATABASE_URL="<railway-public-url>" npx tsx prisma/seed.ts
```

---

## How the user works

- **Asks for product features in plain English.** Doesn't get into
  implementation details. Expects you to make the right architectural
  choice and explain it.
- **Wants honest "what's possible" answers.** If something is genuinely
  hard or has tradeoffs, say so — they appreciate the directness.
- **Likes screenshots / references for visual asks.** When pushing back
  on UI, often shares a screenshot of what they want it to look like.
- **Iterates quickly.** Often sends a short follow-up "actually X" right
  after a feature ships. Plan for that.
- **Trusts the agent to deploy.** Does NOT want to manually run shell
  commands every time. The agent has been running migrations, seeds,
  and Railway operations directly with permission once given.
- **Reuses Railway's public Postgres URL** for one-off ops. Has shared it
  in chat once already. If you need to re-seed or alter the DB, ask.

---

## Recent commits (for context on what's fresh)

```
b21766d Keyboard shortcut for new post + + button on In progress column
2372498 Unsaved-changes guard, content Kanban DnD, list view toggle
7633c30 Drop zone obvious + LinkedIn-style client approval card
3d05e46 Fix grammar checker actually running + accurate LinkedIn truncation
22f116d New post page: use the same workbench
f82cc88 Post drafting overhaul: rich editor, improvements sidebar, media uploads, emoji picker
cbb9610 Onboarding: real 10-question default + single/multi choice question types
1f9ff1a Typeform: use real Wilson's logo SVGs + white answer textarea
cbbd937 Move prisma db push from build to start
18ca371 Drop --skip-generate flag in build script
f5a4593 Seed: add multi-message threads, varied notifications, manual activity events
a560270 Initial commit
```

---

## Where to go next (likely user asks)

Based on the flow of the session, plausible next-up features:

1. **Real auth** — swap the cookie hack for Clerk or NextAuth + Sign In With LinkedIn
2. **Real email delivery** — wire Resend into the notification queue
3. **Reports page** — workflow metrics dashboard (drafts/approvals/replies/meetings over time)
4. **AI drafting assist** — Claude API for "Draft first pass" / "Tighten" / "Make warmer" buttons
   on the post editor + message thread (per the v2 spec; not yet built)
5. **CSV import/export** for prospects
6. **Mobile responsive polish** — currently desktop-first; sidebar collapses below 768px
   but the post editor + improvements sidebar layout could use a mobile pass

---

## Production readiness layer (added 2026-04-29)

Three production hardening landed together on `feat/prod-readiness`:

### Auth — Auth.js v5 + magic links + invites

The cookie-based stress-test login (`wilsons_session` userId cookie) was replaced
with Auth.js v5 + Resend magic links + a new `Invite` table.

**Sign-in flow:**
1. User goes to `/login` → enters email → server action calls
   `signIn("resend", { email, redirectTo: "/dashboard" })`
2. Auth.js generates a `VerificationToken`, Resend delivers a branded magic link
3. User clicks the link → Auth.js verifies the token → `signIn` callback runs:
   - allows existing User rows through
   - rejects new emails unless a pending `Invite` row matches
4. On first sign-in for a fresh User, the `events.createUser` hook accepts the
   pending invite, sets `User.role` from the invite's `systemRole`, creates a
   `Membership` if the invite was workspace-scoped, and marks the invite accepted

**Invite flow:**
- ADMIN visits `/dashboard/team` → "Invite teammate" form → `createInvite`
  generates a 32-byte hex token, 7-day expiry, sends a branded email
- For workspace-scoped invites (CLIENT or workspace member), use the Members
  section in workspace settings — calls `inviteToWorkspace` (ADMIN/TEAM_MEMBER gated)
- Invite landing page is `/invite/[token]` — public, no auth required
- Revoke / resend actions live on the team page

**Stable shims:** `lib/auth.ts` still exports `currentUser()`, `requireUser()`,
`requireRole(...)`, `requireWorkspace(slug)` with the same shapes the rest of
the app expects. `listTestUsers` was removed.

**Bootstrap the first ADMIN** (no UI exists to create the very first invite —
only an existing ADMIN can):
```bash
DATABASE_URL=... AUTH_RESEND_KEY=... AUTH_EMAIL_FROM=... \
  npm run db:bootstrap-admin -- you@example.com
```
Prints the invite URL. Sends an email if Resend creds are set.

**Required env vars** (see `.env.example`):
- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_URL` — public URL (Railway sets this; `http://localhost:3000` for dev)
- `AUTH_RESEND_KEY` — Resend API key (can be the same one as `RESEND_API_KEY`)
- `AUTH_EMAIL_FROM` — `Wilson's <noreply@verified-domain>`

### Rate limiting — Upstash sliding window

Every public-token-scoped server action is rate-limited at **10 req / 60s per token**
via `@upstash/ratelimit`. The token itself is the key.

Wrapped actions (`lib/actions.ts`):
- `submitOnboardingByToken` (`onboardingToken`)
- `approvePostByToken` / `editAndApprovePostByToken` / `rejectPostByToken`
- `approveMessageByToken` / `editAndApproveMessageByToken` / `rejectMessageByToken`

If `UPSTASH_REDIS_REST_URL` is unset, `enforceTokenRateLimit` no-ops so local
dev doesn't need an Upstash account. For prod, set:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The helper lives in `lib/rate-limit.ts`.

### Real Prisma migrations

See "Migration adoption strategy" below. Short version: `prisma db push` is
gone; Railway now runs `prisma migrate deploy` at start.

---

### Migration adoption strategy

The project switched from `prisma db push --accept-data-loss` (run on every Railway boot)
to real Prisma migrations on 2026-04-29. Two migration folders ship in `prisma/migrations/`:

- `0_init/` — full snapshot of the pre-auth schema. This matches what Railway prod
  already had on disk from previous `db push` runs. NO new SQL is run for it on prod.
- `1_auth_and_invites/` — the delta added by Auth.js v5 + the `Invite` model:
  adds `Account`, `Session`, `VerificationToken`, `Invite` tables, plus three new
  columns on `User` (`emailVerified`, `image`, and dropping NOT NULL on `name`).

**For local dev / fresh Postgres**:
```bash
npx prisma migrate deploy   # applies both migrations cleanly
npx prisma generate
```

**For Railway prod (which already had the pre-auth schema applied via `db push`)**:
the adoption was a one-time, manual two-step:

1. Take a Railway DB backup (Railway dashboard → Postgres → Backups → "Take backup now").
2. From a local shell with Railway's public DATABASE_URL, mark `0_init` as already
   applied (no SQL run — just inserts a row into `_prisma_migrations`):
   ```bash
   DATABASE_URL=<railway_public_url> npx prisma migrate resolve --applied 0_init
   ```
3. Then run `migrate deploy`. It sees `0_init` is satisfied and applies only
   `1_auth_and_invites`:
   ```bash
   DATABASE_URL=<railway_public_url> npx prisma migrate deploy
   ```

**What was actually run on 2026-04-29 against Railway:**
```
$ npx prisma migrate resolve --applied 0_init
Migration 0_init marked as applied.

$ npx prisma migrate deploy
2 migrations found in prisma/migrations
Applying migration `1_auth_and_invites`
The following migration(s) have been applied:
migrations/
  └─ 1_auth_and_invites/
    └─ migration.sql
All migrations have been successfully applied.
```

After that, `npm start` on Railway runs `prisma migrate deploy && next start`,
which is now a no-op until a new migration lands. New migrations should be created
locally with `npx prisma migrate dev --name <description>` and committed to git;
the next Railway boot will apply them.

**Do NOT run `prisma migrate dev` against Railway prod** — it can rewrite history.
Use `migrate dev` only against a local/scratch DB; commit the generated SQL; let
prod pick it up via `migrate deploy`.

---

## V1 UX overhaul (2026-05-01)

Plannable-style workspace picker + granular per-action permissions. PR
follow-up to the intent-tracking pivot. All five pieces shipped together:

### Workspace picker home page (`app/page.tsx`)

After login, every user lands on a Plannable-style grid of workspace cards
instead of role-based redirects to `/dashboard` or `/client/dashboard`.
Each card shows: avatar, workspace name, **N awaiting your decision**,
**M total prospects**, **Avg ICP score: X.Y / 4**, last-activity timestamp,
and the first three member avatars. Click anywhere to enter the workspace.
Backed by `workspacePickerCards()` in `lib/queries.ts`.

### Top-bar workspace switcher + tabs subnav

The cross-workspace sidebar inside `app/(team)/(workspace)/dashboard/workspaces/[slug]/layout.tsx` is gone. Replaced with `<WorkspaceTopBar>` (in
`components/workspace/top-bar.tsx`):
- Left: ← All clients link back to the picker home
- Center: workspace dropdown (lists user's other accessible workspaces)
- Right: Members button (avatar overlap → modal) + settings cog
- Below: tab strip (Prospects / Archive / ICP reference / Settings)

### Granular permissions matrix

New columns on `Membership` (and same on `Invite` /
`InviteWorkspaceAccess`): `canApprove`, `canEdit`, `canSend`, `canAdmin`.
`canView` is implicit on every Membership. Backfill rules in migration
`5_granular_permissions`:
- ADMIN / TEAM_MEMBER memberships → all four flags true
- CLIENT memberships → canApprove only

System ADMINs always bypass via `lib/permissions.ts`. Helpers:
- `canPerformInWorkspace(user, workspaceId, action)` — boolean
- `requirePermission(user, workspaceId, action)` — throws
- `permissionsForWorkspace(user, workspaceId)` — full snapshot for islands
- `defaultFlagsForSystemRole(systemRole)` — invite preset

Server actions in `lib/actions.ts` call `requirePermission` at the top:
- `addProspect`, `updateProspectInfo`, `archiveProspect`, `unarchiveProspect`,
  `updateDraft`, `submitForApproval`, `draftMessage` → `edit`
- `setIcpField`, `setApproverDecision`, `approveMessage`, `editAndApprove`,
  `rejectMessage` → `approve`
- `markAsSent`, `markAsReplied`, `markMeetingBooked`,
  `updateProspectContactDates`, `logProspectActivity` → `send`
- `moveProspectToStage` — gated per-target-stage (approve/edit/send)
- `requireWorkspaceWriteAccess` (workspace settings, contacts, onboarding,
  members, deletion) → `admin`

### Members modal (`components/workspace/members-modal.tsx`)

Triggered from the top-bar avatar overlap. Four tabs:
- **Invite** (admin) — email + system role + permission preset (Client /
  Team / Custom). Wires to `inviteToWorkspace` which now accepts the four
  flags + a system role.
- **Members** — list of memberships with role chip + Remove (admin only).
- **Permissions** (admin) — checkbox matrix: View (locked) / Approve /
  Edit / Send / Admin. Each toggle fires `updateMembershipPermissions`
  immediately.
- **Notifications** — per-member "email me when prospects need approval"
  toggle (writes to new `Membership.notifyOnApprovalRequested` column).

New invites bake the permission preset into the Invite row; the
`events.createUser` callback in `lib/auth.ts` applies those flags to the
resulting Membership row at first sign-in.

### 5-section CSV-aligned prospect detail page

`app/(team)/(workspace)/dashboard/workspaces/[slug]/prospects/[id]/page.tsx`
now has 5 sections matching the CSV column groups:
1. CAPTURE — name, LinkedIn, title, company, signal type + context
2. ICP FIT — big 64px score ring + 4 toggles (gated on `canApprove`)
3. DECISION — approver decision radio + message angle + approver notes
   (gated on `canApprove`)
4. MESSAGE — existing thread (gated on `canEdit` / `canSend` per action)
5. OUTCOME — replied / sent / meeting / contacted dates (gated on `canSend`)

`IcpWidget` got a 4-segment SVG ring (segments filled = score) on the left
of the toggles. Forest fills, virgil-dark unfilled.

### ICP visual prominence

The ICP score is the load-bearing data point in the meeting. Three places
got prominence:
1. **Picker cards** — third metric line "Avg ICP score: X.Y / 4" (skipped
   if 0 prospects).
2. **Kanban cards** — `IcpPill` in the top-right corner of every card.
   Color scale (existing brand vars only): 4/4 forest+lime, 3/4 forest
   outline, 2/4 bee, 1/4 grapefruit, 0/4 charcoal-300.
3. **Prospect detail** — 64px score ring with thin progress arcs to the
   left of the 4 ICP toggles. Re-renders optimistically on each click.

### Default permission presets (Client = view+approve; Team = full)

The Members modal's "Client" preset = canApprove only. The "Team" preset =
all four flags. "Custom" exposes the four checkboxes directly. Same defaults
applied by the migration backfill, by `events.createUser` when an invite is
accepted, and by `defaultFlagsForSystemRole`.

---

## Final notes for an agent picking this up

- **Read `lib/actions.ts` first.** It's the heart of the app. ~1000 lines
  but well-sectioned with comment dividers.
- **Read `lib/queries.ts` second.** Every data fetch goes through here.
- **Check `prisma/schema.prisma` for the data model** before assuming
  what fields exist.
- **The user values clean diffs and clear commit messages.** Write commits
  that explain the WHY in the body, not just the WHAT.
- **Use the existing Wilson's component primitives** (Button, Card, Badge,
  Input). Don't roll new ones unless you really need to.
- **Build with the harper.js philosophy in mind:** privacy first, runs
  on-device when possible, no external API calls for things that can be
  done locally.
- **Don't add new dependencies casually.** The current package list is
  intentional and lean.

Good luck. The project is in good shape — solid foundation, room to grow.

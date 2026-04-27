# Wilson's Client Portal

A done-with-you LinkedIn outreach operations platform for Wilson's clients.

Multi-tenant approval + project management portal: prospect CRM, content
Kanban, message thread, public typeform-style onboarding, per-client
settings.

Built with Next.js 15 (App Router) · React 19 · Tailwind v4 · Prisma 7 ·
Postgres · TypeScript · @dnd-kit · Zod.

---

## Local development

### Prerequisites

- Node 20+
- A Postgres instance (any of: Docker, Neon, Railway, Supabase, local install)

### Setup

```bash
npm install
cp .env.example .env       # fill in DATABASE_URL
npm run db:push            # creates tables in your Postgres
npm run db:seed            # populates demo data
npm run dev                # http://localhost:3000
```

### Test accounts (seeded)

| User | Email | Role | Access |
|---|---|---|---|
| Max Gowing | `max@wilsons.com` | Admin | All workspaces |
| Sarah Chen | `sarah@wilsons.com` | Team | Condor + Clearlake |
| Stan Williams | `stan@condor.com` | Client | Condor only |
| James Watt | `james@clearlake.com` | Client | Clearlake only |
| Max Hexemer | `max@rook.com` | Client | Rook only |

The login page lists all of these — pick one to impersonate.

---

## Deploying to Railway

### One-time setup

1. Create a project at [railway.app](https://railway.app)
2. Connect this GitHub repo (Add Service → GitHub Repo → wilson-cg/wilson-core)
3. Add Postgres (Add Service → Database → PostgreSQL)
4. On the app service, **link the Postgres** so `DATABASE_URL` is auto-injected:
   - Variables tab → Add Reference Variable → select Postgres → `DATABASE_URL`
5. Deploy. Railway runs `npm install` → `postinstall` → `npm run build` → `npm start`.
   The build script runs `prisma generate && prisma db push` before `next build`,
   so the schema is created on first deploy automatically.
6. Seed demo data (one-time):
   ```bash
   railway run npm run db:seed
   ```

### Subsequent deploys

Just push to the connected branch. Railway re-runs the build, which:

- Regenerates the Prisma client (`postinstall`)
- Pushes any schema changes (`prisma db push --accept-data-loss`)
- Builds the Next.js app

For schemas with destructive changes you want to review, run
`prisma migrate dev --name xyz` locally instead of relying on `db push`.

### Environment variables

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. Auto-injected on Railway via the Postgres plugin reference. |
| `NODE_ENV` | No | Set to `production` automatically by Railway. |

---

## Project structure

```
app/
├── (auth)/login/                 ← user picker (stress-test auth)
├── (team)/
│   ├── (global)/dashboard/       ← cross-workspace home, approvals, notifications
│   └── (workspace)/dashboard/workspaces/[slug]/
│       ├── content/              ← post Kanban
│       ├── prospects/            ← prospect CRM (Board + Table-by-stage)
│       └── settings/             ← profile, contacts, onboarding Q&A
├── (client)/client/
│   ├── dashboard/                ← approval queue
│   └── settings/                 ← same three sections
└── onboard/[token]/              ← public typeform onboarding (no auth)

components/
├── settings/                     ← shared profile, contacts, onboarding sections
├── brand/                        ← Wilson's wordmark
└── ui/                           ← Button, Card, Badge, Input

lib/
├── auth.ts                       ← cookie-based session, requireRole/requireWorkspace
├── db.ts                         ← Prisma client (PrismaPg adapter)
├── queries.ts                    ← all data-access functions
└── actions.ts                    ← all server actions

prisma/
├── schema.prisma                 ← Postgres datasource
└── seed.ts                       ← demo data
```

## Workflow concepts

- **Two streams of approvals:** outbound prospect messages (1:1) and content posts (the client's LinkedIn feed).
- **Forward-only prospect status:** drafting a follow-up to a `REPLIED` prospect doesn't drag them back to `MESSAGE_DRAFTED`.
- **Token-scoped public onboarding:** every workspace has an `onboardingToken`. The URL `/onboard/[token]` unlocks exactly that workspace's questionnaire — no auth needed, no cross-workspace leakage.
- **Approval routing priority:** `workspace.approvalEmail` → primary `ClientContact.email` → first `CLIENT` user.

## Stress-test auth

Sessions today are a single signed-ish cookie (`wilsons_session`) holding a userId. Fine for shared demos and stress testing — swap for Clerk or NextAuth before any real client signs in.

---

## License

Private — Wilson's CG.

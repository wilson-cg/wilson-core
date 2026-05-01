import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { Plus, Star } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { workspacePickerCards } from "@/lib/queries";
import { Wordmark } from "@/components/brand/wordmark";
import { WorkspaceLogo } from "@/components/settings/workspace-logo";
import { Button } from "@/components/ui/button";
import { PickerHeader } from "@/components/workspace/picker-header";

/**
 * Workspace picker home (V1 UX overhaul, 2026-05-01).
 *
 * Replaces the old role-based redirect. Every signed-in user lands here:
 *   - Top bar: agency wordmark + user menu (Audit / Sign out)
 *   - Header row: "Choose a client" + "+ New workspace" (ADMIN only)
 *   - Grid of workspace cards (3-4 across on desktop):
 *       avatar / initials, workspace name,
 *       N awaiting your decision, M total prospects,
 *       Avg ICP score (if any prospects),
 *       last activity timestamp,
 *       up to 3 member avatars (decorative — full Members modal lives
 *       inside a workspace),
 *       disabled star icon (favourites land in V2)
 *   - Click anywhere on the card → /dashboard/workspaces/{slug}/prospects
 */
export default async function PickerHome() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const cards = await workspacePickerCards(user);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <Link href="/" className="inline-flex items-center">
            <Wordmark tone="forest" className="h-7" />
          </Link>
          <PickerHeader user={user} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Wilson&rsquo;s Portal
            </p>
            <h1 className="app-heading mt-1 text-3xl text-[var(--color-charcoal)]">
              Choose a client
            </h1>
          </div>
          {user.role === "ADMIN" ? (
            <Button variant="accent" size="sm" asChild>
              <Link href="/dashboard/new-client">
                <Plus className="h-4 w-4" /> New workspace
              </Link>
            </Button>
          ) : null}
        </div>

        {cards.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center text-sm text-[var(--color-muted-foreground)]">
            You don&rsquo;t have access to any workspaces yet.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((c) => (
              <WorkspaceCard key={c.id} card={c} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

type Card = Awaited<ReturnType<typeof workspacePickerCards>>[number];

function WorkspaceCard({ card }: { card: Card }) {
  const lastActivity = card.lastActivity
    ? formatDistanceToNowStrict(card.lastActivity, { addSuffix: false })
    : null;

  return (
    <li>
      <Link
        href={`/dashboard/workspaces/${card.slug}/prospects`}
        className="group relative flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] transition-shadow hover:border-[var(--color-forest)] hover:shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start justify-between gap-3">
          <WorkspaceLogo
            name={card.name}
            logoUrl={card.logoUrl}
            accentColor={card.accentColor}
            size="lg"
          />
          {/* Disabled favourites toggle — visual placeholder for V2.
              Rendered as a span (not a button) because this lives in a server
              component and onClick handlers can't cross the RSC boundary.
              The wrapping <Link> swallows clicks anyway. */}
          <span
            aria-label="Star (coming soon)"
            aria-disabled
            className="shrink-0 rounded-md p-1 text-[var(--color-charcoal-200)]"
          >
            <Star className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--color-forest)]">
            {card.name}
          </div>
          <div className="truncate text-[11px] text-[var(--color-muted-foreground)]">
            {card.contactName}
          </div>
        </div>

        <div className="mt-3 flex-1">
          <div className="text-base font-semibold text-[var(--color-charcoal)]">
            {card.awaiting}{" "}
            <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
              awaiting your decision
            </span>
          </div>
          <div className="mt-0.5 text-xs text-[var(--color-charcoal-300)]">
            {card.total} total{" "}
            {card.total === 1 ? "prospect" : "prospects"}
          </div>
          {card.avgIcp !== null ? (
            <div className="mt-0.5 text-xs text-[var(--color-charcoal-300)]">
              Avg ICP score: {card.avgIcp.toFixed(1)} / 4
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <AvatarStack members={card.members} />
          {lastActivity ? (
            <span className="text-[10px] text-[var(--color-muted-foreground)]">
              {lastActivity}
            </span>
          ) : (
            <span className="text-[10px] text-[var(--color-muted-foreground)]">
              No activity
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function AvatarStack({
  members,
}: {
  members: { id: string; name: string; image: string | null }[];
}) {
  const visible = members.slice(0, 3);
  const extra = Math.max(0, members.length - 3);
  return (
    <div className="flex -space-x-2">
      {visible.map((m) => (
        <span
          key={m.id}
          className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-forest)] text-[9px] font-semibold text-[var(--color-lime)]"
          title={m.name}
        >
          {m.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.image}
              alt={m.name}
              className="h-full w-full object-cover"
            />
          ) : (
            initials(m.name)
          )}
        </span>
      ))}
      {extra > 0 ? (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-virgil-dark)] text-[9px] font-semibold text-[var(--color-charcoal-500)]">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

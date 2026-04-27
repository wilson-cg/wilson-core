import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MarkW, Wordmark } from "@/components/brand/wordmark";
import { ArrowRight } from "lucide-react";

/**
 * Internal design-system showcase. Use this page to sanity-check the brand
 * vocabulary before pointing real features at it. Not linked from customer
 * surfaces.
 */
const SWATCHES = [
  { name: "Forest Green", hex: "#17614F", token: "--color-forest", text: "white" },
  { name: "Virgil White", hex: "#F9F5EE", token: "--color-virgil", text: "forest" },
  { name: "Lime Green", hex: "#CAF530", token: "--color-lime", text: "forest" },
  { name: "Raspberry Lemonade", hex: "#EB595C", token: "--color-raspberry", text: "white" },
  { name: "Charcoal", hex: "#1C2D22", token: "--color-charcoal", text: "white" },
  { name: "Bee", hex: "#FAD85A", token: "--color-bee", text: "forest" },
  { name: "Teal", hex: "#97BDA5", token: "--color-teal", text: "forest" },
  { name: "Aperol Orange", hex: "#F1900A", token: "--color-aperol", text: "white" },
  { name: "Grapefruit", hex: "#F6BDB3", token: "--color-grapefruit", text: "forest" },
] as const;

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <Wordmark tone="forest" className="h-8" />
          <h1 className="app-heading mt-6 text-4xl text-[var(--color-forest)]">
            Design system
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Internal vocabulary. Source: Wilson Group Concept One brand deck,
            April 2026.
          </p>
        </div>
        <MarkW tone="forest" className="h-16 w-16" />
      </header>

      {/* ── Colour ── */}
      <Section title="Colour palette">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {SWATCHES.map((s) => (
            <div
              key={s.hex}
              className="rounded-[var(--radius-lg)] border shadow-[var(--shadow-soft)]"
              style={{ background: s.hex, color: s.text === "white" ? "#fff" : "#17614F" }}
            >
              <div className="flex min-h-32 flex-col justify-between p-5">
                <span className="text-xs font-medium opacity-80">{s.token}</span>
                <div>
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="font-mono text-xs opacity-80">{s.hex}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Typography ── */}
      <Section title="Typography">
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-bee)] bg-[var(--color-bee)]/20 p-4">
          <p className="text-sm text-[var(--color-charcoal)]">
            <span className="font-semibold">Rule:</span> Instrument Serif
            (display + italic) is for the{" "}
            <strong>marketing site, brand graphics, and the wordmark</strong>{" "}
            only. Inside the product UI — every dashboard, form, table, modal,
            settings page — use the <code>app-heading</code> utility (Inter,
            semibold, tight tracking).
          </p>
        </div>

        <div className="space-y-6 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
          <div>
            <LabelRow label="Marketing / Display 72 · Instrument Serif" />
            <p className="font-display text-7xl leading-[1.05] text-[var(--color-forest)]">
              Connecting <span className="display-italic">you</span> with your perfect buyer.
            </p>
          </div>
          <div>
            <LabelRow label="Marketing / Display 48 · Instrument Serif" />
            <p className="font-display text-5xl text-[var(--color-charcoal)]">
              We keep it <span className="display-italic">human.</span>
            </p>
          </div>

          <div className="border-t border-[var(--color-border)] pt-6">
            <LabelRow label="App / Page title (app-heading, 28)" />
            <p className="app-heading text-3xl text-[var(--color-forest)]">
              Review the approval queue
            </p>
          </div>
          <div>
            <LabelRow label="App / Section heading (app-heading, 18)" />
            <p className="app-heading text-lg text-[var(--color-forest)]">
              Your workspaces
            </p>
          </div>
          <div>
            <LabelRow label="App / Card title (app-heading, 18)" />
            <p className="app-heading text-lg text-[var(--color-forest)]">
              Condor Group
            </p>
          </div>
          <div>
            <LabelRow label="Body / 14 · Inter" />
            <p className="max-w-xl text-sm text-[var(--color-charcoal-500)]">
              Body copy uses Inter at 14 for dense dashboards and 16 for reading
              surfaces. Keep line length under 70 characters.
            </p>
          </div>
          <div>
            <LabelRow label="Caption / 12 · uppercase" />
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Last updated 14 minutes ago
            </p>
          </div>
        </div>
      </Section>

      {/* ── Buttons ── */}
      <Section title="Buttons">
        <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
          <p className="mb-4 text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Variants
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary · Save changes</Button>
            <Button variant="accent">
              Accent · Start Here <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link styled</Button>
          </div>

          <p className="mb-4 mt-8 text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Sizes (heights: sm 32 · md 40 · lg 48)
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>

          <p className="mb-4 mt-8 text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Hierarchy rule — pick ONE primary per surface
          </p>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <Rule
              kind="Primary"
              meaning="The single most-wanted action on a screen. Use accent (lime) for destination CTAs, primary (forest) for commits."
            />
            <Rule
              kind="Secondary"
              meaning="Outline. Co-equal actions, alternate paths, Cancel."
            />
            <Rule
              kind="Tertiary"
              meaning="Ghost. Optional actions, low-stakes toggles, Reject buttons."
            />
          </div>
        </div>
      </Section>

      {/* ── Badges / status ── */}
      <Section title="Status badges">
        <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
          <p className="mb-3 text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Prospect pipeline
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="identified">Identified</Badge>
            <Badge variant="drafted">Drafted</Badge>
            <Badge variant="pending">Pending</Badge>
            <Badge variant="approved">Approved</Badge>
            <Badge variant="sent">Sent</Badge>
            <Badge variant="replied">Replied</Badge>
            <Badge variant="meeting">Meeting booked</Badge>
            <Badge variant="rejected">Rejected</Badge>
            <Badge variant="nurture">Nurture</Badge>
          </div>

          <p className="mt-6 mb-3 text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Accent chips
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">7 waiting</Badge>
            <Badge variant="forest">New client</Badge>
            <Badge variant="default">Neutral tag</Badge>
          </div>
        </div>
      </Section>

      {/* ── Forms ── */}
      <Section title="Form inputs">
        <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-charcoal-500)]">
                Prospect name
              </label>
              <Input placeholder="Jane Doe" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-charcoal-500)]">
                LinkedIn URL (stored as prospect reference only)
              </label>
              <Input placeholder="https://linkedin.com/in/jane-doe" />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Cards ── */}
      <Section title="Cards">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Cream surface card</CardTitle>
              <CardDescription>
                Default container — sits on Virgil White background.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--color-charcoal-500)]">
                Use for dashboards, prospect rows, approval cards, metric
                panels.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[var(--color-forest)] text-[var(--color-virgil)]">
            <CardHeader>
              <CardTitle className="text-[var(--color-virgil)]">
                Forest surface card
              </CardTitle>
              <CardDescription className="text-[var(--color-virgil)]/70">
                Inverted treatment — matches the brand deck&apos;s hero panels.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--color-virgil)]/80">
                Use sparingly for hero CTAs, auth panels, empty states, the
                client workspace&apos;s approval hero.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── Voice ── */}
      <Section title="Voice & tone">
        <div className="grid gap-4 md:grid-cols-3">
          <VoiceCard
            word="Human"
            description="Warm, direct, written as a real person would speak. No buzzwords."
          />
          <VoiceCard
            word="Personal"
            description="Every message is for a specific person. The copy names them by name."
          />
          <VoiceCard
            word="Intentional"
            description="Every action is deliberate. Sending is manual. Approvals are explicit. Nothing fires by accident."
          />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <h2 className="app-heading mb-5 text-2xl text-[var(--color-forest)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function LabelRow({ label }: { label: string }) {
  return (
    <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
      {label}
    </p>
  );
}

function Rule({ kind, meaning }: { kind: string; meaning: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border bg-[var(--color-virgil)] p-4">
      <div className="app-heading text-sm text-[var(--color-forest)]">{kind}</div>
      <p className="mt-1 text-xs text-[var(--color-charcoal-500)]">{meaning}</p>
    </div>
  );
}

function VoiceCard({
  word,
  description,
}: {
  word: string;
  description: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
      <div className="app-heading text-xl text-[var(--color-forest)]">
        We keep it{" "}
        <span className="bg-[var(--color-lime)] px-1.5 font-semibold text-[var(--color-forest-950)]">
          {word}.
        </span>
      </div>
      <p className="mt-3 text-sm text-[var(--color-charcoal-500)]">
        {description}
      </p>
    </div>
  );
}

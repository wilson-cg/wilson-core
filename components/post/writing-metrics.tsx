"use client";

/**
 * Writing metrics panel for the post editor. Live counters that update
 * as the user types — char count, word count, read time, line count,
 * hashtag count + soft warnings tuned for LinkedIn:
 *   - Sweet spot: 1200-1500 chars (per LinkedIn engagement studies)
 *   - Truncation cut-off: 210 chars (where "see more" appears in feed)
 *   - Hashtag count: ideal 3-5
 */
export function WritingMetrics({ body }: { body: string }) {
  const text = body ?? "";
  const chars = text.length;
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const lines = text === "" ? 0 : text.split("\n").length;
  const hashtags = (text.match(/#\w+/g) ?? []).length;
  const readMinutes = Math.max(1, Math.round(words / 200));

  // Soft signals — LinkedIn truncates at ~140 chars on mobile, the first
  // paragraph break, whichever comes first. We treat anything past 140
  // chars OR with an early \n\n as truncated for the warning.
  const firstParaBreak = text.indexOf("\n\n");
  const truncated = chars > 140 || (firstParaBreak !== -1 && firstParaBreak < chars);
  const tooShort = chars > 0 && chars < 200;
  const sweetSpot = chars >= 1200 && chars <= 1500;
  const tooLong = chars > 3000; // LinkedIn hard cap is 3000

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Characters"
          value={chars.toLocaleString()}
          tone={tooLong ? "error" : sweetSpot ? "good" : "neutral"}
        />
        <Metric label="Words" value={words.toLocaleString()} tone="neutral" />
        <Metric
          label="Read time"
          value={`${readMinutes} min`}
          tone="neutral"
        />
        <Metric label="Hashtags" value={hashtags.toString()} tone="neutral" />
      </div>

      {chars > 0 ? (
        <div className="space-y-1.5 text-[11px]">
          {truncated ? (
            <Hint tone="info">
              Will truncate at ~140 chars on mobile (or the first paragraph
              break) — readers click &ldquo;see more&rdquo; to expand. The
              first line does the work.
            </Hint>
          ) : null}
          {sweetSpot ? (
            <Hint tone="good">
              In the engagement sweet spot (1,200–1,500 chars).
            </Hint>
          ) : null}
          {tooShort ? (
            <Hint tone="warn">
              Short posts can land — but you&apos;ve got room. LinkedIn favours
              200+ char posts.
            </Hint>
          ) : null}
          {tooLong ? (
            <Hint tone="error">
              Over LinkedIn&apos;s 3,000 character limit — won&apos;t post.
            </Hint>
          ) : null}
          {hashtags > 5 ? (
            <Hint tone="warn">
              {hashtags} hashtags — 3-5 tends to perform better than more.
            </Hint>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "error" | "neutral";
}) {
  const ring = {
    good: "ring-1 ring-[var(--color-lime)] bg-[var(--color-lime)]/10",
    warn: "ring-1 ring-[var(--color-bee)] bg-[var(--color-bee)]/10",
    error: "ring-1 ring-[var(--color-raspberry)] bg-[var(--color-raspberry)]/10",
    neutral: "bg-[var(--color-virgil)]",
  }[tone];

  return (
    <div className={`rounded-[var(--radius-md)] px-3 py-2 ${ring}`}>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold text-[var(--color-charcoal)]">
        {value}
      </p>
    </div>
  );
}

function Hint({
  tone,
  children,
}: {
  tone: "good" | "warn" | "error" | "info";
  children: React.ReactNode;
}) {
  const cls = {
    good: "text-[var(--color-forest)]",
    warn: "text-[var(--color-aperol)]",
    error: "text-[var(--color-raspberry)]",
    info: "text-[var(--color-charcoal-500)]",
  }[tone];
  return <p className={`flex items-start gap-1 ${cls}`}>{children}</p>;
}

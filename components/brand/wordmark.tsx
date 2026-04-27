import { cn } from "@/lib/utils";

/**
 * Wilson's wordmark — rendered as a text SVG using Instrument Serif Italic
 * to match the brand deck's elegant script logotype without shipping a
 * licensed typeface. The pixel-stepped W-drop in the deck is approximated
 * here with the italic flourish of Instrument Serif. Swap for the licensed
 * Wilson's wordmark asset when the design team delivers it.
 */
export function Wordmark({
  className,
  tone = "forest",
}: {
  className?: string;
  tone?: "forest" | "virgil" | "lime";
}) {
  const fill =
    tone === "forest"
      ? "var(--color-forest)"
      : tone === "lime"
      ? "var(--color-lime)"
      : "var(--color-virgil)";

  return (
    <svg
      viewBox="0 0 240 80"
      className={cn("h-10 w-auto", className)}
      aria-label="Wilson's"
      role="img"
    >
      <text
        x="50%"
        y="58%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontStyle="italic"
        fontSize="56"
        fill={fill}
      >
        Wilson&apos;s
      </text>
    </svg>
  );
}

/**
 * Small `W` mark for avatars, favicons, loading states.
 */
export function MarkW({
  className,
  tone = "forest",
}: {
  className?: string;
  tone?: "forest" | "virgil" | "lime";
}) {
  const fill =
    tone === "forest"
      ? "var(--color-forest)"
      : tone === "lime"
      ? "var(--color-lime)"
      : "var(--color-virgil)";

  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("h-6 w-6", className)}
      aria-label="Wilson's mark"
      role="img"
    >
      <text
        x="50%"
        y="62%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontStyle="italic"
        fontSize="36"
        fill={fill}
      >
        W
      </text>
    </svg>
  );
}

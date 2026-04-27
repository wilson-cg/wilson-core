import { cn } from "@/lib/utils";

/**
 * Workspace logo block — uses logoUrl if present (paste-URL or data: URL),
 * falls back to an initial-on-accent avatar matching the rest of the brand.
 */
export function WorkspaceLogo({
  name,
  logoUrl,
  accentColor,
  size = "md",
  className,
}: {
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim = {
    sm: "h-7 w-7 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
  }[size];

  const initial = name.charAt(0).toUpperCase();

  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={cn(
          "shrink-0 rounded-md object-cover",
          dim,
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md font-semibold text-[var(--color-lime)]",
        dim,
        className
      )}
      style={{ background: accentColor ?? "var(--color-forest)" }}
    >
      {initial}
    </div>
  );
}

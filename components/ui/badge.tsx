import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        // Neutral
        default:
          "bg-[var(--color-surface-muted)] text-[var(--color-charcoal)] border border-[var(--color-border)]",
        // Lime — matches the Granola pill + Wilson's accent
        accent:
          "bg-[var(--color-lime)] text-[var(--color-forest-950)] font-semibold",
        // Forest — strong status
        forest:
          "bg-[var(--color-forest)] text-[var(--color-virgil)]",
        // Prospect status chips — mapped to Wilson's palette
        identified:
          "bg-white text-[var(--color-charcoal-500)] border border-[var(--color-border-strong)]",
        drafted:
          "bg-[var(--color-forest-100)] text-[var(--color-forest-900)]",
        pending:
          "bg-[var(--color-bee)] text-[var(--color-charcoal)] font-semibold",
        approved:
          "bg-[var(--color-lime)] text-[var(--color-forest-950)] font-semibold",
        sent:
          "bg-[var(--color-teal)] text-[var(--color-forest-950)]",
        replied:
          "bg-[var(--color-aperol)] text-white font-semibold",
        meeting:
          "bg-[var(--color-forest)] text-[var(--color-lime)] font-semibold",
        rejected:
          "bg-[var(--color-raspberry)] text-white",
        nurture:
          "bg-[var(--color-grapefruit)] text-[var(--color-charcoal)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };

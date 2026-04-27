import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button primitive. Supports `asChild` (shadcn-style) — when true, the
 * button's classes + props are merged onto the single child element via
 * Radix Slot instead of rendering a <button> wrapper. This prevents
 * invalid HTML like <button><a/></button> (which breaks flex layout and
 * wraps icons to the next line).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] active:translate-y-[1px] [&_svg]:shrink-0 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-forest)] text-[var(--color-virgil)] hover:bg-[var(--color-forest-900)] shadow-[var(--shadow-soft)]",
        accent:
          "bg-[var(--color-lime)] text-[var(--color-forest-950)] hover:bg-[var(--color-lime-dark)] font-semibold shadow-[var(--shadow-soft)]",
        outline:
          "border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-forest)] hover:bg-[var(--color-surface-muted)]",
        ghost:
          "text-[var(--color-charcoal)] hover:bg-[var(--color-surface-muted)]",
        ghostOnDark:
          "text-[var(--color-virgil)] hover:bg-white/10",
        destructive:
          "bg-[var(--color-raspberry)] text-white hover:opacity-90 shadow-[var(--shadow-soft)]",
        link: "text-[var(--color-forest)] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 py-2",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={ref as any}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };

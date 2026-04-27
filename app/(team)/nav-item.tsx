"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Client island for sidebar links. We can't accept a component reference
 * (like a lucide Icon) as a prop from a server component in React 19 —
 * instead the server component renders the icon as `children` and we
 * position it here.
 */
export function NavItemClient({
  href,
  children,
  label,
  badge,
  exact,
}: {
  href: string;
  children: React.ReactNode;
  label: string;
  badge?: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
        active
          ? "bg-[var(--color-surface)] font-medium text-[var(--color-forest)] shadow-[var(--shadow-soft)]"
          : "text-[var(--color-charcoal-500)] hover:bg-white/60 hover:text-[var(--color-charcoal)]"
      }`}
    >
      {children}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-lime)] px-1 text-[10px] font-semibold text-[var(--color-forest-950)]">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

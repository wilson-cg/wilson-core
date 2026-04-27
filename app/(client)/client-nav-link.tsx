"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ClientNavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-[var(--color-forest-100)] font-medium text-[var(--color-forest-900)]"
          : "text-[var(--color-charcoal-500)] hover:bg-[var(--color-virgil-dark)] hover:text-[var(--color-charcoal)]"
      }`}
    >
      {label}
    </Link>
  );
}

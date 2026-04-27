"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global keyboard shortcut for "new post". Two bindings:
 *
 *   ⌘⇧N / Ctrl+Shift+N — works in any context, including when an
 *                         input has focus
 *   N (single key)     — fires only when no input/textarea has focus,
 *                         like Linear's quick shortcuts. Lowercase 'n'
 *                         only; capital N (with Shift) collapses into
 *                         the Cmd+Shift+N binding above.
 *
 * Why not ⌘N: browsers reserve Cmd+N for "new window" and will not
 * allow JS to override it. ⌘⇧N is the conventional product-side
 * substitute (used by Notion, Slack, Linear's "New issue").
 */
export function useNewPostShortcut(href: string) {
  const router = useRouter();

  useEffect(() => {
    function isTyping(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function onKey(e: KeyboardEvent) {
      // ⌘⇧N / Ctrl+Shift+N — works everywhere
      const isModN =
        (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n";
      if (isModN) {
        e.preventDefault();
        router.push(href);
        return;
      }

      // Single-key N — only when not typing in a field
      if (
        e.key === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        !isTyping(e.target)
      ) {
        e.preventDefault();
        router.push(href);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href, router]);
}

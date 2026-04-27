"use client";

import { useEffect } from "react";

/**
 * Guards against losing unsaved work. Two layers:
 *
 *   1. `beforeunload` — fires on tab close / refresh / hard navigation.
 *      Browsers strictly limit the message; modern browsers show a
 *      generic "Changes you made may not be saved" prompt.
 *
 *   2. Anchor click intercept — App Router's `<Link>` doesn't fire
 *      `beforeunload`. We listen for clicks on `<a>` elements inside
 *      the document and run a confirm() before letting them through.
 *      Bypass with `data-skip-guard="true"` on the anchor.
 *
 * `onConfirmedExit` runs only when the user confirms leaving — useful
 * for firing a final auto-save before the browser actually navigates.
 */
export function useUnsavedGuard(
  enabled: boolean,
  message = "You have unsaved changes. Save the draft before leaving?"
) {
  useEffect(() => {
    if (!enabled) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // The string return is legacy but some browsers still honour it.
      e.returnValue = message;
      return message;
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      if (anchor.dataset.skipGuard === "true") return;
      // Same-document hash links — fine
      if (anchor.getAttribute("href")?.startsWith("#")) return;

      // Modifier-click should still work (open in new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const ok = window.confirm(message);
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, [enabled, message]);
}

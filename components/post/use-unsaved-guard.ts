"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

/**
 * Guards against losing unsaved work. Two layers:
 *
 *   1. `beforeunload` — fires on tab close / refresh / hard navigation.
 *      Browsers strip custom messages and show the system prompt; we
 *      can't brand this one (it's a hardware-level safeguard).
 *
 *   2. Anchor click intercept — App Router's `<Link>` doesn't fire
 *      `beforeunload`. We listen for clicks on `<a>` elements inside
 *      the document, intercept them, and ask the user via the branded
 *      Wilson's confirm modal. If they confirm, we run the navigation
 *      manually via `router.push` so the SPA transition still works.
 *      Bypass with `data-skip-guard="true"` on the anchor.
 */
export function useUnsavedGuard(
  enabled: boolean,
  message = "You have unsaved changes. Save the draft before leaving?"
) {
  const { confirm } = useToast();
  const router = useRouter();

  // Stable refs so the click handler closure stays current without
  // re-binding on every keystroke (which would lose the in-flight click).
  const enabledRef = useRef(enabled);
  const messageRef = useRef(message);
  enabledRef.current = enabled;
  messageRef.current = message;

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!enabledRef.current) return;
      e.preventDefault();
      // Modern browsers ignore returnValue text and show their own prompt.
      e.returnValue = "";
    }

    function onClick(e: MouseEvent) {
      if (!enabledRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      if (anchor.dataset.skipGuard === "true") return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#")) return; // same-doc hash links
      if (/^https?:\/\//i.test(href)) return; // external — let beforeunload handle it
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // open-in-new-tab etc.

      e.preventDefault();
      e.stopPropagation();

      confirm({
        title: "Leave without saving?",
        description: messageRef.current,
        confirmLabel: "Leave",
        cancelLabel: "Keep editing",
        destructive: true,
      }).then((ok) => {
        if (ok) router.push(href);
      });
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, [confirm, router]);
}

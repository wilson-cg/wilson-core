"use client";

import { useNewPostShortcut } from "@/components/post/use-new-post-shortcut";

/**
 * Tiny client island whose only job is registering the global keyboard
 * shortcut for "new post" on this page. Renders no UI.
 */
export function NewPostShortcut({ href }: { href: string }) {
  useNewPostShortcut(href);
  return null;
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Bold,
  Italic,
  Smile,
  Image as ImageIcon,
  X,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Card-style post editor. Replaces the plain textarea on post pages.
 *
 * Owns: text content state, toolbar (bold/italic markers, emoji), and
 * the media drag-and-drop / file-input upload zone.
 *
 * NOTE: LinkedIn renders posts as plain text (no markdown). We surface
 * "Bold/Italic" as Unicode formatters that LinkedIn accepts (mathematical
 * alphanumeric symbols look bold/italic in feed). It's a real, supported
 * trick on LinkedIn — preserves through the API and clipboard.
 */

const BOLD_OFFSETS = {
  upper: 0x1d400 - 65, // A
  lower: 0x1d41a - 97, // a
};
const ITALIC_OFFSETS = {
  upper: 0x1d434 - 65,
  lower: 0x1d44e - 97,
};

function transformAscii(text: string, offset: { upper: number; lower: number }) {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (!code) continue;
    if (code >= 65 && code <= 90) {
      out += String.fromCodePoint(code + offset.upper);
    } else if (code >= 97 && code <= 122) {
      out += String.fromCodePoint(code + offset.lower);
    } else {
      out += ch;
    }
  }
  return out;
}

export type EditorMedia = {
  id?: string; // server id once persisted
  tempId?: string; // local id for optimistic add
  url: string; // data URL or remote URL
  filename: string | null;
  contentType: string | null;
};

export function PostEditor({
  body,
  onBodyChange,
  media,
  onAddMedia,
  onRemoveMedia,
  pending,
  placeholder,
  minHeight = 280,
}: {
  body: string;
  onBodyChange: (next: string) => void;
  media: EditorMedia[];
  onAddMedia: (file: File, dataUrl: string) => Promise<void>;
  onRemoveMedia: (m: EditorMedia) => Promise<void>;
  pending?: boolean;
  placeholder?: string;
  minHeight?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();

  // Lazy-load emoji-picker-element on first toggle (it registers a custom
  // element globally — only do it client-side, only when needed).
  useEffect(() => {
    if (!emojiOpen) return;
    void import("emoji-picker-element");
  }, [emojiOpen]);

  function getSelection() {
    const el = textareaRef.current;
    if (!el) return { start: 0, end: 0 };
    return { start: el.selectionStart, end: el.selectionEnd };
  }

  function applyTransform(transform: (s: string) => string) {
    const { start, end } = getSelection();
    if (start === end) return; // need a selection
    const before = body.slice(0, start);
    const selected = body.slice(start, end);
    const after = body.slice(end);
    const replaced = transform(selected);
    const next = before + replaced + after;
    onBodyChange(next);
    // Restore selection on the next tick
    setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, start + replaced.length);
    }, 0);
  }

  function insertAtCursor(insert: string) {
    const { start, end } = getSelection();
    const next = body.slice(0, start) + insert + body.slice(end);
    onBodyChange(next);
    setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = start + insert.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      alert("Only image files are supported (PNG, JPEG, GIF, WEBP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Max 2MB per image. Compress before uploading.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      startTransition(async () => {
        await onAddMedia(file, dataUrl);
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-t-[var(--radius-lg)] border border-b-0 border-[var(--color-border)] bg-[var(--color-virgil)] px-2 py-1.5">
        <ToolbarButton
          title="Bold (Unicode — works in the LinkedIn feed)"
          onClick={() =>
            applyTransform((s) => transformAscii(s, BOLD_OFFSETS))
          }
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic (Unicode — works in the LinkedIn feed)"
          onClick={() =>
            applyTransform((s) => transformAscii(s, ITALIC_OFFSETS))
          }
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          title="Insert emoji"
          onClick={() => setEmojiOpen((v) => !v)}
          active={emojiOpen}
        >
          <Smile className="h-3.5 w-3.5" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          title="Add image"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        {pending ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
            <Loader2 className="h-3 w-3 animate-spin" /> saving
          </span>
        ) : null}
      </div>

      {/* Textarea + drop zone wrapper */}
      <div
        className={`rounded-b-[var(--radius-lg)] border border-t-0 bg-[var(--color-surface)] shadow-[var(--shadow-soft)] -mt-3 transition-colors ${
          dragOver
            ? "border-[var(--color-forest)] ring-2 ring-[var(--color-forest)]/30"
            : "border-[var(--color-border)]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder={
            placeholder ?? "Write something worth reading…"
          }
          className="w-full resize-y border-0 bg-transparent p-5 font-sans text-[15px] leading-relaxed text-[var(--color-charcoal)] outline-none placeholder:italic placeholder:text-[var(--color-muted-foreground)]"
          style={{ minHeight }}
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = ""; // allow re-uploading the same file
          }}
          className="hidden"
        />

        {/* Drag overlay */}
        {dragOver ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-b-[var(--radius-lg)] bg-[var(--color-forest)]/5 text-sm font-medium text-[var(--color-forest)]">
            Drop image to attach
          </div>
        ) : null}

        {/* Media row */}
        {media.length > 0 ? (
          <div className="border-t border-[var(--color-border)] p-3">
            <div className="flex flex-wrap gap-2">
              {media.map((m) => (
                <MediaThumb
                  key={m.id ?? m.tempId ?? m.url}
                  m={m}
                  onRemove={() => onRemoveMedia(m)}
                />
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] text-[var(--color-charcoal-300)] hover:border-[var(--color-forest)] hover:text-[var(--color-forest)]"
              >
                <ImageIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-[var(--color-muted-foreground)]">
              Up to 2MB per file. Attached images go through the same approval
              flow as the post body.
            </p>
          </div>
        ) : (
          <div className="border-t border-[var(--color-border)] px-4 py-2.5 text-[11px] text-[var(--color-muted-foreground)]">
            Drag an image here, or{" "}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="font-medium text-[var(--color-forest)] hover:underline"
            >
              browse files
            </button>
            .
          </div>
        )}
      </div>

      {/* Emoji picker — lazy-loaded web component */}
      {emojiOpen ? (
        <div className="relative">
          <div className="absolute right-0 top-0 z-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-lifted)]">
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Insert emoji
              </span>
              <button
                type="button"
                onClick={() => setEmojiOpen(false)}
                aria-label="Close emoji picker"
                className="text-[var(--color-charcoal-300)] hover:text-[var(--color-charcoal)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* @ts-expect-error — emoji-picker-element registers a custom element at runtime */}
            <emoji-picker
              ref={(el: HTMLElement | null) => {
                if (!el) return;
                el.addEventListener(
                  "emoji-click",
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ((e: any) => {
                    const unicode = e.detail?.unicode as string;
                    if (unicode) {
                      insertAtCursor(unicode);
                      setEmojiOpen(false);
                    }
                  }) as EventListener
                );
              }}
              style={{
                "--background": "var(--color-surface)",
                "--input-border-color": "var(--color-border)",
              } as React.CSSProperties}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors ${
        active
          ? "bg-[var(--color-forest)] text-[var(--color-virgil)]"
          : "text-[var(--color-charcoal-500)] hover:bg-white hover:text-[var(--color-charcoal)]"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-4 w-px bg-[var(--color-border)]" />;
}

function MediaThumb({
  m,
  onRemove,
}: {
  m: EditorMedia;
  onRemove: () => void;
}) {
  return (
    <div className="group relative h-20 w-20 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={m.url}
        alt={m.filename ?? "Attached image"}
        className="h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove image"
        className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow-[var(--shadow-soft)] transition-opacity group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

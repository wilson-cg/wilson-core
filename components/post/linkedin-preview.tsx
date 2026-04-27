"use client";

import { useState } from "react";
import { ThumbsUp, MessageCircle, Repeat2, Send } from "lucide-react";
import { WorkspaceLogo } from "@/components/settings/workspace-logo";

/**
 * LinkedIn-feed-style preview of a post. Approximates the real cut-off
 * behaviour: shows a Read More link after 210 characters so the team
 * can see how the post will appear before someone clicks expand.
 *
 * Pure presentation — controlled by parent via `body`.
 */
export function LinkedInPreview({
  body,
  media,
  workspaceName,
  workspaceLogoUrl,
  workspaceAccentColor,
  contactName,
  contactTitle,
}: {
  body: string;
  media?: { url: string; filename: string | null }[];
  workspaceName: string;
  workspaceLogoUrl: string | null;
  workspaceAccentColor: string | null;
  contactName: string;
  contactTitle: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const TRUNCATION_CHARS = 210;
  const willTruncate = body.length > TRUNCATION_CHARS;
  const visibleBody =
    !expanded && willTruncate ? body.slice(0, TRUNCATION_CHARS).trimEnd() : body;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <span>LinkedIn preview</span>
        <span className="rounded-full bg-[var(--color-virgil-dark)] px-1.5 py-px text-[9px]">
          approximate
        </span>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white p-4 shadow-[var(--shadow-soft)]">
        {/* Author row */}
        <header className="flex items-center gap-2.5">
          <WorkspaceLogo
            name={workspaceName}
            logoUrl={workspaceLogoUrl}
            accentColor={workspaceAccentColor}
            size="md"
            className="!rounded-full"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#0A66C2]">
              {contactName}
            </div>
            <div className="truncate text-[11px] text-[#666]">
              {contactTitle ?? workspaceName}
            </div>
            <div className="text-[10px] text-[#666]">
              now · <span aria-hidden>🌎</span>
            </div>
          </div>
        </header>

        {/* Body — LinkedIn-ish rendering: preserve newlines, no rich formatting */}
        <div className="mt-3 whitespace-pre-line break-words text-[14px] leading-relaxed text-[#191919]">
          {body.length === 0 ? (
            <span className="italic text-[#999]">
              Start writing to see the preview…
            </span>
          ) : (
            <>
              {visibleBody}
              {willTruncate && !expanded ? (
                <>
                  …{" "}
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="font-medium text-[#666] hover:underline"
                  >
                    see more
                  </button>
                </>
              ) : null}
              {willTruncate && expanded ? (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="font-medium text-[#666] hover:underline"
                  >
                    show less
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>

        {/* Attached media */}
        {media && media.length > 0 ? (
          <div
            className={`mt-3 grid gap-1 overflow-hidden rounded-[8px] ${
              media.length === 1
                ? "grid-cols-1"
                : media.length === 2
                ? "grid-cols-2"
                : "grid-cols-2"
            }`}
          >
            {media.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={m.url}
                alt={m.filename ?? `Attachment ${i + 1}`}
                className={`w-full object-cover ${
                  media.length === 1 ? "max-h-72" : "h-32"
                }`}
              />
            ))}
          </div>
        ) : null}

        {/* Reaction strip — visual only */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-2 text-[#666]">
          <Reaction icon={ThumbsUp} label="Like" />
          <Reaction icon={MessageCircle} label="Comment" />
          <Reaction icon={Repeat2} label="Repost" />
          <Reaction icon={Send} label="Send" />
        </div>
      </div>
    </div>
  );
}

function Reaction({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

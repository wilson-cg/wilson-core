"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Save, Sparkles, Trash2 } from "lucide-react";
import { PostEditor, type EditorMedia } from "@/components/post/post-editor";
import { LinkedInPreview } from "@/components/post/linkedin-preview";
import { WritingMetrics } from "@/components/post/writing-metrics";
import { ImprovementsSidebar } from "@/components/post/improvements-sidebar";
import { useUnsavedGuard } from "@/components/post/use-unsaved-guard";
import { draftPost } from "@/lib/actions";

/**
 * New-post workbench. Mirrors the look of the post-detail workbench so
 * the team has the same writing tools (toolbar, emoji, metrics, preview,
 * improvements sidebar) on day one — but media is held locally until
 * the first save creates the post row.
 *
 * On save, draftPost() redirects to /content/[id] where media + further
 * edits persist normally.
 */
type Props = {
  slug: string;
  workspaceName: string;
  workspaceLogoUrl: string | null;
  workspaceAccentColor: string | null;
  contactName: string;
  contactTitle: string | null;
};

export function NewPostWorkbench(props: Props) {
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [media, setMedia] = useState<EditorMedia[]>([]);
  const [showImprovements, setShowImprovements] = useState(true);
  const [savePending, startSave] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Guard against losing typed work. The form submission below sets dirty
  // back to false right before submitting (via setSavingNow) so the
  // navigation away after draftPost() doesn't trigger the prompt.
  const [savingNow, setSavingNow] = useState(false);
  const dirty =
    !savingNow && (body.trim().length > 0 || title.trim().length > 0 || media.length > 0);
  useUnsavedGuard(dirty, "Discard this draft? Click Cancel to save it instead.");

  // Local-only media: until the post is saved, attachments live in
  // component state. After save the user lands on /content/[id] where
  // attachments are real DB rows.
  async function handleAddMedia(file: File, dataUrl: string) {
    setMedia((m) => [
      ...m,
      {
        tempId: `tmp-${Date.now()}`,
        url: dataUrl,
        filename: file.name,
        contentType: file.type,
      },
    ]);
  }

  async function handleRemoveMedia(m: EditorMedia) {
    setMedia((arr) => arr.filter((x) => x !== m));
  }

  function saveDraft() {
    if (body.trim().length < 10) {
      alert("Add at least 10 characters before saving the draft.");
      return;
    }
    setSavingNow(true); // suppress the unsaved-guard for the redirect
    startSave(() => {
      // Submit the hidden form — draftPost will redirect to /content/[id]
      // where the user can re-attach media and continue editing.
      formRef.current?.requestSubmit();
    });
  }

  const mediaDeferred = media.length > 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* Hidden form posts to draftPost — the only way to redirect
            into the post-detail page where the full media flow lives. */}
        <form ref={formRef} action={draftPost} className="hidden">
          <input type="hidden" name="workspaceSlug" value={props.slug} />
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="body" value={body} />
        </form>

        <div className="flex items-center gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Working title (internal)"
            className="flex-1 text-base"
          />
          <Badge variant="drafted">New draft</Badge>
          {!showImprovements ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowImprovements(true)}
            >
              <Sparkles className="h-3.5 w-3.5" /> Improvements
            </Button>
          ) : null}
        </div>

        <PostEditor
          body={body}
          onBodyChange={setBody}
          media={media}
          onAddMedia={handleAddMedia}
          onRemoveMedia={handleRemoveMedia}
          pending={savePending}
          placeholder="Write your post — the first 2 lines do the work."
        />

        {mediaDeferred ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-bee)]/40 bg-[var(--color-bee)]/10 px-3 py-2 text-xs text-[var(--color-charcoal)]">
            <strong>Heads-up:</strong> attachments are pending. They&apos;ll
            be uploaded once you save the draft — you&apos;ll continue editing
            on the post page after that.
          </div>
        ) : null}

        <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
          <WritingMetrics body={body} />
        </div>

        <LinkedInPreview
          body={body}
          media={media.map((m) => ({ url: m.url, filename: m.filename }))}
          workspaceName={props.workspaceName}
          workspaceLogoUrl={props.workspaceLogoUrl}
          workspaceAccentColor={props.workspaceAccentColor}
          contactName={props.contactName}
          contactTitle={props.contactTitle}
        />

        <div className="sticky bottom-3 flex items-center gap-2 rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
          <Button
            type="button"
            variant="accent"
            onClick={saveDraft}
            disabled={savePending || body.trim().length < 10}
          >
            <Save className="h-4 w-4" />
            {savePending ? "Saving…" : "Save draft"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            asChild
          >
            <Link
              href={`/dashboard/workspaces/${props.slug}/content`}
              data-skip-guard="true"
              onClick={() => setSavingNow(true)}
            >
              <Trash2 className="h-4 w-4" /> Discard
            </Link>
          </Button>
          <span className="ml-auto text-[11px] text-[var(--color-muted-foreground)]">
            {dirty ? (
              <span className="font-medium text-[var(--color-aperol)]">
                Unsaved
              </span>
            ) : (
              "Save keeps it in 'In progress'."
            )}
          </span>
        </div>
      </div>

      {showImprovements ? (
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <ImprovementsSidebar
            text={body}
            onApplySuggestion={setBody}
            onClose={() => setShowImprovements(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

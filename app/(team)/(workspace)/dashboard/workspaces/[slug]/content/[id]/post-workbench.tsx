"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Save, Send, Sparkles } from "lucide-react";
import { PostEditor, type EditorMedia } from "@/components/post/post-editor";
import { LinkedInPreview } from "@/components/post/linkedin-preview";
import { WritingMetrics } from "@/components/post/writing-metrics";
import { ImprovementsSidebar } from "@/components/post/improvements-sidebar";
import {
  updatePostDraft,
  submitPostForApproval,
  addPostMedia,
  removePostMedia,
} from "@/lib/actions";

type Props = {
  postId: string;
  initialBody: string;
  initialTitle: string;
  status: string;
  rejectionNote: string | null;
  initialMedia: { id: string; url: string; filename: string | null; contentType: string | null }[];
  workspaceName: string;
  workspaceLogoUrl: string | null;
  workspaceAccentColor: string | null;
  contactName: string;
  contactTitle: string | null;
  canEdit: boolean;
};

/**
 * Post workbench client island. Orchestrates editor + preview +
 * improvements sidebar + media uploads. Server actions are called
 * directly from the inner forms / async handlers.
 */
export function PostWorkbench(props: Props) {
  const [body, setBody] = useState(props.initialBody);
  const [title, setTitle] = useState(props.initialTitle);
  const [media, setMedia] = useState<EditorMedia[]>(
    props.initialMedia.map((m) => ({
      id: m.id,
      url: m.url,
      filename: m.filename,
      contentType: m.contentType,
    }))
  );
  const [showImprovements, setShowImprovements] = useState(true);
  const [savePending, startSave] = useTransition();
  const [submitPending, startSubmit] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleAddMedia(file: File, dataUrl: string) {
    // Optimistic
    const tempId = `tmp-${Date.now()}`;
    setMedia((m) => [
      ...m,
      { tempId, url: dataUrl, filename: file.name, contentType: file.type },
    ]);
    try {
      const fd = new FormData();
      fd.set("postId", props.postId);
      fd.set("dataUrl", dataUrl);
      fd.set("filename", file.name);
      fd.set("contentType", file.type);
      await addPostMedia(fd);
    } catch (e) {
      console.error(e);
      setMedia((m) => m.filter((x) => x.tempId !== tempId));
      alert(e instanceof Error ? e.message : "Failed to attach image");
    }
  }

  async function handleRemoveMedia(m: EditorMedia) {
    if (!m.id) {
      // Was an optimistic add that hasn't persisted yet — just drop locally
      setMedia((arr) => arr.filter((x) => x !== m));
      return;
    }
    const prev = media;
    setMedia((arr) => arr.filter((x) => x.id !== m.id));
    try {
      const fd = new FormData();
      fd.set("mediaId", m.id);
      await removePostMedia(fd);
    } catch (e) {
      console.error(e);
      setMedia(prev);
      alert(e instanceof Error ? e.message : "Failed to remove image");
    }
  }

  function saveDraft() {
    startSave(async () => {
      const fd = new FormData();
      fd.set("postId", props.postId);
      fd.set("title", title);
      fd.set("body", body);
      try {
        await updatePostDraft(fd);
        setSavedAt(Date.now());
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function submitForApproval() {
    if (
      !confirm(
        "Submit this post to the client for approval? They'll get a notification."
      )
    ) {
      return;
    }
    startSubmit(async () => {
      // Save first to make sure latest body is persisted
      const saveFd = new FormData();
      saveFd.set("postId", props.postId);
      saveFd.set("title", title);
      saveFd.set("body", body);
      await updatePostDraft(saveFd);

      const fd = new FormData();
      fd.set("postId", props.postId);
      await submitPostForApproval(fd);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* Title row */}
        <div className="flex items-center gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Working title (internal)"
            disabled={!props.canEdit}
            className="flex-1 text-base"
          />
          <Badge variant={statusBadge(props.status)}>
            {humanizeStatus(props.status)}
          </Badge>
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

        {/* Rejection note */}
        {props.status === "REJECTED" && props.rejectionNote ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-raspberry)]/40 bg-[var(--color-raspberry)]/5 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-raspberry)]">
              Client rejected
            </p>
            <p className="mt-1 text-sm text-[var(--color-charcoal)]">
              &ldquo;{props.rejectionNote}&rdquo;
            </p>
          </div>
        ) : null}

        {/* Editor */}
        {props.canEdit ? (
          <PostEditor
            body={body}
            onBodyChange={setBody}
            media={media}
            onAddMedia={handleAddMedia}
            onRemoveMedia={handleRemoveMedia}
            pending={savePending || submitPending}
            placeholder="Write your post — the first 2 lines do the work."
          />
        ) : (
          <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--color-charcoal)]">
              {body}
            </p>
          </div>
        )}

        {/* Live metrics */}
        <div className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
          <WritingMetrics body={body} />
        </div>

        {/* LinkedIn preview */}
        <LinkedInPreview
          body={body}
          media={media}
          workspaceName={props.workspaceName}
          workspaceLogoUrl={props.workspaceLogoUrl}
          workspaceAccentColor={props.workspaceAccentColor}
          contactName={props.contactName}
          contactTitle={props.contactTitle}
        />

        {/* Action bar */}
        {props.canEdit ? (
          <div className="sticky bottom-3 flex items-center gap-2 rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
            <Button
              type="button"
              variant="outline"
              onClick={saveDraft}
              disabled={savePending || submitPending}
            >
              <Save className="h-4 w-4" />
              {savePending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={submitForApproval}
              disabled={savePending || submitPending || body.trim().length < 10}
            >
              <Send className="h-4 w-4" />
              {submitPending ? "Submitting…" : "Submit for approval"}
            </Button>
            <span className="ml-auto text-[11px] text-[var(--color-muted-foreground)]">
              {savedAt
                ? `Saved ${timeAgo(savedAt)}`
                : `Submitting notifies ${props.contactName}`}
            </span>
          </div>
        ) : null}
      </div>

      {/* Right rail */}
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

function statusBadge(s: string) {
  const map: Record<
    string,
    "drafted" | "pending" | "approved" | "sent" | "rejected"
  > = {
    DRAFT: "drafted",
    PENDING_APPROVAL: "pending",
    APPROVED: "approved",
    POSTED: "sent",
    REJECTED: "rejected",
  };
  return map[s] ?? "drafted";
}

function humanizeStatus(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function timeAgo(ts: number): string {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  return `${Math.round(sec / 60)}m ago`;
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Save, Send, Sparkles, Trash2 } from "lucide-react";
import { PostEditor, type EditorMedia } from "@/components/post/post-editor";
import { LinkedInPreview } from "@/components/post/linkedin-preview";
import { WritingMetrics } from "@/components/post/writing-metrics";
import { ImprovementsSidebar } from "@/components/post/improvements-sidebar";
import { useUnsavedGuard } from "@/components/post/use-unsaved-guard";
import { useToast } from "@/components/ui/toast";
import {
  updatePostDraft,
  submitPostForApproval,
  addPostMedia,
  removePostMedia,
  deletePost,
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
  const { toast, confirm } = useToast();
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
  const [deletePending, startDelete] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // "Dirty" if the user has changed body or title vs whatever was last
  // persisted. Media changes flush instantly so they don't count.
  const [lastSavedBody, setLastSavedBody] = useState(props.initialBody);
  const [lastSavedTitle, setLastSavedTitle] = useState(props.initialTitle);
  const dirty =
    props.canEdit && (body !== lastSavedBody || title !== lastSavedTitle);

  useUnsavedGuard(
    dirty,
    "You have unsaved changes. Leave anyway? Click Cancel and use Save draft to keep your work."
  );

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
      toast.error(e instanceof Error ? e.message : "Failed to attach image");
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
      toast.error(e instanceof Error ? e.message : "Failed to remove image");
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
        // Snapshot the saved state so dirty turns false until next edit
        setLastSavedBody(body);
        setLastSavedTitle(title);
        toast.success("Draft saved");
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  async function handleDelete() {
    const isPending = props.status === "PENDING_APPROVAL";
    const ok = await confirm({
      title: isPending ? "Recall and delete this post?" : "Delete this post?",
      description: isPending
        ? `This pulls the post back from ${props.contactName}'s approval queue and deletes it permanently. The draft, attached images, and history will be removed.`
        : "The draft, attached images, and history will be removed permanently. This can't be undone.",
      confirmLabel: isPending ? "Recall & delete" : "Delete post",
      cancelLabel: "Keep editing",
      destructive: true,
    });
    if (!ok) return;
    startDelete(async () => {
      try {
        const fd = new FormData();
        fd.set("postId", props.postId);
        await deletePost(fd);
        // Server action redirects to /content — toast appears briefly
        // before navigation; that's fine.
        toast.success("Post deleted");
      } catch (e) {
        // NEXT_REDIRECT throws are how Next.js implements server-side
        // redirect inside actions; they're not real errors.
        if (e && typeof e === "object" && "digest" in e) return;
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Couldn't delete post");
      }
    });
  }

  async function submitForApproval() {
    const ok = await confirm({
      title: `Submit to ${props.contactName} for approval?`,
      description: `${props.contactName} will get a notification with this post to approve, edit, or reject.`,
      confirmLabel: "Submit for approval",
      cancelLabel: "Not yet",
    });
    if (!ok) return;
    startSubmit(async () => {
      try {
        // Save first to make sure latest body is persisted
        const saveFd = new FormData();
        saveFd.set("postId", props.postId);
        saveFd.set("title", title);
        saveFd.set("body", body);
        await updatePostDraft(saveFd);
        setLastSavedBody(body);
        setLastSavedTitle(title);

        const fd = new FormData();
        fd.set("postId", props.postId);
        await submitPostForApproval(fd);
        toast.success(`Sent to ${props.contactName} for approval`);
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Couldn't submit");
      }
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
              disabled={savePending || submitPending || deletePending}
            >
              <Save className="h-4 w-4" />
              {savePending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={submitForApproval}
              disabled={
                savePending ||
                submitPending ||
                deletePending ||
                body.trim().length < 10
              }
            >
              <Send className="h-4 w-4" />
              {submitPending ? "Submitting…" : "Submit for approval"}
            </Button>
            <span className="ml-auto text-[11px] text-[var(--color-muted-foreground)]">
              {dirty ? (
                <span className="font-medium text-[var(--color-aperol)]">
                  Unsaved changes
                </span>
              ) : savedAt ? (
                `Saved ${timeAgo(savedAt)}`
              ) : (
                `Submitting notifies ${props.contactName}`
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={savePending || submitPending || deletePending}
              className="text-[var(--color-raspberry)] hover:bg-[var(--color-raspberry)]/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deletePending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        ) : props.status === "PENDING_APPROVAL" ? (
          <div className="sticky bottom-3 flex items-center gap-2 rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Waiting on {props.contactName}&apos;s approval.
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deletePending}
              className="ml-auto text-[var(--color-raspberry)] hover:bg-[var(--color-raspberry)]/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deletePending ? "Deleting…" : "Recall & delete"}
            </Button>
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

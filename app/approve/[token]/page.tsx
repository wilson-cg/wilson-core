import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { approvePostByToken, approveMessageByToken } from "@/lib/actions";
import { TokenPostActions } from "./token-post-actions";
import { TokenMessageActions } from "./token-message-actions";
import { WorkspaceLogo } from "@/components/settings/workspace-logo";
import {
  Check,
  FileText,
  MessageSquare,
  ThumbsUp,
  MessageCircle,
  Repeat2,
  Send,
  Globe2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/**
 * Public, token-scoped approval surface. The link inside the approval
 * email points here — no auth, no login picker. Security comes entirely
 * from the per-workspace approvalToken (32-char hex), same pattern as
 * /onboard/[token].
 *
 * Renders the same LinkedIn-feed-style approval cards the logged-in
 * client dashboard uses, plus message approval cards. Approve / Edit &
 * approve / Reject all submit to token-scoped server actions.
 */
export default async function ApproveByTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { approvalToken: token },
    include: {
      contacts: { where: { isPrimary: true }, take: 1 },
    },
  });

  if (!workspace) notFound();

  const [pendingPosts, pendingMessages] = await Promise.all([
    prisma.post.findMany({
      where: { workspaceId: workspace.id, status: "PENDING_APPROVAL" },
      include: {
        drafter: true,
        media: { orderBy: { orderIndex: "asc" } },
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.message.findMany({
      where: { workspaceId: workspace.id, status: "PENDING_APPROVAL" },
      include: { prospect: true, drafter: true },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  const primaryContact = workspace.contacts[0] ?? null;
  const total = pendingPosts.length + pendingMessages.length;
  const firstName =
    primaryContact?.fullName?.split(" ")[0] ??
    workspace.contactName.split(" ")[0] ??
    "there";

  return (
    <div className="min-h-screen bg-[var(--color-forest)]">
      {/* Forest header strip */}
      <header className="border-b border-white/10 px-6 py-6 lg:px-12">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/wilsons-wordmark-light.svg"
              alt="Wilson's"
              className="h-7"
            />
          </div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-virgil)]/70">
            {workspace.name}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 lg:px-12">
        <section className="mb-8 text-[var(--color-virgil)]">
          <p className="text-xs uppercase tracking-wider opacity-70">
            Hi {firstName}
          </p>
          <h1 className="mt-1 font-display text-4xl leading-tight md:text-5xl">
            {total > 0
              ? `${total} item${total === 1 ? "" : "s"} ready for your review`
              : "You're all caught up"}
          </h1>
          {total > 0 ? (
            <p className="mt-3 max-w-xl text-sm leading-relaxed opacity-85">
              {pendingPosts.length > 0
                ? `${pendingPosts.length} post${pendingPosts.length === 1 ? "" : "s"} for your LinkedIn feed`
                : ""}
              {pendingPosts.length > 0 && pendingMessages.length > 0
                ? " and "
                : ""}
              {pendingMessages.length > 0
                ? `${pendingMessages.length} outreach message${pendingMessages.length === 1 ? "" : "s"} to your prospects`
                : ""}
              . Approve, edit, or reject below.
            </p>
          ) : (
            <p className="mt-3 max-w-xl text-sm leading-relaxed opacity-85">
              Nothing waiting on you right now. Your Wilson&rsquo;s team will
              queue the next batch soon.
            </p>
          )}
        </section>

        {pendingPosts.length > 0 ? (
          <section className="mb-10">
            <div className="mb-3 flex items-center gap-2 text-[var(--color-virgil)]">
              <FileText className="h-4 w-4" />
              <h2 className="app-heading text-lg">
                Posts for your LinkedIn feed
              </h2>
            </div>
            <div className="space-y-5">
              {pendingPosts.map((p) => (
                <PostApprovalCard
                  key={p.id}
                  token={token}
                  post={p}
                  workspaceName={workspace.name}
                  workspaceLogoUrl={workspace.logoUrl}
                  workspaceAccentColor={workspace.accentColor}
                  contactName={primaryContact?.fullName ?? workspace.contactName}
                  contactTitle={primaryContact?.title ?? null}
                />
              ))}
            </div>
          </section>
        ) : null}

        {pendingMessages.length > 0 ? (
          <section className="mb-10">
            <div className="mb-3 flex items-center gap-2 text-[var(--color-virgil)]">
              <MessageSquare className="h-4 w-4" />
              <h2 className="app-heading text-lg">
                Outreach to your prospects
              </h2>
            </div>
            <div className="space-y-4">
              {pendingMessages.map((m) => (
                <MessageApprovalCard key={m.id} token={token} message={m} />
              ))}
            </div>
          </section>
        ) : null}

        <p className="mt-10 text-center text-[11px] uppercase tracking-wider text-[var(--color-virgil)]/50">
          Real people deserve real stories.
        </p>
      </main>
    </div>
  );
}

/* ─── Post card (LinkedIn feed style) ────────────────────────── */

type PostWithRelations = Awaited<
  ReturnType<typeof prisma.post.findMany>
>[number] & {
  drafter: { name: string | null };
  media: { id: string; url: string; filename: string | null }[];
};

function PostApprovalCard({
  token,
  post,
  workspaceName,
  workspaceLogoUrl,
  workspaceAccentColor,
  contactName,
  contactTitle,
}: {
  token: string;
  post: PostWithRelations;
  workspaceName: string;
  workspaceLogoUrl: string | null;
  workspaceAccentColor: string | null;
  contactName: string;
  contactTitle: string | null;
}) {
  const waiting = formatDistanceToNow(post.updatedAt, { addSuffix: true });
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-white/10 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.18)]">
      {/* Submission meta strip */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-virgil)] px-4 py-2">
        <div className="text-[11px] text-[var(--color-muted-foreground)]">
          {post.title ? (
            <>
              <span className="font-medium text-[var(--color-charcoal)]">
                {post.title}
              </span>{" "}
              ·{" "}
            </>
          ) : null}
          Drafted by {post.drafter.name} · submitted {waiting}
        </div>
        <Badge variant="pending">Pending</Badge>
      </div>

      {/* LinkedIn feed card */}
      <div className="bg-white p-4 sm:p-5">
        <header className="flex items-start gap-3">
          <WorkspaceLogo
            name={workspaceName}
            logoUrl={workspaceLogoUrl}
            accentColor={workspaceAccentColor}
            size="lg"
            className="!h-12 !w-12 !rounded-full"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[15px] font-semibold text-[#0A66C2] hover:underline">
              {contactName}
            </div>
            <div className="truncate text-xs text-[#666]">
              {contactTitle ?? workspaceName}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#666]">
              now · <Globe2 className="h-3 w-3" />
            </div>
          </div>
        </header>

        <div className="mt-3 whitespace-pre-line break-words text-[14px] leading-relaxed text-[#191919]">
          {post.body}
        </div>

        {post.media && post.media.length > 0 ? (
          <div
            className={`-mx-4 mt-3 grid gap-px overflow-hidden bg-[#dadbdc] sm:-mx-5 ${
              post.media.length === 1 ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {post.media.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.url}
                alt={m.filename ?? "Attached image"}
                className={`w-full object-cover ${
                  post.media.length === 1 ? "max-h-[480px]" : "h-44"
                }`}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-[#666]">
          <FeedAction icon={ThumbsUp} label="Like" />
          <FeedAction icon={MessageCircle} label="Comment" />
          <FeedAction icon={Repeat2} label="Repost" />
          <FeedAction icon={Send} label="Send" />
        </div>
      </div>

      {/* Approval band */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-virgil-dark)]/50 px-4 py-3">
        <form action={approvePostByToken}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="postId" value={post.id} />
          <Button type="submit" variant="accent" size="sm">
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
        </form>
        <TokenPostActions token={token} postId={post.id} body={post.body} />
      </div>
    </div>
  );
}

function FeedAction({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-gray-100">
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

/* ─── Message card ───────────────────────────────────────────── */

type MessageWithRelations = Awaited<
  ReturnType<typeof prisma.message.findMany>
>[number] & {
  prospect: { fullName: string; title: string | null; company: string };
  drafter: { name: string | null };
};

function MessageApprovalCard({
  token,
  message,
}: {
  token: string;
  message: MessageWithRelations;
}) {
  const waiting = formatDistanceToNow(message.updatedAt, { addSuffix: true });
  return (
    <div className="rounded-[var(--radius-lg)] border border-white/10 bg-white p-5 shadow-[0_8px_28px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-teal)] text-sm font-semibold text-[var(--color-forest-950)]">
              {message.prospect.fullName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-[var(--color-charcoal)]">
                {message.prospect.fullName}
              </div>
              <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                {message.prospect.title ? `${message.prospect.title} · ` : ""}
                {message.prospect.company}
              </div>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--color-charcoal-500)]">
            {message.body}
          </p>
          <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
            Drafted by {message.drafter.name} · submitted {waiting}
          </p>
        </div>
        <Badge variant="pending">Pending</Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4">
        <form action={approveMessageByToken}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="messageId" value={message.id} />
          <Button type="submit" variant="accent" size="sm">
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
        </form>
        <TokenMessageActions
          token={token}
          messageId={message.id}
          body={message.body}
        />
      </div>
    </div>
  );
}

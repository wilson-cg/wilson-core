import { Resend } from "resend";

/**
 * Email delivery (Resend).
 *
 * Configured via env:
 *   RESEND_API_KEY       — required to actually send. If missing, calls
 *                          to sendApprovalEmail() return { ok:false, skipped:true }
 *                          and the caller leaves the Notification queued.
 *   RESEND_FROM_EMAIL    — defaults to "Wilson's <approvals@wilsons.com>"
 *   APP_URL              — public URL for the CTA button (e.g.
 *                          "https://wilsons.com" or the Railway URL).
 *                          Falls back to the Railway production domain.
 *
 * The HTML template is hand-written and inline-styled because email
 * clients (Gmail, Outlook, Apple Mail) strip <style> tags and don't
 * support modern CSS. Brand tokens come from app/globals.css and are
 * inlined here as hex values.
 */

const FROM_EMAIL_DEFAULT = "Wilson's <approvals@wilsons.com>";
const APP_URL_DEFAULT = "https://wilson-core-production.up.railway.app";

let _resend: Resend | undefined;
function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

/* ─── Brand palette (mirrors app/globals.css) ─────────────────── */

const BRAND = {
  forest: "#17614F",
  forestDark: "#0d3a30",
  virgil: "#F9F5EE",
  virgilDark: "#F1EBDF",
  lime: "#CAF530",
  charcoal: "#1C2D22",
  charcoal500: "#3B4D41",
  charcoal300: "#6B7A70",
  border: "#E5DDCC",
  raspberry: "#EB595C",
};

/* ─── Approval email payload ──────────────────────────────────── */

export type ApprovalEmailKind = "post" | "message";

export type ApprovalEmailOptions = {
  to: string;
  kind: ApprovalEmailKind;
  contactName: string; // Recipient's name for the greeting
  workspaceName: string; // The client / brand
  drafterName: string; // Wilson's team member who drafted
  /** For posts: the post body. For messages: the outreach copy. */
  preview: string;
  /** For messages only: the prospect being contacted */
  prospectName?: string;
  prospectCompany?: string;
  /** Title (internal label) for posts — optional */
  postTitle?: string;
  /** Direct link target — defaults to /client/dashboard */
  pathOverride?: string;
};

/* ─── Public API ──────────────────────────────────────────────── */

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true; reason: "no-api-key" }
  | { ok: false; skipped?: false; error: string };

export async function sendApprovalEmail(
  opts: ApprovalEmailOptions
): Promise<SendResult> {
  const r = client();
  if (!r) return { ok: false, skipped: true, reason: "no-api-key" };

  const from = process.env.RESEND_FROM_EMAIL ?? FROM_EMAIL_DEFAULT;
  const { subject, html, text } = buildApprovalEmail(opts);

  try {
    const result = await r.emails.send({
      from,
      to: opts.to,
      subject,
      html,
      text,
    });
    if (result.error) {
      return { ok: false, error: result.error.message ?? "Unknown send error" };
    }
    return { ok: true, id: result.data?.id ?? "" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/* ─── Template ────────────────────────────────────────────────── */

export function buildApprovalEmail(opts: ApprovalEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const appUrl = (process.env.APP_URL ?? APP_URL_DEFAULT).replace(/\/$/, "");
  const ctaPath = opts.pathOverride ?? "/client/dashboard";
  const ctaUrl = `${appUrl}${ctaPath}`;

  const isPost = opts.kind === "post";
  const itemLabel = isPost ? "post" : "outreach message";
  const subject = isPost
    ? `New post ready for your approval — ${opts.workspaceName}`
    : `New outreach to ${opts.prospectName ?? "a prospect"} ready for your approval`;

  const headline = isPost
    ? "A new post is ready for your review"
    : `New outreach to ${opts.prospectName ?? "a prospect"}`;

  const subhead = isPost
    ? `Drafted by ${opts.drafterName} for ${opts.workspaceName}'s LinkedIn feed.`
    : `Drafted by ${opts.drafterName} for ${opts.prospectName ?? "the prospect"}${
        opts.prospectCompany ? ` at ${opts.prospectCompany}` : ""
      }.`;

  const previewSnippet = truncate(opts.preview.replace(/\s+/g, " ").trim(), 320);

  const text = [
    `Hi ${opts.contactName.split(" ")[0]},`,
    "",
    `${opts.drafterName} from your Wilson's team has drafted a new ${itemLabel} for your approval.`,
    "",
    isPost && opts.postTitle ? `Title: ${opts.postTitle}` : "",
    "",
    `Preview: ${previewSnippet}`,
    "",
    `Approve, edit, or reject:`,
    ctaUrl,
    "",
    "— Wilson's",
  ]
    .filter(Boolean)
    .join("\n");

  const html = renderHtml({
    contactFirstName: opts.contactName.split(" ")[0] ?? "there",
    headline,
    subhead,
    itemLabel,
    title: opts.postTitle,
    preview: previewSnippet,
    ctaUrl,
    workspaceName: opts.workspaceName,
  });

  return { subject, html, text };
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function renderHtml(p: {
  contactFirstName: string;
  headline: string;
  subhead: string;
  itemLabel: string;
  title?: string;
  preview: string;
  ctaUrl: string;
  workspaceName: string;
}): string {
  // Note: we render the wordmark as styled text rather than an <img> because
  // most email clients (notably Gmail) strip <svg> and even SVG <img> tags,
  // and we don't ship a PNG wordmark. Italic Instrument Serif at scale gives
  // us the same visual signature the marketing wordmark uses.

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escape(p.headline)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.forest};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${BRAND.virgil};">
  <span style="display:none;visibility:hidden;mso-hide:all;font-size:0;color:${BRAND.forest};line-height:0;max-height:0;overflow:hidden;">
    ${escape(p.preview)}
  </span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.forest};padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Wordmark on the forest background. Rendered as italic serif
             text so every email client renders it (Gmail strips SVG). -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
          <tr>
            <td align="center" style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-style:italic;font-size:44px;line-height:1;color:${BRAND.virgil};letter-spacing:-0.02em;">
              Wilson&rsquo;s
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 8px 28px rgba(0,0,0,0.18);">
          <!-- Workspace ribbon -->
          <tr>
            <td style="padding:14px 28px;border-bottom:1px solid ${BRAND.border};background:${BRAND.virgil};border-radius:16px 16px 0 0;">
              <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${BRAND.charcoal300};">
                ${escape(p.workspaceName)} · Approval needed
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 28px 8px 28px;background:#ffffff;">
              <p style="margin:0 0 6px 0;font-size:13px;color:${BRAND.charcoal300};">
                Hi ${escape(p.contactFirstName)},
              </p>
              <h1 style="margin:0 0 8px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;font-weight:600;line-height:1.2;color:${BRAND.forest};letter-spacing:-0.02em;">
                ${escape(p.headline)}
              </h1>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.55;color:${BRAND.charcoal500};">
                ${escape(p.subhead)}
              </p>

              ${
                p.title
                  ? `<p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${BRAND.charcoal300};">Title</p>
                     <p style="margin:0 0 16px 0;font-size:14px;color:${BRAND.charcoal};font-weight:500;">${escape(p.title)}</p>`
                  : ""
              }

              <!-- Preview block -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background:${BRAND.virgil};border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;font-size:14px;line-height:1.6;color:${BRAND.charcoal};white-space:pre-wrap;">
                    ${escape(p.preview)}
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">
                <tr>
                  <td align="center" style="border-radius:10px;background:${BRAND.lime};">
                    <a href="${escape(p.ctaUrl)}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:600;color:${BRAND.forestDark};text-decoration:none;border-radius:10px;">
                      Open the approval page →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 0 0;font-size:12px;color:${BRAND.charcoal300};">
                Approve, edit, or reject from the page — your team gets notified instantly.
              </p>
            </td>
          </tr>

          <!-- Card footer -->
          <tr>
            <td style="padding:18px 28px 22px 28px;border-top:1px solid ${BRAND.border};background:#ffffff;border-radius:0 0 16px 16px;font-size:11px;line-height:1.55;color:${BRAND.charcoal300};">
              You&rsquo;re receiving this because you&rsquo;re the approval contact for ${escape(p.workspaceName)} on the Wilson&rsquo;s portal.
              If you didn&rsquo;t expect it, just reply and we&rsquo;ll sort it out.
            </td>
          </tr>
        </table>

        <!-- Tagline on forest -->
        <p style="margin:20px 0 0 0;font-size:11px;color:rgba(249,245,238,0.55);letter-spacing:0.04em;">
          Real people deserve real stories.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Coresignal Base Employee API integration — LinkedIn profile auto-fill.
 *
 * Endpoint: GET https://api.coresignal.com/cdapi/v2/employee_base/collect/{shorthand}
 *   header: apikey: <CORESIGNAL_API_KEY>
 *   1 credit per successful collect.
 *
 * The Base Employee API "Root table" returns a single object with at least
 * full_name, title, headline, company_name, location, and an experience
 * array. We map the most-confidently populated fields onto the prospect form.
 *
 * Network/auth/rate-limit failures return { error } so the UI can surface
 * the issue without crashing the page.
 */

const CORESIGNAL_API_KEY = process.env.CORESIGNAL_API_KEY;

export type LinkedInProfile = {
  fullName: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
};

export type LinkedInProfileResult = LinkedInProfile | { error: string };

/** Pull the shorthand (e.g. "john-doe") from any reasonable LinkedIn URL. */
export function shorthandFromLinkedInUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/linkedin\.com$/.test(u.hostname.replace(/^www\./, ""))) return null;
    // /in/<shorthand> or /in/<shorthand>/...
    const match = u.pathname.match(/\/in\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export async function fetchLinkedInProfile(
  url: string
): Promise<LinkedInProfileResult> {
  if (!CORESIGNAL_API_KEY) {
    return { error: "CORESIGNAL_API_KEY not set — auto-fill disabled" };
  }

  const shorthand = shorthandFromLinkedInUrl(url);
  if (!shorthand) {
    return {
      error:
        "Couldn't read a LinkedIn shorthand from that URL. Use a /in/<name> URL.",
    };
  }

  const endpoint = `https://api.coresignal.com/cdapi/v2/employee_base/collect/${encodeURIComponent(shorthand)}`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        apikey: CORESIGNAL_API_KEY,
      },
      cache: "no-store",
    });
  } catch (err) {
    return {
      error: `Network error contacting Coresignal: ${(err as Error).message}`,
    };
  }

  if (res.status === 401 || res.status === 403) {
    return { error: "Coresignal rejected the API key (401/403)." };
  }
  if (res.status === 404) {
    return { error: "No Coresignal profile found for that shorthand." };
  }
  if (res.status === 429) {
    return { error: "Coresignal rate limit hit — try again shortly." };
  }
  if (!res.ok) {
    return { error: `Coresignal returned HTTP ${res.status}.` };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { error: "Coresignal returned a non-JSON response." };
  }

  return mapCoresignalResponse(body);
}

/**
 * Coresignal's Base Employee response shape isn't strictly typed in our
 * repo, so we read defensively. We try the obvious top-level fields first
 * and fall back to the most-recent experience entry if the top-level
 * fields are missing.
 */
function mapCoresignalResponse(raw: unknown): LinkedInProfile {
  const obj = isRecord(raw) ? raw : {};

  const fullName =
    pickString(obj["full_name"]) ??
    pickString(obj["name"]) ??
    pickString(obj["fullName"]) ??
    null;

  // Top-level current-title candidates.
  const directTitle =
    pickString(obj["title"]) ??
    pickString(obj["headline"]) ??
    pickString(obj["job_title"]) ??
    null;

  // Most-recent experience block.
  const experience = pickArray(
    obj["member_experience_collection"] ??
      obj["experience"] ??
      obj["experiences"]
  );
  const currentExp = experience.find((e) => {
    const r = isRecord(e) ? e : {};
    return r["date_to"] == null || r["date_to"] === "" || r["is_current"] === true;
  });
  const expRecord = isRecord(currentExp) ? currentExp : {};

  const expTitle =
    pickString(expRecord["title"]) ??
    pickString(expRecord["position_title"]) ??
    pickString(expRecord["position"]) ??
    null;

  const directCompany =
    pickString(obj["company_name"]) ??
    pickString(obj["company"]) ??
    pickString(obj["current_company_name"]) ??
    null;

  const expCompany =
    pickString(expRecord["company_name"]) ??
    pickString(expRecord["company"]) ??
    pickString(expRecord["organization"]) ??
    null;

  const location =
    pickString(obj["location"]) ??
    pickString(obj["country"]) ??
    pickString(obj["location_full"]) ??
    null;

  return {
    fullName,
    title: directTitle ?? expTitle,
    company: directCompany ?? expCompany,
    location,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(v: unknown): string | null {
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return null;
}

function pickArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

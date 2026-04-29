import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware — only does cheap path-level checks.
 *
 * Auth.js v5 uses a `authjs.session-token` cookie (or `__Secure-...` in
 * prod) backed by the database session. We don't validate the cookie's
 * signature here — the page-level requireUser() does the real check
 * against the DB. Middleware just bounces obviously-unauthenticated
 * requests away from protected routes so we don't render a flash of
 * authenticated chrome.
 */

const SESSION_COOKIE_CANDIDATES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths — let the page-level guards decide.
  // /onboard/[token] and /approve/[token] and /invite/[token] are public
  // typeform/landing flows — security comes from the token itself.
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/onboard/") ||
    pathname.startsWith("/approve/") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.svg";

  if (isPublic) return NextResponse.next();

  const hasSession = SESSION_COOKIE_CANDIDATES.some(
    (name) => !!req.cookies.get(name)?.value
  );

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.svg).*)"],
};

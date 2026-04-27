import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "wilsons_session";

/**
 * Edge middleware — only does cheap path-level checks (is there a cookie?).
 * Role-based routing is enforced in layouts + page guards where we can
 * actually query the DB.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths — "/" is a server-side redirect based on session, so we let
  // it through and let the page decide. /onboard/[token] is the public
  // typeform-style onboarding flow; security comes from the token itself.
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/onboard/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.svg";

  if (isPublic) return NextResponse.next();

  const session = req.cookies.get(COOKIE_NAME)?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.svg).*)"],
};

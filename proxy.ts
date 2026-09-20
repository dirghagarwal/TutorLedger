import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/register", "/setup", "/portal", "/_next", "/favicon.ico", "/manifest.webmanifest", "/icons"];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(request.cookies.get("tutorledger_session")?.value);
  if (!hasSessionCookie) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api).*)"],
};

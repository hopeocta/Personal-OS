import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySignedCookie, COOKIE_NAME } from "@/lib/auth";
import { verifyPersonCookie, PERSON_COOKIE } from "@/lib/personAuth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Athleten-PWA: offen, kein Passwort nötig (personId kommt aus URL)
  if (pathname.startsWith("/p") || pathname.startsWith("/api/p")) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/garmin") ||
    pathname.startsWith("/api/calendar") ||
    pathname.startsWith("/api/telegram")
  ) {
    return NextResponse.next();
  }

  // Programmatic access via API secret header (for cron jobs, webhooks)
  const apiSecret = request.headers.get("x-api-secret");
  if (apiSecret && apiSecret === process.env.API_SECRET) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const valid = await verifySignedCookie(cookie);
  if (!valid) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

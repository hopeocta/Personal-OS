import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySignedCookie, COOKIE_NAME } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

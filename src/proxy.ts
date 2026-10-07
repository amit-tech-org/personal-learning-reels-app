import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { passcodeRequired } from "@/lib/env";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

function botRoute(pathname: string): boolean {
  return pathname === "/api/content/ingest" || pathname === "/api/content/status";
}

export async function proxy(request: NextRequest) {
  if (!passcodeRequired()) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return NextResponse.next();
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (botRoute(pathname)) return NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const unlocked = await verifySessionToken(token);
  if (!unlocked) {
    return NextResponse.json({ error: "This Primer is locked." }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};

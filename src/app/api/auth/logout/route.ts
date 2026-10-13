import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { cookies } from "next/headers";

export async function POST() {
  (await cookies()).set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return Response.json({ ok: true });
}

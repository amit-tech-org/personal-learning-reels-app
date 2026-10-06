import { passcodeRequired } from "@/lib/env";
import { consumeUnlockAttempt } from "@/lib/rate-limit";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifyPasscode,
} from "@/lib/session";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  if (!passcodeRequired()) {
    return Response.json({ ok: true, required: false });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!consumeUnlockAttempt(ip)) {
    return Response.json({ error: "Too many attempts. Wait a minute and try again." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { passcode?: unknown } | null;
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";
  const ok = await verifyPasscode(passcode);
  if (!ok) {
    return Response.json({ error: "That passcode does not match." }, { status: 401 });
  }
  const token = await createSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  return Response.json({ ok: true });
}

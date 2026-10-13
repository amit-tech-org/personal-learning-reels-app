import { passcodeRequired } from "@/lib/env";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { cookies } from "next/headers";

export async function GET() {
  const required = passcodeRequired();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const unlocked = await verifySessionToken(token);
  return Response.json({ required, unlocked });
}

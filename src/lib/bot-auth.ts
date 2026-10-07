import { timingSafeEqual } from "node:crypto";
import { botToken } from "./env";

export function bearerMatches(header: string | null, expected: string): boolean {
  if (!expected) return false;
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  const presented = match?.[1];
  if (!presented) return false;
  const actual = Buffer.from(presented);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

export function authorizeBot(request: Request): boolean {
  return bearerMatches(request.headers.get("authorization"), botToken());
}

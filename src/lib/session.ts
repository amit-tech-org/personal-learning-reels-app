import { passcodeRequired } from "./env";

export const SESSION_COOKIE = "primer_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}

export function sessionCookieOptions(maxAge = SESSION_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function verifyPasscode(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSCODE ?? "";
  if (!expected) return true;
  const [actual, wanted] = await Promise.all([
    sign(input, "primer-passcode-check"),
    sign(expected, "primer-passcode-check"),
  ]);
  return safeEqual(actual, wanted);
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const secret = process.env.APP_PASSCODE?.trim();
  if (!secret) return "";
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  const signature = await sign(String(exp), secret);
  return `${exp}.${signature}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!passcodeRequired()) return true;
  if (!token) return false;
  const secret = process.env.APP_PASSCODE?.trim();
  if (!secret) return true;
  const [exp, signature] = token.split(".");
  if (!exp || !signature || !/^\d+$/.test(exp)) return false;
  if (Number(exp) * 1000 < now) return false;
  const expected = await sign(exp, secret);
  return safeEqual(signature, expected);
}

import { intEnv } from "./env";

interface Bucket {
  day: string;
  count: number;
  windowStart: number;
  windowCount: number;
}

const buckets = new Map<string, Bucket>();

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function peekGeneration(now = Date.now()): { used: number; cap: number; remaining: number } {
  const cap = intEnv("GENERATION_DAILY_CAP", 40);
  const bucket = buckets.get("generation");
  const used = bucket && bucket.day === dayKey(now) ? bucket.count : 0;
  return { used, cap, remaining: Math.max(0, cap - used) };
}

export function consumeGeneration(
  now = Date.now(),
): { ok: true; remaining: number } | { ok: false; error: string; retryAfterSeconds: number } {
  const cap = intEnv("GENERATION_DAILY_CAP", 40);
  const perMinute = intEnv("RATE_LIMIT_PER_MINUTE", 8);
  const day = dayKey(now);
  const current = buckets.get("generation");
  const bucket: Bucket =
    current && current.day === day
      ? current
      : { day, count: 0, windowStart: now, windowCount: 0 };

  if (now - bucket.windowStart >= 60_000) {
    bucket.windowStart = now;
    bucket.windowCount = 0;
  }
  if (bucket.windowCount >= perMinute) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStart + 60_000 - now) / 1000));
    return {
      ok: false,
      error: "Slow down a little. Primer is pacing requests so a burst cannot spend the day's budget.",
      retryAfterSeconds,
    };
  }
  if (bucket.count >= cap) {
    return {
      ok: false,
      error: "Today's generation cap is used up. Saved reels still open, and the counter resets tomorrow.",
      retryAfterSeconds: 3600,
    };
  }
  bucket.count += 1;
  bucket.windowCount += 1;
  buckets.set("generation", bucket);
  return { ok: true, remaining: cap - bucket.count };
}

const unlocks = new Map<string, { start: number; count: number }>();

export function consumeUnlockAttempt(ip: string, now = Date.now()): boolean {
  const current = unlocks.get(ip);
  if (!current || now - current.start >= 60_000) {
    unlocks.set(ip, { start: now, count: 1 });
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  return true;
}

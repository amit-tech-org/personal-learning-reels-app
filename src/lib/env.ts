export function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

export function passcodeRequired(): boolean {
  return Boolean(process.env.APP_PASSCODE?.trim());
}

export function botToken(): string {
  return process.env.CONTENT_BOT_TOKEN?.trim() ?? "";
}

export function botConfigured(): boolean {
  return botToken().length > 0;
}

/** Unread cards in the browser queue below this count ask Grok Bot for a refill. */
export function refillThreshold(): number {
  return intEnv("REFILL_UNREAD_THRESHOLD", 20);
}

export interface RedisRestConfig {
  url: string;
  token: string;
}

/**
 * Vercel KV and the Upstash Redis integration both expose a REST URL and token.
 * Either pair selects the durable store. Without them, Primer uses data/content.json.
 */
export function redisRestConfig(): RedisRestConfig | null {
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export function contentStoreKind(): "redis" | "file" {
  return redisRestConfig() ? "redis" : "file";
}

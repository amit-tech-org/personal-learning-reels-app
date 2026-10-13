import { refillThreshold, refillWebhookConfig } from "./env";
import type { ContentDocument, Depth, RefillReason, RefillSignal } from "./types";

/** After a wake-up, ignore further need-more bursts until ingest or this elapsed time. */
export const REFILL_WEBHOOK_COOLDOWN_MS = 15 * 60 * 1000;

/** Bound the outbound POST so a slow webhook cannot stall the phone for long. */
export const REFILL_WEBHOOK_TIMEOUT_MS = 2_500;

export interface DeeperCardRequest {
  topic: string;
  depth?: Depth;
}

export interface RefillWebhookPayload {
  unReadCardCount: number;
  topics: string[];
  deeperCards: DeeperCardRequest[];
  threshold: number;
  at: string;
  appUrl?: string;
}

export function appUrlFromRequest(request: Request): string | undefined {
  try {
    return httpOrigin(new URL(request.url).origin);
  } catch {
    return undefined;
  }
}

function httpOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function pushTopic(topics: string[], seen: Set<string>, topic: string | undefined) {
  const clean = topic?.trim();
  if (!clean || seen.has(clean)) return;
  seen.add(clean);
  topics.push(clean);
}

export function deeperCardRequests(doc: ContentDocument): DeeperCardRequest[] {
  const cards: DeeperCardRequest[] = [];
  const seen = new Set<string>();
  for (const signal of doc.signals) {
    if (signal.reason !== "deeper" || !signal.topic) continue;
    const key = `${signal.topic}\0${signal.depth ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item: DeeperCardRequest = { topic: signal.topic };
    if (signal.depth) item.depth = signal.depth;
    cards.push(item);
  }
  return cards;
}

export function buildRefillWebhookPayload(
  doc: ContentDocument,
  unread: number,
  now: Date,
  threshold: number,
  appUrl?: string,
): RefillWebhookPayload {
  const topics: string[] = [];
  const seen = new Set<string>();
  const source = [...doc.signals].reverse().find((item) => item.interests.length > 0);
  for (const interest of source?.interests ?? []) pushTopic(topics, seen, interest.topic);
  for (const signal of doc.signals) pushTopic(topics, seen, signal.topic);

  const payload: RefillWebhookPayload = {
    unReadCardCount: unread,
    topics,
    deeperCards: deeperCardRequests(doc),
    threshold,
    at: now.toISOString(),
  };
  const origin = httpOrigin(appUrl);
  if (origin) payload.appUrl = origin;
  return payload;
}

export function refillPendingActive(
  pendingAt: string | undefined,
  now: Date,
  cooldownMs = REFILL_WEBHOOK_COOLDOWN_MS,
): boolean {
  if (!pendingAt) return false;
  const at = Date.parse(pendingAt);
  if (!Number.isFinite(at)) return false;
  return now.getTime() - at < cooldownMs;
}

/**
 * Decide whether this signal starts or retries a wake-up.
 * The flag is a fixed window from the send, not a sliding one, so a lost POST can retry.
 */
export function claimRefillWebhook(
  doc: ContentDocument,
  trigger: Pick<RefillSignal, "reason" | "unread">,
  now: Date,
  appUrl?: string,
): { doc: ContentDocument; payload: RefillWebhookPayload | null } {
  if (!refillWebhookConfig()) return { doc, payload: null };
  const threshold = refillThreshold();
  const actionable = isActionable(trigger.reason, trigger.unread, threshold);
  if (!actionable) return { doc, payload: null };
  if (refillPendingActive(doc.refillPendingAt, now)) return { doc, payload: null };
  return {
    doc: { ...doc, refillPendingAt: now.toISOString() },
    payload: buildRefillWebhookPayload(doc, trigger.unread, now, threshold, appUrl),
  };
}

function isActionable(reason: RefillReason, unread: number, threshold: number): boolean {
  if (reason === "deeper") return true;
  return reason === "queue-low" && unread < threshold;
}

/**
 * POST the wake-up. Failures are swallowed: the phone's need-more call must still succeed.
 * Does nothing when the webhook env is unset.
 */
export async function deliverRefillWebhook(
  payload: RefillWebhookPayload,
  timeoutMs = REFILL_WEBHOOK_TIMEOUT_MS,
): Promise<void> {
  const config = refillWebhookConfig();
  if (!config) return;
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "manual",
      cache: "no-store",
    });
    await response.body?.cancel().catch(() => undefined);
  } catch {
    // A lost wake-up can retry after the cooldown. Never surface this to the client.
  }
}

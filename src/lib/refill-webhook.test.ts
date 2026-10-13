import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyIngest, ingestCards, mergeCards, readContent, recordNeedMore } from "./content-store";
import { refillWebhookConfig } from "./env";
import {
  REFILL_WEBHOOK_COOLDOWN_MS,
  claimRefillWebhook,
  deliverRefillWebhook,
  refillPendingActive,
  type RefillWebhookPayload,
} from "./refill-webhook";
import type { ContentCard, ContentDocument } from "./types";

const WEBHOOK_URL = "https://hooks.example.test/refill";
const WEBHOOK_KEY = "refill-test-key";

const text = (id: string): ContentCard => ({
  id,
  type: "text",
  topic: "LLMs",
  depth: "beginner",
  title: `Lesson ${id}`,
  bullets: ["One point.", "Two points.", "Three points."],
  takeaway: "Remember this.",
  createdAt: "2026-01-01T00:00:01.000Z",
});

function lowQueue(unread = 5) {
  return {
    unread,
    reason: "queue-low" as const,
    interests: [
      { topic: "LLM", weight: 3, depth: "beginner" as const },
      { topic: "Physics", weight: 2, depth: "intermediate" as const },
    ],
    knownTopics: [],
    seenCounts: {},
  };
}

function deeper() {
  return {
    unread: 8,
    reason: "deeper" as const,
    topic: "Physics",
    depth: "advanced" as const,
    interests: [{ topic: "Physics", weight: 4, depth: "advanced" as const }],
    knownTopics: [],
    seenCounts: {},
  };
}

describe("refill webhook claim", () => {
  const now = new Date("2026-04-01T12:00:00.000Z");
  const env = {
    url: process.env.REFILL_WEBHOOK_URL,
    key: process.env.REFILL_WEBHOOK_KEY,
    threshold: process.env.REFILL_UNREAD_THRESHOLD,
  };

  beforeEach(() => {
    process.env.REFILL_WEBHOOK_URL = WEBHOOK_URL;
    process.env.REFILL_WEBHOOK_KEY = WEBHOOK_KEY;
    process.env.REFILL_UNREAD_THRESHOLD = "20";
  });

  afterEach(() => {
    restore("REFILL_WEBHOOK_URL", env.url);
    restore("REFILL_WEBHOOK_KEY", env.key);
    restore("REFILL_UNREAD_THRESHOLD", env.threshold);
  });

  it("builds the wake-up shape for a low queue", () => {
    const doc: ContentDocument = { cards: [], signals: [] };
    const withSignal = {
      ...doc,
      signals: [
        {
          id: "sig_low",
          at: now.toISOString(),
          unread: 5,
          reason: "queue-low" as const,
          interests: lowQueue().interests,
          knownTopics: [],
          seenCounts: {},
        },
      ],
    };
    const claimed = claimRefillWebhook(withSignal, { reason: "queue-low", unread: 5 }, now, "https://primer.example/api");
    expect(claimed.payload).toEqual({
      unReadCardCount: 5,
      topics: ["LLM", "Physics"],
      deeperCards: [],
      threshold: 20,
      at: now.toISOString(),
      appUrl: "https://primer.example",
    });
    expect(claimed.doc.refillPendingAt).toBe(now.toISOString());
  });

  it("does nothing when either webhook env var is unset", () => {
    delete process.env.REFILL_WEBHOOK_KEY;
    expect(refillWebhookConfig()).toBeNull();
    const doc: ContentDocument = { cards: [], signals: [] };
    const claimed = claimRefillWebhook(doc, { reason: "queue-low", unread: 5 }, now);
    expect(claimed.payload).toBeNull();
    expect(claimed.doc.refillPendingAt).toBeUndefined();

    process.env.REFILL_WEBHOOK_KEY = WEBHOOK_KEY;
    delete process.env.REFILL_WEBHOOK_URL;
    expect(refillWebhookConfig()).toBeNull();
  });

  it("skips a full queue and still allows the next low queue", () => {
    const doc: ContentDocument = { cards: [], signals: [] };
    const full = claimRefillWebhook(doc, { reason: "queue-low", unread: 20 }, now);
    expect(full.payload).toBeNull();
    expect(full.doc.refillPendingAt).toBeUndefined();
  });

  it("holds the flag for one episode, then retries after the cooldown", () => {
    const doc: ContentDocument = {
      cards: [],
      signals: [],
      refillPendingAt: now.toISOString(),
    };
    const held = claimRefillWebhook(doc, { reason: "queue-low", unread: 4 }, new Date(now.getTime() + 60_000));
    expect(held.payload).toBeNull();
    expect(held.doc.refillPendingAt).toBe(now.toISOString());

    const later = new Date(now.getTime() + REFILL_WEBHOOK_COOLDOWN_MS);
    expect(refillPendingActive(now.toISOString(), later)).toBe(false);
    const retry = claimRefillWebhook(doc, { reason: "deeper", unread: 4 }, later, "http://127.0.0.1:3000");
    expect(retry.payload?.unReadCardCount).toBe(4);
    expect(retry.doc.refillPendingAt).toBe(later.toISOString());
  });

  it("drops the flag when a batch is ingested and keeps it when a video is merged", () => {
    const doc: ContentDocument = {
      cards: [text("a")],
      signals: [
        {
          id: "sig_deep",
          at: now.toISOString(),
          unread: 4,
          reason: "deeper",
          topic: "Physics",
          depth: "advanced",
          interests: [],
          knownTopics: [],
          seenCounts: {},
        },
      ],
      refillPendingAt: now.toISOString(),
    };
    const merged = mergeCards(doc, [text("v1")]);
    expect(merged.refillPendingAt).toBe(now.toISOString());
    expect(merged.signals).toHaveLength(1);

    const ingested = applyIngest(doc, [text("b")]);
    expect(ingested.signals).toEqual([]);
    expect(ingested.refillPendingAt).toBeUndefined();
  });
});

describe("refill webhook delivery", () => {
  const payload: RefillWebhookPayload = {
    unReadCardCount: 5,
    topics: ["LLM", "Physics"],
    deeperCards: [],
    threshold: 20,
    at: "2026-04-01T12:00:00.000Z",
    appUrl: "https://primer.example",
  };
  const env = {
    url: process.env.REFILL_WEBHOOK_URL,
    key: process.env.REFILL_WEBHOOK_KEY,
  };

  beforeEach(() => {
    process.env.REFILL_WEBHOOK_URL = WEBHOOK_URL;
    process.env.REFILL_WEBHOOK_KEY = WEBHOOK_KEY;
  });

  afterEach(() => {
    restore("REFILL_WEBHOOK_URL", env.url);
    restore("REFILL_WEBHOOK_KEY", env.key);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs the payload with the bearer key and does not log either secret", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await deliverRefillWebhook(payload, 50);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(WEBHOOK_URL);
    expect(calls[0]?.init.method).toBe("POST");
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${WEBHOOK_KEY}`);
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(payload);
    const leaked = [error, log, warn].flatMap((spy) => spy.mock.calls.flat().map(String)).join("\n");
    expect(leaked).not.toContain(WEBHOOK_KEY);
    expect(leaked).not.toContain(WEBHOOK_URL);
  });

  it("swallows a failed or hanging POST", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error(`down ${WEBHOOK_URL}`)));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(deliverRefillWebhook(payload, 30)).resolves.toBeUndefined();
    expect(error.mock.calls.flat().map(String).join("\n")).not.toContain(WEBHOOK_KEY);

    vi.stubGlobal(
      "fetch",
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason ?? new Error("aborted"));
          });
        }),
    );
    await expect(deliverRefillWebhook(payload, 20)).resolves.toBeUndefined();
  });

  it("does not call fetch when the webhook env is unset", async () => {
    delete process.env.REFILL_WEBHOOK_URL;
    delete process.env.REFILL_WEBHOOK_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await deliverRefillWebhook(payload, 20);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("refill webhook store", () => {
  let dir = "";
  const previous = process.env.CONTENT_DATA_PATH;
  const env = {
    url: process.env.REFILL_WEBHOOK_URL,
    key: process.env.REFILL_WEBHOOK_KEY,
    threshold: process.env.REFILL_UNREAD_THRESHOLD,
    kvUrl: process.env.KV_REST_API_URL,
    kvToken: process.env.KV_REST_API_TOKEN,
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
  const now = new Date("2026-04-02T00:00:00.000Z");

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "primer-refill-"));
    process.env.CONTENT_DATA_PATH = path.join(dir, "content.json");
    process.env.REFILL_WEBHOOK_URL = WEBHOOK_URL;
    process.env.REFILL_WEBHOOK_KEY = WEBHOOK_KEY;
    process.env.REFILL_UNREAD_THRESHOLD = "20";
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(async () => {
    restore("CONTENT_DATA_PATH", previous);
    restore("REFILL_WEBHOOK_URL", env.url);
    restore("REFILL_WEBHOOK_KEY", env.key);
    restore("REFILL_UNREAD_THRESHOLD", env.threshold);
    restore("KV_REST_API_URL", env.kvUrl);
    restore("KV_REST_API_TOKEN", env.kvToken);
    restore("UPSTASH_REDIS_REST_URL", env.upstashUrl);
    restore("UPSTASH_REDIS_REST_TOKEN", env.upstashToken);
    await rm(dir, { recursive: true, force: true });
  });

  it("sends once per low-queue episode, stores the flag, and lets ingest open the next one", async () => {
    const first = await recordNeedMore(lowQueue(5), now, "https://primer.example");
    expect(first.webhook).toMatchObject({
      unReadCardCount: 5,
      topics: ["LLM", "Physics"],
      deeperCards: [],
    });
    const stored = JSON.parse(await readFile(path.join(dir, "content.json"), "utf8")) as ContentDocument;
    expect(stored.refillPendingAt).toBe(now.toISOString());

    const burst = await recordNeedMore(lowQueue(4), new Date(now.getTime() + 30_000));
    expect(burst.webhook).toBeNull();
    expect(burst.doc.refillPendingAt).toBe(now.toISOString());
    expect(burst.doc.signals.filter((item) => item.reason === "queue-low")).toHaveLength(1);

    const during = await recordNeedMore(deeper(), new Date(now.getTime() + 60_000));
    expect(during.webhook).toBeNull();
    expect(during.doc.signals.some((item) => item.reason === "deeper" && item.topic === "Physics")).toBe(true);

    const ingested = await ingestCards([text("fresh-lesson")]);
    expect(ingested.refillPendingAt).toBeUndefined();
    expect(ingested.signals).toEqual([]);
    const again = await readContent();
    expect(again.refillPendingAt).toBeUndefined();

    const next = await recordNeedMore(lowQueue(3), new Date(now.getTime() + 120_000), "https://primer.example");
    expect(next.webhook?.unReadCardCount).toBe(3);
  });

  it("retries a lost wake-up after the cooldown without ingest", async () => {
    await recordNeedMore(lowQueue(5), now);
    const retry = await recordNeedMore(lowQueue(2), new Date(now.getTime() + REFILL_WEBHOOK_COOLDOWN_MS));
    expect(retry.webhook?.unReadCardCount).toBe(2);
    expect(retry.doc.refillPendingAt).toBe(new Date(now.getTime() + REFILL_WEBHOOK_COOLDOWN_MS).toISOString());
  });

  it("records the signal and skips the push when the webhook env is unset", async () => {
    delete process.env.REFILL_WEBHOOK_URL;
    delete process.env.REFILL_WEBHOOK_KEY;
    const recorded = await recordNeedMore(lowQueue(5), now);
    expect(recorded.webhook).toBeNull();
    expect(recorded.doc.refillPendingAt).toBeUndefined();
    expect(recorded.doc.signals.some((item) => item.reason === "queue-low" && item.unread === 5)).toBe(true);
    const roundTrip = await readContent();
    expect(roundTrip.refillPendingAt).toBeUndefined();
    expect(roundTrip.signals).toHaveLength(1);
  });

  it("wakes on a deeper request when the queue itself is not low", async () => {
    const recorded = await recordNeedMore(deeper(), now, "https://primer.example/feed");
    expect(recorded.webhook).toMatchObject({
      unReadCardCount: 8,
      topics: ["Physics"],
      deeperCards: [{ topic: "Physics", depth: "advanced" }],
      appUrl: "https://primer.example",
    });
  });
});

function restore(name: string, value: string | undefined) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}

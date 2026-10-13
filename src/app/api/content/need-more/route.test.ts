import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const WEBHOOK_URL = "https://hooks.example.test/refill";
const WEBHOOK_KEY = "refill-route-key";

function needMore(body: unknown): Request {
  return new Request("http://127.0.0.1:3000/api/content/need-more", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const lowQueue = {
  unread: 5,
  reason: "queue-low",
  interests: [
    { topic: "LLM", weight: 3, depth: "beginner" },
    { topic: "Physics", weight: 2, depth: "intermediate" },
  ],
};

describe("POST /api/content/need-more webhook", () => {
  let dir = "";
  const previousPath = process.env.CONTENT_DATA_PATH;
  const saved = {
    url: process.env.REFILL_WEBHOOK_URL,
    key: process.env.REFILL_WEBHOOK_KEY,
    threshold: process.env.REFILL_UNREAD_THRESHOLD,
    youtube: process.env.YOUTUBE_API_KEY,
    kvUrl: process.env.KV_REST_API_URL,
    kvToken: process.env.KV_REST_API_TOKEN,
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
  const calls: { url: string; init: RequestInit }[] = [];

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "primer-need-more-"));
    process.env.CONTENT_DATA_PATH = path.join(dir, "content.json");
    process.env.REFILL_WEBHOOK_URL = WEBHOOK_URL;
    process.env.REFILL_WEBHOOK_KEY = WEBHOOK_KEY;
    process.env.REFILL_UNREAD_THRESHOLD = "20";
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    calls.length = 0;
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(null, { status: 204 }));
    });
  });

  afterEach(async () => {
    restore("CONTENT_DATA_PATH", previousPath);
    restore("REFILL_WEBHOOK_URL", saved.url);
    restore("REFILL_WEBHOOK_KEY", saved.key);
    restore("REFILL_UNREAD_THRESHOLD", saved.threshold);
    restore("YOUTUBE_API_KEY", saved.youtube);
    restore("KV_REST_API_URL", saved.kvUrl);
    restore("KV_REST_API_TOKEN", saved.kvToken);
    restore("UPSTASH_REDIS_REST_URL", saved.upstashUrl);
    restore("UPSTASH_REDIS_REST_TOKEN", saved.upstashToken);
    vi.unstubAllGlobals();
    await rm(dir, { recursive: true, force: true });
  });

  it("forwards one wake-up and does not repeat it for a burst", async () => {
    const first = await POST(needMore(lowQueue));
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ ok: true, needsRefill: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(WEBHOOK_URL);
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${WEBHOOK_KEY}`);
    const body = JSON.parse(String(calls[0]?.init.body)) as {
      unReadCardCount: number;
      topics: string[];
      deeperCards: unknown[];
      appUrl?: string;
    };
    expect(body.unReadCardCount).toBe(5);
    expect(body.topics).toEqual(["LLM", "Physics"]);
    expect(body.deeperCards).toEqual([]);
    expect(body.appUrl).toBe("http://127.0.0.1:3000");
    expect(JSON.stringify(body)).not.toContain(WEBHOOK_KEY);

    const second = await POST(needMore({ ...lowQueue, unread: 4 }));
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ ok: true, needsRefill: true });
    expect(calls).toHaveLength(1);
  });

  it("stays a no-op when the webhook env is unset", async () => {
    delete process.env.REFILL_WEBHOOK_URL;
    delete process.env.REFILL_WEBHOOK_KEY;
    const response = await POST(needMore(lowQueue));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, needsRefill: true });
    expect(calls).toHaveLength(0);
  });

  it("returns ok when the webhook fails and does not log the key", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", () => Promise.reject(new Error(`refused ${WEBHOOK_KEY} ${WEBHOOK_URL}`)));
    const response = await POST(needMore(lowQueue));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, needsRefill: true });
    expect(error.mock.calls.flat().map(String).join("\n")).not.toContain(WEBHOOK_KEY);
    error.mockRestore();
  });

  it("does not wait for a slow webhook before responding", async () => {
    let release: (value: Response) => void = () => undefined;
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal("fetch", () => gate);
    const started = Date.now();
    const response = await POST(needMore(lowQueue));
    expect(response.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(1000);
    release(new Response(null, { status: 204 }));
    await gate;
  }, 2000);
});

function restore(name: string, value: string | undefined) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}

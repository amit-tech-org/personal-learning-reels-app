import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bearerMatches } from "./bot-auth";
import {
  applyIngest,
  applySignal,
  contentStatus,
  ingestCards,
  loadSeedDocument,
  mergeCards,
  parseFeedQuery,
  readContent,
  selectFeedPage,
} from "./content-store";
import type { ContentCard, ContentDocument, RefillSignal } from "./types";

const text = (id: string, topic: string, createdAt: string, depth: ContentCard["depth"] = "beginner"): ContentCard => ({
  id,
  type: "text",
  topic,
  depth,
  title: `Lesson ${id}`,
  bullets: ["One point.", "Two points.", "Three points."],
  takeaway: "Remember this.",
  createdAt,
});

function signal(partial: Partial<RefillSignal> & Pick<RefillSignal, "reason" | "unread">): RefillSignal {
  return {
    id: partial.id ?? "sig_test",
    at: partial.at ?? "2026-02-01T00:00:00.000Z",
    unread: partial.unread,
    reason: partial.reason,
    topic: partial.topic,
    depth: partial.depth,
    interests: partial.interests ?? [],
    knownTopics: partial.knownTopics ?? [],
    seenCounts: partial.seenCounts ?? {},
  };
}

describe("seed bank", () => {
  it("includes text and mermaid cards for the three starter topics", () => {
    const seed = loadSeedDocument();
    const ids = seed.cards.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of ["LLMs", "Agentic AI", "System Design"]) {
      const cards = seed.cards.filter((card) => card.topic === topic);
      expect(cards.some((card) => card.type === "text")).toBe(true);
      expect(cards.some((card) => card.type === "diagram" && card.mermaid)).toBe(true);
    }
    expect(seed.cards.some((card) => card.type === "diagram")).toBe(true);
    const videos = seed.cards.filter((card) => card.type === "video");
    expect(videos.length).toBeGreaterThanOrEqual(2);
    expect(videos.every((card) => card.youtubeId && (card.durationSeconds ?? 999) <= 180)).toBe(true);
    expect(seed.signals).toEqual([]);
  });
});

describe("selectFeedPage", () => {
  const doc: ContentDocument = {
    cards: [
      text("a", "LLMs", "2026-01-01T00:00:01.000Z"),
      text("b", "LLMs", "2026-01-01T00:00:02.000Z", "advanced"),
      text("c", "System Design", "2026-01-01T00:00:03.000Z"),
    ],
    signals: [],
  };

  it("pages with a cursor and skips excluded ids", () => {
    const first = selectFeedPage(doc, {
      cursor: null,
      limit: 1,
      topics: ["LLMs"],
      exclude: [],
      topic: null,
      deeper: false,
    });
    expect(first.cards.map((card) => card.id)).toEqual(["a"]);
    expect(first.nextCursor).toBe("a");
    expect(first.exhausted).toBe(false);

    const second = selectFeedPage(doc, {
      cursor: "a",
      limit: 6,
      topics: ["LLMs"],
      exclude: ["b"],
      topic: null,
      deeper: false,
    });
    expect(second.cards).toEqual([]);
    expect(second.exhausted).toBe(true);
  });

  it("prefers deeper cards on the same topic", () => {
    const page = selectFeedPage(doc, {
      cursor: null,
      limit: 1,
      topics: [],
      exclude: [],
      topic: "LLMs",
      deeper: true,
    });
    expect(page.cards[0]?.id).toBe("b");
    expect(page.cards[0]?.depth).toBe("advanced");
  });
});

describe("refill signals", () => {
  it("replaces the queue-low signal and clears both on ingest", () => {
    let doc: ContentDocument = { cards: [text("a", "LLMs", "2026-01-01T00:00:01.000Z")], signals: [] };
    doc = applySignal(doc, signal({ reason: "queue-low", unread: 4 }));
    doc = applySignal(doc, signal({ id: "sig_deep", reason: "deeper", unread: 4, topic: "LLMs", depth: "advanced" }));
    doc = applySignal(doc, signal({ id: "sig_low", reason: "queue-low", unread: 2 }));
    const status = contentStatus(doc, 20);
    expect(status.needsRefill).toBe(true);
    expect(status.unreadReported).toBe(2);
    expect(status.deeperTopics).toEqual([{ topic: "LLMs", depth: "advanced" }]);

    const ingested = applyIngest(doc, [text("b", "Agentic AI", "2026-01-02T00:00:01.000Z")]);
    expect(ingested.signals).toEqual([]);
    expect(ingested.cards.map((card) => card.id)).toEqual(["a", "b"]);
    expect(contentStatus(ingested, 20).needsRefill).toBe(false);
  });

  it("does not ask for a refill when the reported queue is still full", () => {
    const doc = applySignal(
      { cards: [], signals: [] },
      signal({ reason: "queue-low", unread: 25 }),
    );
    expect(contentStatus(doc, 20).needsRefill).toBe(false);
  });
});

describe("video mix", () => {
  it("places one video in a page of six when the bank has one", () => {
    const lessons = Array.from({ length: 6 }, (_, index) =>
      text("l" + index, "LLMs", `2026-01-01T00:00:0${index + 1}.000Z`),
    );
    const clip: ContentCard = {
      id: "v1",
      type: "video",
      topic: "LLMs",
      title: "A short clip",
      depth: "beginner",
      youtubeId: "PeMlggyqz0Y",
      durationSeconds: 155,
      channelTitle: "Fireship",
      createdAt: "2026-01-01T00:00:09.000Z",
    };
    const page = selectFeedPage(
      { cards: [...lessons, clip], signals: [] },
      { cursor: null, limit: 6, topics: ["LLMs"], exclude: [], topic: null, deeper: false },
    );
    expect(page.cards).toHaveLength(6);
    expect(page.cards.filter((card) => card.type === "video")).toHaveLength(1);
    expect(page.cards[5]?.type).toBe("video");
  });

  it("keeps refill signals when a curated video is merged", () => {
    const doc: ContentDocument = {
      cards: [text("a", "LLMs", "2026-01-01T00:00:01.000Z")],
      signals: [signal({ reason: "queue-low", unread: 3 })],
    };
    const merged = mergeCards(doc, [
      {
        id: "v1",
        type: "video",
        topic: "LLMs",
        title: "A short clip",
        depth: "beginner",
        youtubeId: "PeMlggyqz0Y",
        durationSeconds: 155,
        channelTitle: "Fireship",
        createdAt: "2026-01-02T00:00:01.000Z",
      },
    ]);
    expect(merged.signals).toHaveLength(1);
    expect(merged.cards.map((card) => card.id)).toEqual(["a", "v1"]);
  });
});

describe("parseFeedQuery", () => {
  it("reads repeated topics and rejects a bad limit", () => {
    const params = new URLSearchParams();
    params.append("topics", "LLMs");
    params.append("topics", "Agentic AI");
    params.set("limit", "4");
    const parsed = parseFeedQuery(params);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.topics).toEqual(["LLMs", "Agentic AI"]);
    expect(parsed.query.limit).toBe(4);

    const bad = parseFeedQuery(new URLSearchParams("limit=0"));
    expect(bad.ok).toBe(false);
  });
});

describe("file store", () => {
  let dir = "";
  const previous = process.env.CONTENT_DATA_PATH;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "primer-content-"));
    process.env.CONTENT_DATA_PATH = path.join(dir, "content.json");
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(async () => {
    if (previous == null) delete process.env.CONTENT_DATA_PATH;
    else process.env.CONTENT_DATA_PATH = previous;
    await rm(dir, { recursive: true, force: true });
  });

  it("starts from the seed and upserts an ingested card", async () => {
    const initial = await readContent();
    expect(initial.cards.length).toBeGreaterThan(0);
    const next = await ingestCards([
      text("custom-reel", "LLMs", "2026-04-01T00:00:01.000Z"),
    ]);
    expect(next.cards.some((card) => card.id === "custom-reel")).toBe(true);
    const again = await readContent();
    expect(again.cards.some((card) => card.id === "custom-reel")).toBe(true);
    expect(again.cards.some((card) => card.id === "llms-tokens-text")).toBe(true);
  });
});

describe("bearerMatches", () => {
  it("accepts only the exact bearer token", () => {
    expect(bearerMatches("Bearer secret-token", "secret-token")).toBe(true);
    expect(bearerMatches("Bearer other", "secret-token")).toBe(false);
    expect(bearerMatches(null, "secret-token")).toBe(false);
    expect(bearerMatches("Bearer secret-token", "")).toBe(false);
  });
});

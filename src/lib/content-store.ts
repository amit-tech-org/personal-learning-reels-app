import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import seedJson from "../../data/content.json";
import type { z } from "zod";
import { contentStoreKind, redisRestConfig, refillThreshold } from "./env";
import { contentCardSchema, needMoreRequestSchema, signalSchema } from "./schema";
import { topicsMatch } from "./text";
import type { ContentCard, ContentDocument, Depth, RefillSignal } from "./types";

const REDIS_KEY = "primer:content";

export class ContentStoreError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface FeedQuery {
  cursor: string | null;
  limit: number;
  topics: string[];
  exclude: string[];
  topic: string | null;
  deeper: boolean;
}

export interface FeedPage {
  cards: ContentCard[];
  nextCursor: string | null;
  exhausted: boolean;
}

type NeedMoreInput = z.infer<typeof needMoreRequestSchema>;

const documentCards = contentCardSchema.array();
const documentSignals = signalSchema.array();

function seedDocument(): ContentDocument {
  return parseDocument(seedJson);
}

export function parseDocument(input: unknown): ContentDocument {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const cards = documentCards.safeParse(record.cards ?? []);
  if (!cards.success) {
    throw new ContentStoreError("The content bank is not valid.", 500);
  }
  const signals = documentSignals.safeParse(record.signals ?? []);
  if (!signals.success) {
    throw new ContentStoreError("Refill signals in the content bank are not valid.", 500);
  }
  return { cards: sortCards(cards.data), signals: signals.data };
}

export function sortCards(cards: ContentCard[]): ContentCard[] {
  return [...cards].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/** About one video for every five lessons, in a stable order so cursors keep working. */
export function weaveFeed(cards: ContentCard[]): ContentCard[] {
  const lessons: ContentCard[] = [];
  const videos: ContentCard[] = [];
  for (const card of cards) {
    if (card.type === "video") videos.push(card);
    else lessons.push(card);
  }
  if (videos.length === 0 || lessons.length === 0) return [...cards];

  const woven: ContentCard[] = [];
  let lessonIndex = 0;
  let videoIndex = 0;
  while (lessonIndex < lessons.length || videoIndex < videos.length) {
    const before = woven.length;
    for (let slot = 0; slot < 5 && lessonIndex < lessons.length; slot += 1) {
      const lesson = lessons[lessonIndex];
      if (lesson) woven.push(lesson);
      lessonIndex += 1;
    }
    if (videoIndex < videos.length && lessonIndex > 0) {
      const video = videos[videoIndex];
      if (video) woven.push(video);
      videoIndex += 1;
    }
    if (lessonIndex >= lessons.length) {
      while (videoIndex < videos.length) {
        const video = videos[videoIndex];
        if (video) woven.push(video);
        videoIndex += 1;
      }
    }
    if (woven.length === before) break;
  }
  return woven;
}

export function mergeCards(doc: ContentDocument, incoming: ContentCard[]): ContentDocument {
  const byId = new Map(doc.cards.map((card) => [card.id, card]));
  for (const card of incoming) byId.set(card.id, card);
  return { ...doc, cards: sortCards([...byId.values()]) };
}

export function applyIngest(doc: ContentDocument, incoming: ContentCard[]): ContentDocument {
  const byId = new Map(doc.cards.map((card) => [card.id, card]));
  for (const card of incoming) byId.set(card.id, card);
  return { cards: sortCards([...byId.values()]), signals: [] };
}

export function applySignal(doc: ContentDocument, signal: RefillSignal): ContentDocument {
  const signals = doc.signals.filter((item) => {
    if (signal.reason === "queue-low") return item.reason !== "queue-low";
    return !(item.reason === "deeper" && item.topic === signal.topic && item.depth === signal.depth);
  });
  return { ...doc, signals: [...signals, signal].slice(-30) };
}

export function contentStatus(doc: ContentDocument, threshold = refillThreshold()) {
  const queueLow = [...doc.signals].reverse().find((item) => item.reason === "queue-low");
  const deeper = doc.signals.filter((item) => item.reason === "deeper" && item.topic);
  const unreadReported = queueLow?.unread ?? null;
  return {
    total: doc.cards.length,
    store: contentStoreKind(),
    threshold,
    needsRefill: unreadReported != null && unreadReported < threshold,
    unreadReported,
    deeperTopics: deeper.map((item) => ({
      topic: item.topic as string,
      depth: item.depth,
    })),
    pendingSignals: doc.signals.length,
    signals: doc.signals,
  };
}

const DEPTH_RANK: Record<Depth, number> = { beginner: 0, intermediate: 1, advanced: 2 };

export function selectFeedPage(doc: ContentDocument, query: FeedQuery): FeedPage {
  const topics = query.topic ? [query.topic] : query.topics;
  let ordered = sortCards(doc.cards);
  if (topics.length > 0) {
    ordered = ordered.filter((card) => topics.some((topic) => topicsMatch(card.topic, topic)));
  }

  if (query.deeper) {
    const exclude = new Set(query.exclude);
    const unseen = ordered.filter((card) => !exclude.has(card.id) && card.type !== "video");
    unseen.sort(
      (a, b) =>
        DEPTH_RANK[b.depth] - DEPTH_RANK[a.depth] || a.createdAt.localeCompare(b.createdAt),
    );
    const page = unseen.slice(0, query.limit);
    return { cards: page, nextCursor: null, exhausted: page.length === 0 };
  }

  ordered = weaveFeed(ordered);
  if (query.cursor) {
    const index = ordered.findIndex((card) => card.id === query.cursor);
    if (index >= 0) ordered = ordered.slice(index + 1);
  }
  const exclude = new Set(query.exclude);
  const unseen = ordered.filter((card) => !exclude.has(card.id));
  const page = unseen.slice(0, query.limit);
  const exhausted = page.length < query.limit;
  const last = page[page.length - 1];
  return {
    cards: page,
    nextCursor: exhausted || !last ? null : last.id,
    exhausted,
  };
}

export function parseFeedQuery(searchParams: URLSearchParams):
  | { ok: true; query: FeedQuery }
  | { ok: false; error: string } {
  const limitRaw = searchParams.get("limit");
  let limit = 6;
  if (limitRaw != null && limitRaw !== "") {
    if (!/^\d+$/.test(limitRaw)) return { ok: false, error: "limit must be a number." };
    limit = Number(limitRaw);
    if (limit < 1 || limit > 20) return { ok: false, error: "limit must be from 1 to 20." };
  }

  const topics = searchParams
    .getAll("topics")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= 80)
    .slice(0, 24);
  const exclude = searchParams
    .getAll("exclude")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= 80)
    .slice(0, 400);
  const cursor = searchParams.get("cursor")?.trim() || null;
  const topic = searchParams.get("topic")?.trim() || null;
  const deeper = searchParams.get("deeper") === "1" || searchParams.get("deeper") === "true";
  return { ok: true, query: { cursor, limit, topics, exclude, topic, deeper } };
}

function contentFile(): string {
  return process.env.CONTENT_DATA_PATH?.trim() || path.join(process.cwd(), "data", "content.json");
}

async function readContentFile(): Promise<string> {
  const override = process.env.CONTENT_DATA_PATH?.trim();
  if (override) {
    return readFile(/*turbopackIgnore: true*/ override, "utf8");
  }
  return readFile(path.join(process.cwd(), "data", "content.json"), "utf8");
}

async function redisCommand<T>(command: (string | number)[]): Promise<T> {
  const config = redisRestConfig();
  if (!config) throw new ContentStoreError("Redis is not configured.", 500);
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ContentStoreError(`Content store request failed (${response.status}).`, 502);
  }
  const body = (await response.json()) as { result?: T; error?: string };
  if (body.error) throw new ContentStoreError(body.error, 502);
  return body.result as T;
}

async function readDocument(): Promise<ContentDocument> {
  if (redisRestConfig()) {
    const raw = await redisCommand<string | null>(["GET", REDIS_KEY]);
    if (raw == null || raw === "") return seedDocument();
    return parseDocument(JSON.parse(raw) as unknown);
  }

  try {
    const raw = await readContentFile();
    return parseDocument(JSON.parse(raw) as unknown);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return seedDocument();
    if (error instanceof ContentStoreError) throw error;
    throw new ContentStoreError("Could not read the content bank.", 500);
  }
}

async function writeDocument(doc: ContentDocument): Promise<void> {
  if (redisRestConfig()) {
    await redisCommand(["SET", REDIS_KEY, JSON.stringify(doc)]);
    return;
  }

  const file = contentFile();
  const body = `${JSON.stringify(doc, null, 2)}\n`;
  try {
    if (process.env.CONTENT_DATA_PATH?.trim()) {
      await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
      await writeFile(/*turbopackIgnore: true*/ file, body, "utf8");
    } else {
      await writeFile(path.join(process.cwd(), "data", "content.json"), body, "utf8");
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EPERM" || code === "EACCES") {
      throw new ContentStoreError(
        "This host cannot write data/content.json. Set KV_REST_API_URL and KV_REST_API_TOKEN (Upstash Redis on the Vercel free tier) so ingest and refill signals persist.",
        503,
      );
    }
    throw new ContentStoreError("Could not write the content bank.", 500);
  }
}

let writeChain: Promise<void> = Promise.resolve();

async function updateDocument(
  mutate: (doc: ContentDocument) => ContentDocument,
): Promise<ContentDocument> {
  const run = writeChain.then(async () => {
    const current = await readDocument();
    const next = mutate(current);
    await writeDocument(next);
    return next;
  });
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function readContent(): Promise<ContentDocument> {
  return readDocument();
}

export async function ingestCards(cards: ContentCard[]): Promise<ContentDocument> {
  return updateDocument((doc) => applyIngest(doc, cards));
}

export async function mergeIntoBank(cards: ContentCard[]): Promise<ContentDocument> {
  return updateDocument((doc) => mergeCards(doc, cards));
}

export async function recordNeedMore(input: NeedMoreInput, now = new Date()): Promise<ContentDocument> {
  const signal: RefillSignal = {
    id: `sig_${randomUUID()}`,
    at: now.toISOString(),
    unread: input.unread,
    reason: input.reason,
    topic: input.topic,
    depth: input.depth,
    interests: input.interests,
    knownTopics: input.knownTopics,
    seenCounts: input.seenCounts,
  };
  return updateDocument((doc) => applySignal(doc, signal));
}

export async function getContentStatus() {
  const doc = await readDocument();
  return contentStatus(doc);
}

export function loadSeedDocument(): ContentDocument {
  return seedDocument();
}

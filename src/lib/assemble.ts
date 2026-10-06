import { buildDemoBatch, buildDemoDeeper } from "./demo-feed";
import { llmConfigured } from "./env";
import { mixFeed } from "./feed-mix";
import { generateDeeperCards, generateLessonCards } from "./llm";
import type { Card, FeedRequest } from "./types";
import { videosForInterests } from "./youtube";

const cache = new Map<string, { at: number; body: unknown }>();
const CACHE_MS = 45_000;

export function cachedResponse(key: string): unknown | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return hit.body;
}

export function storeResponse(key: string, body: unknown) {
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 40) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

export async function assembleFeed(request: FeedRequest): Promise<{
  cards: Card[];
  exhausted: boolean;
  source: "demo" | "live";
}> {
  if (!llmConfigured()) {
    const demo = buildDemoBatch(request);
    return { ...demo, source: "demo" };
  }

  const [generated, videos] = await Promise.all([
    generateLessonCards(request, 8),
    videosForInterests(request.interests.map((interest) => interest.topic)),
  ]);
  const mixed = mixFeed({
    candidates: [...generated, ...videos],
    interests: request.interests,
    seenIds: request.seenIds,
    recentTitles: request.recentTitles,
    knownTopics: request.knownTopics,
    knownConcepts: request.knownConcepts,
    seenCounts: request.seenCounts,
    batchSize: request.batchSize,
  });
  return { ...mixed, source: "live" };
}

export async function assembleDeeper(
  card: Card,
  request: FeedRequest,
): Promise<{ cards: Card[]; source: "demo" | "live" }> {
  if (!llmConfigured()) {
    return { cards: buildDemoDeeper(card, request), source: "demo" };
  }
  const cards = await generateDeeperCards({ ...request, card });
  const unseen = cards.filter(
    (item) => !request.seenIds.includes(item.id) && item.title !== card.title,
  );
  return { cards: unseen.slice(0, 3), source: "live" };
}

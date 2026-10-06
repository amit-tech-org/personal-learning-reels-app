import { DEMO_CARDS, stripPool, syntheticCards, syntheticDeeper } from "./demo-cards";
import { mixFeed, mulberry32, seedFromSeen } from "./feed-mix";
import { topicsMatch } from "./text";
import type { Card, FeedRequest } from "./types";

function bankFor(request: FeedRequest): Card[] {
  const main = DEMO_CARDS.filter((card) => card.pool === "main").map(stripPool);
  const extras = request.interests.flatMap((interest) => {
    const covered = main.some((card) => topicsMatch(card.topic, interest.topic));
    return covered ? [] : syntheticCards(interest.topic, interest.depth);
  });
  return [...main, ...extras];
}

export function buildDemoBatch(request: FeedRequest): { cards: Card[]; exhausted: boolean } {
  return mixFeed({
    candidates: bankFor(request),
    interests: request.interests,
    seenIds: request.seenIds,
    recentTitles: request.recentTitles,
    knownTopics: request.knownTopics,
    knownConcepts: request.knownConcepts,
    seenCounts: request.seenCounts,
    batchSize: request.batchSize,
    rng: mulberry32(seedFromSeen(request.seenIds)),
  });
}

export function buildDemoDeeper(card: Card, request: FeedRequest): Card[] {
  const seen = new Set(request.seenIds);
  const curated = DEMO_CARDS.filter(
    (item) =>
      item.pool === "deeper" &&
      topicsMatch(item.topic, card.topic) &&
      !seen.has(item.id),
  ).map(stripPool);
  const extras = syntheticDeeper(card).filter((item) => !seen.has(item.id));
  const merged: Card[] = [];
  for (const item of [...curated, ...extras]) {
    if (merged.some((existing) => existing.id === item.id)) continue;
    if (merged.some((existing) => existing.title === item.title)) continue;
    merged.push(item);
    if (merged.length === 3) break;
  }
  return merged;
}

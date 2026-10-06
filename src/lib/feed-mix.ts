import type { Card, CardType, Interest, KnownTopic } from "./types";
import { depthDistance, targetDepth } from "./progress";
import { titlesTooSimilar, topicsMatch } from "./text";

/** Mostly text, one image, one short video per six reels. */
export const SLOT_PATTERN: CardType[] = [
  "text",
  "text",
  "image",
  "text",
  "video",
  "text",
];

export interface MixInput {
  candidates: Card[];
  interests: Pick<Interest, "topic" | "weight" | "depth">[];
  seenIds?: string[];
  recentTitles?: string[];
  knownTopics?: KnownTopic[];
  knownConcepts?: string[];
  seenCounts?: Record<string, number>;
  batchSize?: number;
  cardsPerLevel?: number;
  rng?: () => number;
}

export interface MixResult {
  cards: Card[];
  exhausted: boolean;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromSeen(ids: string[]): number {
  let hash = 2166136261 ^ ids.length;
  const tail = ids.slice(-8).join("|");
  for (let i = 0; i < tail.length; i++) {
    hash ^= tail.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seenCountFor(
  topic: string,
  counts: Record<string, number>,
): number {
  if (counts[topic] != null) return counts[topic];
  const found = Object.entries(counts).find(([key]) => topicsMatch(key, topic));
  return found?.[1] ?? 0;
}

function strengthFor(topic: string, known: KnownTopic[]): number {
  return known.find((item) => topicsMatch(item.topic, topic))?.strength ?? 0;
}

export function mixFeed(input: MixInput): MixResult {
  const rng = input.rng ?? Math.random;
  const batchSize = input.batchSize ?? SLOT_PATTERN.length;
  const interests = input.interests.filter((item) => item.topic.trim() && item.weight > 0);
  const seen = new Set(input.seenIds ?? []);
  const blockedTitles = [...(input.recentTitles ?? [])];
  const knownTopics = input.knownTopics ?? [];
  const conceptSet = new Set((input.knownConcepts ?? []).map((item) => item.toLowerCase()));
  const seenCounts = input.seenCounts ?? {};

  const pool = input.candidates.filter((card) => {
    if (seen.has(card.id)) return false;
    if (!interests.some((item) => topicsMatch(item.topic, card.topic))) return false;
    if (blockedTitles.some((title) => titlesTooSimilar(title, card.title))) return false;
    return true;
  });

  const used = new Set<string>();
  const picked: Card[] = [];

  const available = () => pool.filter((card) => !used.has(card.id));

  function fresh(cards: Card[]): Card[] {
    return cards.filter(
      (card) => !blockedTitles.some((title) => titlesTooSimilar(title, card.title)),
    );
  }

  function score(card: Card): number {
    const interest = interests.find((item) => topicsMatch(item.topic, card.topic));
    if (!interest) return Number.NEGATIVE_INFINITY;
    const count = seenCountFor(interest.topic, seenCounts);
    const target = targetDepth(interest.depth, count, input.cardsPerLevel ?? 6);
    const distance = depthDistance(card.depth, target);
    const hits = (card.concepts ?? []).filter((concept) =>
      conceptSet.has(concept.toLowerCase()),
    ).length;
    return 5 - distance * 1.7 - hits * 1.1 + rng() * 0.4;
  }

  function best(cards: Card[]): Card | undefined {
    const choices = fresh(cards);
    let winner: Card | undefined;
    let winnerScore = Number.NEGATIVE_INFINITY;
    for (const card of choices) {
      const value = score(card);
      if (value > winnerScore) {
        winner = card;
        winnerScore = value;
      }
    }
    return winner;
  }

  function pickTopic(cards: Card[]) {
    const options = interests.filter((interest) =>
      cards.some((card) => topicsMatch(card.topic, interest.topic)),
    );
    if (options.length === 0) return undefined;
    const weights = options.map(
      (interest) => Math.max(0.25, interest.weight) / (1 + strengthFor(interest.topic, knownTopics)),
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = rng() * total;
    for (let i = 0; i < options.length; i++) {
      cursor -= weights[i] ?? 0;
      if (cursor <= 0) return options[i];
    }
    return options[options.length - 1];
  }

  function pickOfType(type: CardType): Card | undefined {
    const typed = fresh(available().filter((card) => card.type === type));
    if (typed.length === 0) return undefined;
    const topic = pickTopic(typed);
    if (!topic) return best(typed);
    const scoped = typed.filter((card) => topicsMatch(card.topic, topic.topic));
    return best(scoped) ?? best(typed);
  }

  function pickSlot(preferred: CardType): Card | undefined {
    const direct = pickOfType(preferred);
    if (direct) return direct;
    for (const fallback of ["text", "image", "video"] as const) {
      if (fallback === preferred) continue;
      const card = pickOfType(fallback);
      if (card) return card;
    }
    return best(available());
  }

  for (let index = 0; index < batchSize; index++) {
    const preferred = SLOT_PATTERN[index % SLOT_PATTERN.length] ?? "text";
    const card = pickSlot(preferred);
    if (!card) break;
    used.add(card.id);
    picked.push(card);
    blockedTitles.push(card.title);
  }

  return {
    cards: picked,
    exhausted: available().length === 0,
  };
}

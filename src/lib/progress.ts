import type { Depth } from "./types";

const ORDER: Depth[] = ["beginner", "intermediate", "advanced"];

/** Move one level deeper after every `cardsPerLevel` reels on that topic. */
export function targetDepth(
  start: Depth,
  seenCount: number,
  cardsPerLevel = 6,
): Depth {
  const startIdx = Math.max(0, ORDER.indexOf(start));
  const bumps =
    cardsPerLevel > 0 ? Math.floor(Math.max(0, seenCount) / cardsPerLevel) : 0;
  return ORDER[Math.min(ORDER.length - 1, startIdx + bumps)] ?? "beginner";
}

export function depthDistance(card: Depth, target: Depth): number {
  return Math.abs(ORDER.indexOf(card) - ORDER.indexOf(target));
}

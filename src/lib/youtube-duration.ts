const DURATION =
  /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

/**
 * Parse a YouTube `contentDetails.duration` value (ISO 8601, time-only).
 * Returns total seconds, or null when the value is missing or not a duration.
 */
export function parseIso8601Duration(input: string): number | null {
  const value = input.trim().toUpperCase();
  if (!value || value === "PT") return null;
  const match = DURATION.exec(value);
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  const seconds = match[3] ? Number(match[3]) : 0;
  if (!match[1] && !match[2] && !match[3]) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export const REEL_MAX_SECONDS = 180;

/** True when a duration is a real clip no longer than the reel cap. */
export function isWithinReelLimit(
  input: string,
  maxSeconds = REEL_MAX_SECONDS,
): boolean {
  const seconds = parseIso8601Duration(input);
  return seconds !== null && seconds > 0 && seconds <= maxSeconds;
}

export function filterByDuration<T extends { duration: string }>(
  items: T[],
  maxSeconds = REEL_MAX_SECONDS,
): T[] {
  return items.filter((item) => isWithinReelLimit(item.duration, maxSeconds));
}

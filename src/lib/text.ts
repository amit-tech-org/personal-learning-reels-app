export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(title: string): string[] {
  return normalizeTitle(title)
    .split(" ")
    .filter((word) => word.length > 2);
}

/** True when two titles would feel like the same reel. */
export function titlesTooSimilar(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const setB = new Set(tb);
  let intersection = 0;
  for (const word of ta) {
    if (setB.has(word)) intersection += 1;
  }
  const union = new Set([...ta, ...tb]).size;
  return union > 0 && intersection / union >= 0.72;
}

export function normTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function topicsMatch(a: string, b: string): boolean {
  return normTopic(a) === normTopic(b);
}

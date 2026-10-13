/** Stable id so the same lesson is recognized across sessions and batches. */
export function makeCardId(topic: string, title: string, type: string): string {
  const s = `${type}|${topic}|${title}`.trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `c_${(h >>> 0).toString(16).padStart(8, "0")}`;
}

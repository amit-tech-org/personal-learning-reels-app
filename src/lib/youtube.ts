import { youtubeConfigured } from "./env";
import { mergeIntoBank } from "./content-store";
import { filterByDuration, parseIso8601Duration, REEL_MAX_SECONDS } from "./youtube-duration";
import { topicsMatch } from "./text";
import type { ContentCard, ContentDocument } from "./types";

/** Search again when fewer than this many unseen videos remain for the requested topics. */
export const VIDEO_UNSEEN_FLOOR = 2;
const TOPICS_PER_PASS = 2;
const CACHE_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 60_000;
const DAILY_SEARCH_CAP = 24;

export interface YoutubeVideoDetails {
  id: string;
  duration: string;
  title?: string;
  channelTitle?: string;
  description?: string;
}

interface SearchItem {
  id?: { videoId?: string };
}

interface VideoItem {
  id?: string;
  snippet?: { title?: string; channelTitle?: string; description?: string };
  contentDetails?: { duration?: string };
}

const topicCache = new Map<string, { at: number; cards: ContentCard[] }>();
let lastNetworkAt = 0;
let budgetDay = "";
let budgetCount = 0;
let inflight: Promise<ContentCard[]> | null = null;

export function resetYoutubeCuratorForTests() {
  topicCache.clear();
  lastNetworkAt = 0;
  budgetDay = "";
  budgetCount = 0;
  inflight = null;
}

export function unseenVideoCount(
  doc: ContentDocument,
  topics: string[],
  exclude: string[],
): number {
  const skipped = new Set(exclude);
  return doc.cards.filter((card) => {
    if (card.type !== "video" || !card.youtubeId) return false;
    if (skipped.has(card.id)) return false;
    if (topics.length === 0) return true;
    return topics.some((topic) => topicsMatch(card.topic, topic));
  }).length;
}

export function dedupeVideoCards(existing: ContentCard[], incoming: ContentCard[]): ContentCard[] {
  const seen = new Set(
    existing.map((card) => card.youtubeId).filter((id): id is string => Boolean(id)),
  );
  const novel: ContentCard[] = [];
  for (const card of incoming) {
    if (!card.youtubeId || seen.has(card.youtubeId)) continue;
    seen.add(card.youtubeId);
    novel.push(card);
  }
  return novel;
}

function oneLine(description: string | undefined): string | undefined {
  const clean = (description ?? "").replace(/\s+/g, " ").trim();
  if (clean.length < 20) return undefined;
  const sentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  const line = sentence.slice(0, 280).trim();
  return line.length >= 20 ? line : undefined;
}

export function cardsFromYoutubeDetails(
  topic: string,
  items: YoutubeVideoDetails[],
  createdAt = new Date().toISOString(),
): ContentCard[] {
  const short = filterByDuration(items);
  const cards: ContentCard[] = [];
  const seen = new Set<string>();
  for (const item of short) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(item.id) || seen.has(item.id)) continue;
    const seconds = parseIso8601Duration(item.duration);
    if (seconds == null || seconds <= 0 || seconds > REEL_MAX_SECONDS) continue;
    seen.add(item.id);
    const title = (item.title?.trim() || `${topic} in under three minutes`).slice(0, 140);
    const card: ContentCard = {
      id: `yt_${item.id}`,
      type: "video",
      topic: topic.slice(0, 80),
      title,
      depth: "beginner",
      youtubeId: item.id,
      durationSeconds: seconds,
      channelTitle: (item.channelTitle?.trim() || "YouTube").slice(0, 120),
      createdAt,
    };
    const takeaway = oneLine(item.description);
    if (takeaway) card.takeaway = takeaway;
    cards.push(card);
  }
  return cards;
}

async function searchShortVideos(topic: string, limit = 1): Promise<ContentCard[]> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return [];
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("videoEmbeddable", "true");
  searchUrl.searchParams.set("videoDuration", "short");
  searchUrl.searchParams.set("safeSearch", "moderate");
  searchUrl.searchParams.set("maxResults", "8");
  searchUrl.searchParams.set("q", `${topic} explained`);
  searchUrl.searchParams.set("key", key);

  const searchResponse = await fetch(searchUrl, { signal: AbortSignal.timeout(8_000) });
  if (!searchResponse.ok) return [];
  const searchJson = (await searchResponse.json()) as { items?: SearchItem[] };
  const ids = (searchJson.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("part", "contentDetails,snippet");
  videosUrl.searchParams.set("id", ids.join(","));
  videosUrl.searchParams.set("key", key);
  const videosResponse = await fetch(videosUrl, { signal: AbortSignal.timeout(8_000) });
  if (!videosResponse.ok) return [];
  const videosJson = (await videosResponse.json()) as { items?: VideoItem[] };
  const details: YoutubeVideoDetails[] = [];
  for (const item of videosJson.items ?? []) {
    const duration = item.contentDetails?.duration;
    if (!item.id || !duration) continue;
    details.push({
      id: item.id,
      duration,
      title: item.snippet?.title,
      channelTitle: item.snippet?.channelTitle,
      description: item.snippet?.description,
    });
  }
  return cardsFromYoutubeDetails(topic, details).slice(0, limit);
}

function budgetAllows(now: number): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  if (budgetDay !== today) {
    budgetDay = today;
    budgetCount = 0;
  }
  if (budgetCount >= DAILY_SEARCH_CAP) return false;
  if (now - lastNetworkAt < MIN_GAP_MS) return false;
  return true;
}

async function curateUncached(topics: string[], now: number): Promise<ContentCard[]> {
  const wanted = [...new Set(topics.map((topic) => topic.trim()).filter(Boolean))].slice(0, TOPICS_PER_PASS);
  const cards: ContentCard[] = [];
  const missing: string[] = [];
  for (const topic of wanted) {
    const cached = topicCache.get(topic.toLowerCase());
    if (cached && now - cached.at < CACHE_MS) cards.push(...cached.cards);
    else missing.push(topic);
  }
  if (missing.length === 0 || !budgetAllows(now)) return cards;

  for (const topic of missing) {
    if (!budgetAllows(now)) break;
    lastNetworkAt = now;
    budgetCount += 1;
    let found: ContentCard[] = [];
    try {
      found = await searchShortVideos(topic, 1);
    } catch {
      found = [];
    }
    topicCache.set(topic.toLowerCase(), { at: now, cards: found });
    cards.push(...found);
  }
  return cards;
}

export function curateShortVideos(topics: string[], now = Date.now()): Promise<ContentCard[]> {
  if (!youtubeConfigured() || topics.length === 0) return Promise.resolve([]);
  if (inflight) return inflight;
  inflight = curateUncached(topics, now).finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function topUpShortVideos(
  doc: ContentDocument,
  topics: string[],
  exclude: string[],
): Promise<ContentDocument> {
  if (!youtubeConfigured() || topics.length === 0) return doc;
  if (unseenVideoCount(doc, topics, exclude) >= VIDEO_UNSEEN_FLOOR) return doc;
  try {
    const found = await curateShortVideos(topics);
    const novel = dedupeVideoCards(doc.cards, found);
    if (novel.length === 0) return doc;
    return await mergeIntoBank(novel);
  } catch {
    return doc;
  }
}

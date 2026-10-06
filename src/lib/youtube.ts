import { makeCardId } from "./ids";
import type { Card } from "./types";
import { youtubeConfigured } from "./env";
import { filterByDuration, parseIso8601Duration } from "./youtube-duration";

interface SearchItem {
  id?: { videoId?: string };
}

interface VideoItem {
  id?: string;
  snippet?: { title?: string; channelTitle?: string; description?: string };
  contentDetails?: { duration?: string };
}

function snippetTakeaway(description: string | undefined, title: string): string {
  const clean = (description ?? "").replace(/\s+/g, " ").trim();
  if (clean.length >= 40) return clean.slice(0, 220);
  return `A short video on ${title}. Stop when you can restate the idea in one sentence.`;
}

export async function searchShortVideos(topic: string, limit = 2): Promise<Card[]> {
  if (!youtubeConfigured()) return [];
  const key = process.env.YOUTUBE_API_KEY!.trim();
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("videoEmbeddable", "true");
  searchUrl.searchParams.set("videoDuration", "short");
  searchUrl.searchParams.set("safeSearch", "moderate");
  searchUrl.searchParams.set("maxResults", "8");
  searchUrl.searchParams.set("q", `${topic} explained`);
  searchUrl.searchParams.set("key", key);

  const searchResponse = await fetch(searchUrl, { signal: AbortSignal.timeout(12_000) });
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
  const videosResponse = await fetch(videosUrl, { signal: AbortSignal.timeout(12_000) });
  if (!videosResponse.ok) return [];
  const videosJson = (await videosResponse.json()) as { items?: VideoItem[] };

  const shortOnes = filterByDuration(
    (videosJson.items ?? []).flatMap((item) => {
      const duration = item.contentDetails?.duration;
      if (!item.id || !duration) return [];
      return [{ ...item, duration }];
    }),
  );

  return shortOnes.slice(0, limit).map((item) => {
    const title = (item.snippet?.title?.trim() || `${topic} in under three minutes`).slice(0, 140);
    const seconds = parseIso8601Duration(item.duration);
    const card: Card = {
      id: makeCardId(topic, title, "video"),
      type: "video",
      topic,
      title,
      depth: "beginner",
      youtubeId: item.id,
      durationSeconds: seconds ?? undefined,
      channelTitle: item.snippet?.channelTitle,
      caption: item.snippet?.description?.replace(/\s+/g, " ").trim().slice(0, 280),
      takeaway: snippetTakeaway(item.snippet?.description, title),
      concepts: [topic.toLowerCase(), "video"],
    };
    return card;
  });
}

export async function videosForInterests(
  topics: string[],
): Promise<Card[]> {
  if (!youtubeConfigured() || topics.length === 0) return [];
  const chosen = topics.slice(0, 2);
  const batches = await Promise.all(
    chosen.map(async (topic) => {
      try {
        return await searchShortVideos(topic, 1);
      } catch {
        return [];
      }
    }),
  );
  return batches.flat();
}

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContentCard, ContentDocument } from "./types";
import {
  cardsFromYoutubeDetails,
  curateShortVideos,
  dedupeVideoCards,
  resetYoutubeCuratorForTests,
  unseenVideoCount,
} from "./youtube";

const video = (id: string, topic = "LLMs"): ContentCard => ({
  id: `yt_${id}`,
  type: "video",
  topic,
  title: `Clip ${id}`,
  depth: "beginner",
  youtubeId: id,
  durationSeconds: 90,
  channelTitle: "Fireship",
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("cardsFromYoutubeDetails", () => {
  it("keeps embeddable clips at three minutes and drops longer or duplicate ids", () => {
    const cards = cardsFromYoutubeDetails(
      "LLMs",
      [
        { id: "abcdefghijk", duration: "PT2M29S", title: "A short lesson", channelTitle: "Fireship", description: "Tokens are the unit the model actually reads." },
        { id: "abcdefghijk", duration: "PT1M", title: "Duplicate", channelTitle: "Fireship" },
        { id: "lmnopqrstuv", duration: "PT15M30S", title: "A lecture", channelTitle: "Fireship" },
        { id: "shortandok1", duration: "PT3M", title: "Right at the cap", channelTitle: "Fireship" },
        { id: "not-an-id", duration: "PT1M", title: "Bad id", channelTitle: "Fireship" },
      ],
      "2026-03-01T00:00:00.000Z",
    );
    expect(cards.map((card) => card.youtubeId)).toEqual(["abcdefghijk", "shortandok1"]);
    expect(cards[0]?.durationSeconds).toBe(149);
    expect(cards[0]?.id).toBe("yt_abcdefghijk");
    expect(cards[0]?.takeaway).toMatch(/Tokens/);
    expect(cards.every((card) => (card.durationSeconds ?? 999) <= 180)).toBe(true);
  });
});

describe("dedupeVideoCards", () => {
  it("drops a video the bank already has", () => {
    const novel = dedupeVideoCards(
      [video("abcdefghijk")],
      [video("abcdefghijk"), video("shortandok1", "System Design")],
    );
    expect(novel.map((card) => card.youtubeId)).toEqual(["shortandok1"]);
  });
});

describe("unseenVideoCount", () => {
  const doc: ContentDocument = {
    cards: [video("abcdefghijk", "LLMs"), video("shortandok1", "System Design")],
    signals: [],
  };

  it("counts videos for the requested topics that this browser has not queued", () => {
    expect(unseenVideoCount(doc, ["LLMs"], [])).toBe(1);
    expect(unseenVideoCount(doc, ["LLMs"], ["yt_abcdefghijk"])).toBe(0);
  });
});

describe("curateShortVideos", () => {
  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
    resetYoutubeCuratorForTests();
    vi.restoreAllMocks();
  });

  it("does not call YouTube when the key is unset", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(curateShortVideos(["LLMs"])).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { parseIngestBatch } from "./schema";

const textCard = {
  id: "llms-tokens-text",
  type: "text",
  topic: "LLMs",
  title: "A token is not a word",
  depth: "beginner",
  bullets: [
    "Tokens are pieces of words.",
    "Cost is counted in tokens.",
    "Rare words split apart.",
  ],
  takeaway: "Budget tokens, not words.",
  createdAt: "2026-01-01T00:00:01.000Z",
  concepts: ["tokens"],
};

describe("parseIngestBatch", () => {
  it("accepts a text card with the id the bot sent", () => {
    const parsed = parseIngestBatch({ cards: [textCard] });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.cards[0]?.id).toBe("llms-tokens-text");
    expect(parsed.cards[0]?.bullets).toHaveLength(3);
  });

  it("accepts a text card that uses a body instead of bullets", () => {
    const parsed = parseIngestBatch({
      cards: [
        {
          id: "rag-retrieval-text",
          type: "text",
          topic: "RAG",
          title: "Why retrieval sits in front",
          depth: "beginner",
          body: "The model writes from the passages you just fetched. If those passages are wrong or missing, the prose cannot repair the fact.",
          takeaway: "Generation is the last step.",
          createdAt: "2026-01-02T00:00:01.000Z",
        },
      ],
    });
    expect(parsed.ok).toBe(true);
  });

  it("rejects a text card that is too thin to read", () => {
    const parsed = parseIngestBatch({
      cards: [
        {
          ...textCard,
          id: "llms-thin-text",
          bullets: undefined,
          body: "Too short.",
        },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/bullets/i);
  });

  it("rejects two bullets because a text reel needs three to six", () => {
    const parsed = parseIngestBatch({
      cards: [{ ...textCard, bullets: ["Only one.", "Only two."] }],
    });
    expect(parsed.ok).toBe(false);
  });

  it("accepts a diagram card with mermaid source", () => {
    const parsed = parseIngestBatch({
      cards: [
        {
          id: "llms-block-diagram",
          type: "diagram",
          topic: "LLMs",
          title: "One token goes around the block",
          depth: "intermediate",
          mermaid: "flowchart LR\n  P[Prompt] --> N[Next token]",
          takeaway: "Generation is a loop.",
          createdAt: "2026-01-01T00:00:03.000Z",
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.cards[0]?.mermaid).toMatch(/flowchart/);
  });

  it("rejects a diagram card with no mermaid source", () => {
    const parsed = parseIngestBatch({
      cards: [
        {
          id: "llms-missing-diagram",
          type: "diagram",
          topic: "LLMs",
          title: "Missing picture",
          depth: "beginner",
          takeaway: "No diagram.",
          createdAt: "2026-01-01T00:00:03.000Z",
        },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/mermaid/i);
  });

  it("rejects an image card", () => {
    const parsed = parseIngestBatch({
      cards: [{ ...textCard, type: "image" }],
    });
    expect(parsed.ok).toBe(false);
  });

  it("accepts a short video and rejects one past three minutes", () => {
    const ok = parseIngestBatch({
      cards: [
        {
          id: "db-sql-video",
          type: "video",
          topic: "Databases",
          title: "SQL in 100 seconds",
          depth: "beginner",
          youtubeId: "zsjvFFKOm3c",
          durationSeconds: 142,
          channelTitle: "Fireship",
          createdAt: "2026-01-03T00:00:01.000Z",
        },
      ],
    });
    expect(ok.ok).toBe(true);

    const tooLong = parseIngestBatch({
      cards: [
        {
          id: "db-long-video",
          type: "video",
          topic: "Databases",
          title: "A long lecture",
          depth: "beginner",
          youtubeId: "zsjvFFKOm3c",
          durationSeconds: 181,
          channelTitle: "Fireship",
          createdAt: "2026-01-03T00:00:02.000Z",
        },
      ],
    });
    expect(tooLong.ok).toBe(false);
  });

  it("accepts a video with no takeaway and rejects one with no channel", () => {
    const ok = parseIngestBatch({
      cards: [
        {
          id: "llms-ml-video",
          type: "video",
          topic: "LLMs",
          title: "Machine learning in 100 seconds",
          depth: "beginner",
          youtubeId: "PeMlggyqz0Y",
          durationSeconds: 155,
          channelTitle: "Fireship",
          createdAt: "2026-01-03T00:00:04.000Z",
        },
      ],
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.cards[0]?.takeaway).toBeUndefined();

    const noChannel = parseIngestBatch({
      cards: [
        {
          id: "llms-ml-video",
          type: "video",
          topic: "LLMs",
          title: "Machine learning in 100 seconds",
          depth: "beginner",
          youtubeId: "PeMlggyqz0Y",
          durationSeconds: 155,
          createdAt: "2026-01-03T00:00:04.000Z",
        },
      ],
    });
    expect(noChannel.ok).toBe(false);
  });

  it("rejects a video that has no youtube id", () => {
    const parsed = parseIngestBatch({
      cards: [
        {
          id: "db-blank-video",
          type: "video",
          topic: "Databases",
          title: "Untitled clip",
          depth: "beginner",
          takeaway: "Nothing to play.",
          createdAt: "2026-01-03T00:00:03.000Z",
        },
      ],
    });
    expect(parsed.ok).toBe(false);
  });

  it("rejects a batch that repeats an id", () => {
    const parsed = parseIngestBatch({ cards: [textCard, textCard] });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/duplicate/i);
  });
});

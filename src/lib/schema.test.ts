import { describe, expect, it } from "vitest";
import { makeCardId } from "./ids";
import { parseGeneratedBatch } from "./schema";

const textCard = {
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
  concepts: ["tokens"],
};

describe("parseGeneratedBatch", () => {
  it("accepts a text card and assigns a stable id", () => {
    const parsed = parseGeneratedBatch({ cards: [textCard] });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.cards[0]?.id).toBe(makeCardId("LLMs", "A token is not a word", "text"));
    expect(parsed.cards[0]?.bullets).toHaveLength(3);
  });

  it("accepts a text card that explains instead of listing bullets", () => {
    const parsed = parseGeneratedBatch({
      cards: [
        {
          type: "text",
          topic: "RAG",
          title: "Why retrieval sits in front",
          depth: "beginner",
          explanation:
            "The model writes from the passages you just fetched. If those passages are wrong or missing, the prose cannot repair the fact.",
          takeaway: "Generation is the last step.",
        },
      ],
    });
    expect(parsed.ok).toBe(true);
  });

  it("rejects a text card that is too thin to read", () => {
    const parsed = parseGeneratedBatch({
      cards: [
        {
          type: "text",
          topic: "LLMs",
          title: "Too vague",
          depth: "beginner",
          explanation: "Too short.",
          takeaway: "Nothing here.",
        },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/bullets/i);
  });

  it("rejects two bullets because a text reel needs three to six", () => {
    const parsed = parseGeneratedBatch({
      cards: [{ ...textCard, bullets: ["Only one.", "Only two."] }],
    });
    expect(parsed.ok).toBe(false);
  });

  it("accepts an image card with mermaid and drops the image prompt from the card", () => {
    const parsed = parseGeneratedBatch({
      cards: [
        {
          type: "image",
          topic: "RAG",
          title: "Retrieve then write",
          depth: "beginner",
          mermaid: "flowchart LR\n  Q[Question] --> A[Answer]",
          caption: "Search first.",
          takeaway: "The passage is the source.",
          imagePrompt: "a library",
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.cards[0]).not.toHaveProperty("imagePrompt");
    expect(parsed.imagePrompts[0]?.prompt).toBe("a library");
  });

  it("rejects an image card with no visual", () => {
    const parsed = parseGeneratedBatch({
      cards: [
        {
          type: "image",
          topic: "RAG",
          title: "Missing picture",
          depth: "beginner",
          caption: "Nothing to look at.",
          takeaway: "No diagram.",
        },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/imageUrl|mermaid|imagePrompt/i);
  });

  it("accepts a short video and rejects one past three minutes", () => {
    const ok = parseGeneratedBatch({
      cards: [
        {
          type: "video",
          topic: "Databases",
          title: "SQL in 100 seconds",
          depth: "beginner",
          youtubeId: "zsjvFFKOm3c",
          durationSeconds: 142,
          takeaway: "Ask for the rows you want.",
        },
      ],
    });
    expect(ok.ok).toBe(true);

    const tooLong = parseGeneratedBatch({
      cards: [
        {
          type: "video",
          topic: "Databases",
          title: "A long lecture",
          depth: "beginner",
          youtubeId: "zsjvFFKOm3c",
          durationSeconds: 181,
          takeaway: "Too long for a reel.",
        },
      ],
    });
    expect(tooLong.ok).toBe(false);
  });

  it("rejects a video that has no youtube id", () => {
    const parsed = parseGeneratedBatch({
      cards: [
        {
          type: "video",
          topic: "Databases",
          title: "Untitled clip",
          depth: "beginner",
          takeaway: "Nothing to play.",
        },
      ],
    });
    expect(parsed.ok).toBe(false);
  });

  it("reads a fenced JSON array and ignores the surrounding prose", () => {
    const raw = `Here you go:\n\`\`\`json\n${JSON.stringify([textCard])}\n\`\`\`\nHope that helps.`;
    const parsed = parseGeneratedBatch(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.cards).toHaveLength(1);
    expect(parsed.cards[0]?.title).toBe(textCard.title);
  });

  it("returns a repairable error when the model emits prose", () => {
    const parsed = parseGeneratedBatch("I could not decide on a lesson.");
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.length).toBeGreaterThan(0);
  });
});

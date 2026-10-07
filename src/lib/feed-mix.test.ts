import { describe, expect, it } from "vitest";
import { mixFeed, mulberry32 } from "./feed-mix";
import { targetDepth } from "./progress";
import type { Card, Depth } from "./types";

function card(
  partial: Partial<Card> & Pick<Card, "id" | "topic" | "title" | "type">,
): Card {
  return {
    depth: "beginner",
    takeaway: "Remember this.",
    ...partial,
  };
}

const interests = [
  { topic: "LLMs", weight: 3, depth: "beginner" as const },
  { topic: "Databases", weight: 3, depth: "beginner" as const },
];

describe("targetDepth", () => {
  it("walks from the chosen start toward advanced", () => {
    expect(targetDepth("beginner", 0)).toBe("beginner");
    expect(targetDepth("beginner", 5)).toBe("beginner");
    expect(targetDepth("beginner", 6)).toBe("intermediate");
    expect(targetDepth("beginner", 12)).toBe("advanced");
    expect(targetDepth("intermediate", 0)).toBe("intermediate");
    expect(targetDepth("advanced", 40)).toBe("advanced");
  });
});

describe("mixFeed", () => {
  const library: Card[] = [
    card({
      id: "a1",
      type: "text",
      topic: "LLMs",
      title: "Tokens are pieces",
      concepts: ["tokens"],
    }),
    card({
      id: "a2",
      type: "text",
      topic: "LLMs",
      title: "Tokens are pieces of words",
    }),
    card({
      id: "a3",
      type: "diagram",
      topic: "LLMs",
      title: "A small diagram of a layer",
      mermaid: "flowchart LR\n  A --> B",
    }),
    card({
      id: "a4",
      type: "video",
      topic: "LLMs",
      title: "A one minute tour",
      youtubeId: "abcdefghijk",
      durationSeconds: 60,
    }),
    card({ id: "b1", type: "text", topic: "Databases", title: "Indexes jump" }),
    card({ id: "b2", type: "text", topic: "Databases", title: "Transactions promise" }),
    card({ id: "b3", type: "diagram", topic: "Databases", title: "A lookup diagram" }),
    card({ id: "c1", type: "text", topic: "Cooking", title: "Not your topic" }),
  ];

  it("drops seen ids, foreign topics, and near-duplicate titles", () => {
    const mixed = mixFeed({
      candidates: library,
      interests,
      seenIds: ["b1"],
      recentTitles: ["Tokens are pieces"],
      batchSize: 6,
      rng: mulberry32(1),
    });
    const ids = mixed.cards.map((item) => item.id);
    expect(ids).not.toContain("b1");
    expect(ids).not.toContain("c1");
    expect(ids).not.toContain("a1");
    expect(ids).not.toContain("a2");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes a diagram and a video when the pool has them", () => {
    const mixed = mixFeed({
      candidates: library,
      interests,
      batchSize: 6,
      rng: mulberry32(2),
    });
    expect(mixed.cards.some((item) => item.type === "text")).toBe(true);
    expect(mixed.cards.some((item) => item.type === "diagram")).toBe(true);
    expect(mixed.cards.some((item) => item.type === "video")).toBe(true);
    expect(mixed.cards.filter((item) => item.type === "text").length).toBeGreaterThan(
      mixed.cards.filter((item) => item.type === "video").length,
    );
  });

  it("fills the batch without videos when none are short enough to include", () => {
    const textOnly = library.filter((item) => item.type !== "video");
    const mixed = mixFeed({
      candidates: textOnly,
      interests,
      batchSize: 4,
      rng: mulberry32(3),
    });
    expect(mixed.cards.length).toBeGreaterThan(0);
    expect(mixed.cards.every((item) => item.type !== "video")).toBe(true);
  });

  it("weights a stronger interest more often across batches", () => {
    const heavyWords = ["amber", "basil", "cedar", "delta", "ember", "flint", "grove", "hazel", "ivory", "juniper", "kelp", "linen"];
    const lightWords = ["maple", "nectar", "onyx", "pebble", "quartz", "river", "spruce", "thistle", "umber", "violet", "willow", "yarrow"];
    const cards: Card[] = heavyWords.map((word, i) =>
      card({ id: `h${i}`, type: "text", topic: "Heavy", title: `Remember ${word} today` }),
    ).concat(
      lightWords.map((word, i) =>
        card({ id: `l${i}`, type: "text", topic: "Light", title: `Notice ${word} closely` }),
      ),
    );
    let heavy = 0;
    let light = 0;
    for (let batch = 0; batch < 40; batch++) {
      const mixed = mixFeed({
        candidates: cards,
        interests: [
          { topic: "Heavy", weight: 5, depth: "beginner" },
          { topic: "Light", weight: 1, depth: "beginner" },
        ],
        batchSize: 6,
        rng: mulberry32(100 + batch),
      });
      for (const item of mixed.cards) {
        if (item.topic === "Heavy") heavy += 1;
        if (item.topic === "Light") light += 1;
      }
    }
    expect(heavy).toBeGreaterThan(light * 2);
  });

  it("down-weights a topic the reader already knows", () => {
    const knownWords = ["anchor", "beacon", "cobalt", "dune", "elm", "fjord", "granite", "harbor", "iris", "jade"];
    const freshWords = ["kite", "lagoon", "moss", "north", "opal", "pine", "quill", "reef", "sage", "tide"];
    const cards: Card[] = knownWords.map((word, i) =>
      card({ id: `k${i}`, type: "text", topic: "Known", title: `Skip ${word} please` }),
    ).concat(
      freshWords.map((word, i) =>
        card({ id: `f${i}`, type: "text", topic: "Fresh", title: `Study ${word} slowly` }),
      ),
    );
    let known = 0;
    let fresh = 0;
    for (let batch = 0; batch < 30; batch++) {
      const mixed = mixFeed({
        candidates: cards,
        interests: [
          { topic: "Known", weight: 3, depth: "beginner" },
          { topic: "Fresh", weight: 3, depth: "beginner" },
        ],
        knownTopics: [{ topic: "Known", strength: 8 }],
        batchSize: 6,
        rng: mulberry32(400 + batch),
      });
      for (const item of mixed.cards) {
        if (item.topic === "Known") known += 1;
        if (item.topic === "Fresh") fresh += 1;
      }
    }
    expect(fresh).toBeGreaterThan(known * 2);
  });

  it("prefers the depth that matches progress on that topic", () => {
    const levels: Depth[] = ["beginner", "intermediate", "advanced"];
    const cards = levels.map((depth) =>
      card({
        id: depth,
        type: "text",
        topic: "LLMs",
        title: `${depth} lesson on attention`,
        depth,
      }),
    );
    const early = mixFeed({
      candidates: cards,
      interests: [{ topic: "LLMs", weight: 3, depth: "beginner" }],
      seenCounts: { LLMs: 0 },
      batchSize: 1,
      rng: () => 0,
    });
    expect(early.cards[0]?.depth).toBe("beginner");

    const later = mixFeed({
      candidates: cards,
      interests: [{ topic: "LLMs", weight: 3, depth: "beginner" }],
      seenCounts: { LLMs: 12 },
      batchSize: 1,
      rng: () => 0,
    });
    expect(later.cards[0]?.depth).toBe("advanced");
  });

  it("reports exhaustion once every remaining card has been used", () => {
    const only = [card({ id: "only", type: "text", topic: "LLMs", title: "Just one" })];
    const mixed = mixFeed({
      candidates: only,
      interests: [{ topic: "LLMs", weight: 3, depth: "beginner" }],
      batchSize: 6,
      rng: mulberry32(9),
    });
    expect(mixed.cards.map((item) => item.id)).toEqual(["only"]);
    expect(mixed.exhausted).toBe(true);
  });

});

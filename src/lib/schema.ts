import { z } from "zod";
import { makeCardId } from "./ids";
import type { Card } from "./types";

export const depthSchema = z.enum(["beginner", "intermediate", "advanced"]);
export const cardTypeSchema = z.enum(["text", "image", "video"]);

const youtubeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

export const generatedCardSchema = z
  .object({
    id: z.string().min(1).optional(),
    type: cardTypeSchema,
    topic: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(140),
    depth: depthSchema,
    takeaway: z.string().trim().min(1).max(280),
    bullets: z.array(z.string().trim().min(1).max(220)).min(3).max(6).optional(),
    explanation: z.string().trim().min(1).max(500).optional(),
    imageUrl: z.string().url().optional(),
    imageAlt: z.string().trim().max(200).optional(),
    caption: z.string().trim().max(400).optional(),
    mermaid: z.string().trim().min(1).max(2000).optional(),
    imageSource: z.string().trim().max(200).optional(),
    imageLicense: z.string().trim().max(120).optional(),
    imagePrompt: z.string().trim().max(300).optional(),
    youtubeId: youtubeIdSchema.optional(),
    durationSeconds: z.number().int().positive().max(180).optional(),
    channelTitle: z.string().trim().max(120).optional(),
    concepts: z.array(z.string().trim().min(1).max(48)).max(8).optional(),
    threadLabel: z.string().trim().max(80).optional(),
  })
  .superRefine((card, ctx) => {
    if (card.type === "text") {
      const bullets = card.bullets?.length ?? 0;
      const explanation = card.explanation?.trim().length ?? 0;
      if (bullets < 3 && explanation < 40) {
        ctx.addIssue({
          code: "custom",
          message: "Text cards need 3-6 bullets or a short explanation.",
          path: ["bullets"],
        });
      }
    }
    if (card.type === "image") {
      if (!card.imageUrl && !card.mermaid && !card.imagePrompt) {
        ctx.addIssue({
          code: "custom",
          message: "Image cards need imageUrl, mermaid, or imagePrompt.",
          path: ["imageUrl"],
        });
      }
      if (!card.caption && !(card.explanation && card.explanation.length > 0)) {
        ctx.addIssue({
          code: "custom",
          message: "Image cards need a caption.",
          path: ["caption"],
        });
      }
    }
    if (card.type === "video" && !card.youtubeId) {
      ctx.addIssue({
        code: "custom",
        message: "Video cards need a youtubeId.",
        path: ["youtubeId"],
      });
    }
  });

export const batchSchema = z.object({
  cards: z.array(generatedCardSchema).min(1).max(12),
});

export const interestSchema = z.object({
  topic: z.string().trim().min(1).max(60),
  weight: z.number().int().min(1).max(5),
  depth: depthSchema,
  custom: z.boolean().optional(),
});

export const feedRequestSchema = z.object({
  interests: z.array(interestSchema).min(1).max(24),
  seenIds: z.array(z.string()).max(500).default([]),
  recentTitles: z.array(z.string()).max(40).default([]),
  knownTopics: z
    .array(
      z.object({
        topic: z.string(),
        strength: z.number().min(0).max(20),
      }),
    )
    .max(40)
    .default([]),
  knownConcepts: z.array(z.string()).max(80).default([]),
  seenCounts: z.record(z.string(), z.number()).default({}),
  batchSize: z.number().int().min(1).max(8).default(6),
});

export const deeperRequestSchema = feedRequestSchema.extend({
  card: generatedCardSchema,
});

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();
  const start = body.search(/[\[{]/);
  if (start < 0) {
    throw new Error("No JSON found in model output.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth += 1;
    else if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return JSON.parse(body.slice(start, i + 1)) as unknown;
    }
  }
  throw new Error("Model output contained unbalanced JSON.");
}

export interface ParseSuccess {
  ok: true;
  cards: Card[];
  imagePrompts: { id: string; prompt: string }[];
}

export interface ParseFailure {
  ok: false;
  error: string;
}

function toCard(
  card: z.infer<typeof generatedCardSchema>,
): { card: Card; imagePrompt?: string } {
  const id = makeCardId(card.topic, card.title, card.type);
  const next: Card = {
    id,
    type: card.type,
    topic: card.topic,
    title: card.title,
    depth: card.depth,
    takeaway: card.takeaway,
    bullets: card.bullets,
    explanation: card.explanation,
    imageUrl: card.imageUrl,
    imageAlt: card.imageAlt,
    caption: card.caption,
    mermaid: card.mermaid,
    imageSource: card.imageSource,
    imageLicense: card.imageLicense,
    youtubeId: card.youtubeId,
    durationSeconds: card.durationSeconds,
    channelTitle: card.channelTitle,
    concepts: card.concepts,
    threadLabel: card.threadLabel,
  };
  return { card: next, imagePrompt: card.imagePrompt };
}

export function parseGeneratedBatch(input: unknown): ParseSuccess | ParseFailure {
  try {
    const value = typeof input === "string" ? extractJson(input) : input;
    const wrapped = Array.isArray(value) ? { cards: value } : value;
    const parsed = batchSchema.safeParse(wrapped);
    if (!parsed.success) {
      const error = parsed.error.issues
        .slice(0, 8)
        .map((issue) => `${issue.path.join(".") || "cards"}: ${issue.message}`)
        .join("; ");
      return { ok: false, error };
    }

    const imagePrompts: { id: string; prompt: string }[] = [];
    const cards = parsed.data.cards.map((raw) => {
      const { card, imagePrompt } = toCard(raw);
      if (imagePrompt) imagePrompts.push({ id: card.id, prompt: imagePrompt });
      return card;
    });
    return { ok: true, cards, imagePrompts };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not parse cards.",
    };
  }
}

export function formatIssues(error: string): string {
  return error;
}

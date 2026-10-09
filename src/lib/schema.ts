import { z } from "zod";
import type { ContentCard } from "./types";

export const depthSchema = z.enum(["beginner", "intermediate", "advanced"]);
export const cardTypeSchema = z.enum(["text", "diagram", "video"]);

const youtubeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

export const contentCardSchema = z
  .object({
    id: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
    type: cardTypeSchema,
    topic: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(140),
    depth: depthSchema,
    takeaway: z.string().trim().min(1).max(280).optional(),
    body: z.string().trim().min(1).max(1200).optional(),
    bullets: z.array(z.string().trim().min(1).max(220)).min(3).max(6).optional(),
    mermaid: z.string().trim().min(1).max(4000).optional(),
    createdAt: z.iso.datetime(),
    youtubeId: youtubeIdSchema.optional(),
    durationSeconds: z.number().int().positive().max(180).optional(),
    channelTitle: z.string().trim().max(120).optional(),
    concepts: z.array(z.string().trim().min(1).max(48)).max(8).optional(),
    threadLabel: z.string().trim().max(80).optional(),
  })
  .superRefine((card, ctx) => {
    if (card.type !== "video" && !card.takeaway) {
      ctx.addIssue({
        code: "custom",
        message: "Text and diagram cards need a takeaway.",
        path: ["takeaway"],
      });
    }
    if (card.type === "text") {
      const bullets = card.bullets?.length ?? 0;
      const body = card.body?.trim().length ?? 0;
      if (bullets < 3 && body < 40) {
        ctx.addIssue({
          code: "custom",
          message: "Text cards need 3-6 bullets or a short body.",
          path: ["bullets"],
        });
      }
    }
    if (card.type === "diagram" && !card.mermaid) {
      ctx.addIssue({
        code: "custom",
        message: "Diagram cards need mermaid source.",
        path: ["mermaid"],
      });
    }
    if (card.type === "video") {
      if (!card.youtubeId) {
        ctx.addIssue({
          code: "custom",
          message: "Video cards need a youtubeId.",
          path: ["youtubeId"],
        });
      }
      if (card.durationSeconds == null) {
        ctx.addIssue({
          code: "custom",
          message: "Video cards need durationSeconds of at most 180.",
          path: ["durationSeconds"],
        });
      }
      if (!card.channelTitle) {
        ctx.addIssue({
          code: "custom",
          message: "Video cards need a channel.",
          path: ["channelTitle"],
        });
      }
    }
  });

export const ingestBodySchema = z.object({
  cards: z.array(contentCardSchema).min(1).max(40),
}).superRefine((body, ctx) => {
  const seen = new Set<string>();
  for (const [index, card] of body.cards.entries()) {
    if (seen.has(card.id)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate card id ${card.id}.`,
        path: ["cards", index, "id"],
      });
    }
    seen.add(card.id);
  }
});

export const interestSchema = z.object({
  topic: z.string().trim().min(1).max(60),
  weight: z.number().int().min(1).max(5),
  depth: depthSchema,
  custom: z.boolean().optional(),
});

export const knownTopicSchema = z.object({
  topic: z.string().trim().min(1).max(80),
  strength: z.number().min(0).max(20),
});

export const needMoreRequestSchema = z
  .object({
    unread: z.number().int().min(0).max(10000),
    reason: z.enum(["queue-low", "deeper"]),
    topic: z.string().trim().min(1).max(80).optional(),
    depth: depthSchema.optional(),
    interests: z.array(interestSchema).max(24).default([]),
    knownTopics: z.array(knownTopicSchema).max(40).default([]),
    seenCounts: z.record(z.string(), z.number().int().min(0).max(10000)).default({}),
  })
  .superRefine((body, ctx) => {
    if (body.reason === "deeper" && !body.topic) {
      ctx.addIssue({
        code: "custom",
        message: "A deeper request needs a topic.",
        path: ["topic"],
      });
    }
  });

export const signalSchema = needMoreRequestSchema.safeExtend({
  id: z.string().trim().min(1).max(80),
  at: z.iso.datetime(),
});

export interface ParseSuccess {
  ok: true;
  cards: ContentCard[];
}

export interface ParseFailure {
  ok: false;
  error: string;
}

function issueText(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "cards"}: ${issue.message}`)
    .join("; ");
}

export function parseIngestBatch(input: unknown): ParseSuccess | ParseFailure {
  const parsed = ingestBodySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issueText(parsed.error) };
  return { ok: true, cards: parsed.data.cards };
}

export function formatIssues(error: string): string {
  return error;
}

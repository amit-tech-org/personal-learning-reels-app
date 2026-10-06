import { assembleFeed, cachedResponse, storeResponse } from "@/lib/assemble";
import { llmConfigured } from "@/lib/env";
import { consumeGeneration } from "@/lib/rate-limit";
import { feedRequestSchema } from "@/lib/schema";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = feedRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "The feed request was not valid." }, { status: 400 });
  }

  const key = JSON.stringify(parsed.data);
  const cached = cachedResponse(`feed:${key}`);
  if (cached) return Response.json(cached);

  if (llmConfigured()) {
    const budget = consumeGeneration();
    if (!budget.ok) {
      return Response.json(
        { error: budget.error },
        { status: 429, headers: { "Retry-After": String(budget.retryAfterSeconds) } },
      );
    }
  }

  try {
    const result = await assembleFeed(parsed.data);
    const payload = {
      cards: result.cards,
      exhausted: result.exhausted,
      source: result.source,
    };
    storeResponse(`feed:${key}`, payload);
    return Response.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate reels.";
    return Response.json({ error: message }, { status: 502 });
  }
}

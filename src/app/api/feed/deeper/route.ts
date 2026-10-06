import { assembleDeeper } from "@/lib/assemble";
import { llmConfigured } from "@/lib/env";
import { consumeGeneration } from "@/lib/rate-limit";
import { deeperRequestSchema } from "@/lib/schema";
import { makeCardId } from "@/lib/ids";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = deeperRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Could not read that reel." }, { status: 400 });
  }

  if (llmConfigured()) {
    const budget = consumeGeneration();
    if (!budget.ok) {
      return Response.json({ error: budget.error }, { status: 429 });
    }
  }

  const { card: rawCard, ...requestData } = parsed.data;
  const card = {
    ...rawCard,
    id: rawCard.id || makeCardId(rawCard.topic, rawCard.title, rawCard.type),
  };

  try {
    const result = await assembleDeeper(card, requestData);
    return Response.json({ cards: result.cards, source: result.source });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not go deeper.";
    return Response.json({ error: message }, { status: 502 });
  }
}

import { authorizeBot } from "@/lib/bot-auth";
import { ContentStoreError, ingestCards } from "@/lib/content-store";
import { botConfigured } from "@/lib/env";
import { parseIngestBatch } from "@/lib/schema";

export async function POST(request: Request) {
  if (!botConfigured()) {
    return Response.json(
      { error: "CONTENT_BOT_TOKEN is not set, so ingest is closed." },
      { status: 401 },
    );
  }
  if (!authorizeBot(request)) {
    return Response.json({ error: "The bot token does not match." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseIngestBatch(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const doc = await ingestCards(parsed.cards);
    return Response.json({ accepted: parsed.cards.length, total: doc.cards.length });
  } catch (error) {
    if (error instanceof ContentStoreError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Could not store cards.";
    return Response.json({ error: message }, { status: 500 });
  }
}

import { authorizeBot } from "@/lib/bot-auth";
import { ContentStoreError, getContentStatus } from "@/lib/content-store";
import { botConfigured } from "@/lib/env";

export async function GET(request: Request) {
  if (!botConfigured()) {
    return Response.json(
      { error: "CONTENT_BOT_TOKEN is not set, so status is closed." },
      { status: 401 },
    );
  }
  if (!authorizeBot(request)) {
    return Response.json({ error: "The bot token does not match." }, { status: 401 });
  }

  try {
    return Response.json(await getContentStatus());
  } catch (error) {
    if (error instanceof ContentStoreError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Could not read content status.";
    return Response.json({ error: message }, { status: 500 });
  }
}

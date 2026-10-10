import { ContentStoreError, parseFeedQuery, readContent, selectFeedPage } from "@/lib/content-store";
import { topUpShortVideos } from "@/lib/youtube";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseFeedQuery(url.searchParams);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    let doc = await readContent();
    if (!parsed.query.deeper) {
      const topics = parsed.query.topic ? [parsed.query.topic] : parsed.query.topics;
      doc = await topUpShortVideos(doc, topics, parsed.query.exclude);
    }
    const page = selectFeedPage(doc, parsed.query);
    return Response.json(page);
  } catch (error) {
    if (error instanceof ContentStoreError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Could not read the feed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

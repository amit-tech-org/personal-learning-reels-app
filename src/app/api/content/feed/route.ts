import { ContentStoreError, parseFeedQuery, readContent, selectFeedPage } from "@/lib/content-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseFeedQuery(url.searchParams);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const doc = await readContent();
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

import { ContentStoreError, recordNeedMore } from "@/lib/content-store";
import { refillThreshold } from "@/lib/env";
import { needMoreRequestSchema } from "@/lib/schema";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = needMoreRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "The refill request was not valid." }, { status: 400 });
  }

  try {
    const doc = await recordNeedMore(parsed.data);
    const queueLow = [...doc.signals].reverse().find((item) => item.reason === "queue-low");
    const threshold = refillThreshold();
    return Response.json({
      ok: true,
      needsRefill: queueLow != null && queueLow.unread < threshold,
    });
  } catch (error) {
    if (error instanceof ContentStoreError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Could not record the refill request.";
    return Response.json({ error: message }, { status: 500 });
  }
}

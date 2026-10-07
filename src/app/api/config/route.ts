import { ContentStoreError, getContentStatus } from "@/lib/content-store";
import { botConfigured, contentStoreKind, refillThreshold } from "@/lib/env";

export async function GET() {
  let total: number | null = null;
  try {
    total = (await getContentStatus()).total;
  } catch (error) {
    if (!(error instanceof ContentStoreError)) throw error;
  }

  return Response.json({
    mode: botConfigured() ? "bank" : "demo",
    store: contentStoreKind(),
    refillThreshold: refillThreshold(),
    total,
  });
}

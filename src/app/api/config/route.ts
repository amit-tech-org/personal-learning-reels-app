import {
  aiImagesEnabled,
  intEnv,
  llmConfigured,
  llmModel,
  youtubeConfigured,
} from "@/lib/env";
import { peekGeneration } from "@/lib/rate-limit";

export async function GET() {
  const budget = peekGeneration();
  return Response.json({
    mode: llmConfigured() ? "live" : "demo",
    model: llmConfigured() ? llmModel() : null,
    youtube: youtubeConfigured(),
    aiImages: aiImagesEnabled(),
    dailyCap: intEnv("GENERATION_DAILY_CAP", 40),
    usedToday: llmConfigured() ? budget.used : 0,
    remainingToday: llmConfigured() ? budget.remaining : null,
  });
}

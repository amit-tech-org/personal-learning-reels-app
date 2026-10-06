export function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

export function llmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY?.trim());
}

export function youtubeConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY?.trim());
}

export function aiImagesEnabled(): boolean {
  return process.env.ENABLE_AI_IMAGES === "true" && llmConfigured();
}

export function passcodeRequired(): boolean {
  return Boolean(process.env.APP_PASSCODE?.trim());
}

export function llmBaseUrl(): string {
  return (process.env.LLM_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
}

export function llmModel(): string {
  return process.env.LLM_MODEL?.trim() || "gpt-4o-mini";
}

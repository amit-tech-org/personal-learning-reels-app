import { aiImagesEnabled, llmBaseUrl, llmModel } from "./env";
import { parseGeneratedBatch } from "./schema";
import type { Card, FeedRequest } from "./types";
import { targetDepth } from "./progress";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("\n");
  }
  return "";
}

async function chat(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${llmBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: llmModel(),
      temperature: 0.7,
      messages,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`The model returned ${response.status}. ${detail.slice(0, 180)}`);
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const text = messageText(payload.choices?.[0]?.message?.content);
  if (!text.trim()) throw new Error("The model returned an empty lesson.");
  return text;
}

const SYSTEM = `You write short private study reels for one person. Return ONLY JSON of the form {"cards":[...]}.
No markdown fences. Do not invent YouTube ids.
Text cards need type "text", 3 to 6 short bullet strings, a one-line takeaway, topic, title, depth, and concepts.
Image cards need type "image", a valid mermaid flowchart, a caption, imageAlt, takeaway, topic, title, depth, and concepts.
Titles must be specific and must not repeat the avoided list. Bullets are concrete sentences, not pep talk.
Depth must match the target given for that topic.`;

function interestBrief(request: FeedRequest): string {
  return request.interests
    .map((interest) => {
      const target = targetDepth(interest.depth, request.seenCounts[interest.topic] ?? 0);
      return `- ${interest.topic} (weight ${interest.weight}, target depth ${target})`;
    })
    .join("\n");
}

export async function generateLessonCards(request: FeedRequest, count = 8): Promise<Card[]> {
  const user = `Write ${count} reels, mostly text, at least two image cards with mermaid.
Interests:
${interestBrief(request)}
Avoid these recent titles:
${request.recentTitles.slice(-20).join("\n") || "(none)"}
Downplay these concepts the reader already knows:
${request.knownConcepts.slice(0, 30).join(", ") || "(none)"}
Known-topic strengths (higher means show less):
${request.knownTopics.map((item) => `${item.topic}:${item.strength}`).join(", ") || "(none)"}`;

  const first = await chat([
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ]);
  const parsed = parseGeneratedBatch(first);
  if (parsed.ok) return applyImagePrompts(parsed.cards, parsed.imagePrompts);

  const repaired = await chat([
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
    { role: "assistant", content: first.slice(0, 6000) },
    {
      role: "user",
      content: `That output failed validation: ${parsed.error}. Return corrected JSON only.`,
    },
  ]);
  const second = parseGeneratedBatch(repaired);
  if (!second.ok) throw new Error(second.error);
  return applyImagePrompts(second.cards, second.imagePrompts);
}

export async function generateDeeperCards(request: FeedRequest & { card: Card }): Promise<Card[]> {
  const source = request.card;
  const user = `Write 3 follow-up reels that go one step deeper on this reel.
Topic: ${source.topic}
Title: ${source.title}
Takeaway: ${source.takeaway}
Depth to aim above: ${source.depth}
The reader already saw these titles:
${request.recentTitles.slice(-20).join("\n") || "(none)"}
Make the thread specific to the title, not a generic overview. Include one mermaid image card.`;

  const first = await chat([
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ]);
  let parsed = parseGeneratedBatch(first);
  if (!parsed.ok) {
    const repaired = await chat([
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
      { role: "assistant", content: first.slice(0, 4000) },
      { role: "user", content: `Fix this JSON. Error: ${parsed.error}. Return corrected JSON only.` },
    ]);
    parsed = parseGeneratedBatch(repaired);
  }
  if (!parsed.ok) throw new Error(parsed.error);
  const cards = await applyImagePrompts(parsed.cards, parsed.imagePrompts);
  return cards.slice(0, 4).map((card) => ({ ...card, threadLabel: card.threadLabel ?? "Deeper cut" }));
}

async function applyImagePrompts(
  cards: Card[],
  prompts: { id: string; prompt: string }[],
): Promise<Card[]> {
  if (!aiImagesEnabled() || prompts.length === 0) {
    return cards.filter((card) => card.type !== "image" || card.imageUrl || card.mermaid);
  }
  const byId = new Map(prompts.map((item) => [item.id, item.prompt]));
  const resolved = await Promise.all(
    cards.map(async (card) => {
      const prompt = byId.get(card.id);
      if (!prompt || card.imageUrl || card.mermaid) return card;
      const url = await generateAiImage(prompt);
      if (!url) return null;
      return {
        ...card,
        imageUrl: url,
        imageAlt: card.imageAlt || card.title,
        imageSource: "Generated image",
        imageLicense: "Provider terms",
      };
    }),
  );
  return resolved.filter((card): card is Card => card !== null);
}

export async function generateAiImage(prompt: string): Promise<string | null> {
  if (!aiImagesEnabled()) return null;
  try {
    const response = await fetch(`${llmBaseUrl()}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.LLM_IMAGE_MODEL?.trim() || "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: { url?: string; b64_json?: string }[];
    };
    const first = payload.data?.[0];
    if (first?.url) return first.url;
    if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
    return null;
  } catch {
    return null;
  }
}

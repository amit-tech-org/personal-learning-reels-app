import type { Depth, Interest } from "./types";

export const PRESET_TOPICS = [
  "LLMs",
  "Agentic AI",
  "System Design",
  "RAG",
  "Prompt Engineering",
  "Distributed Systems",
  "Databases",
  "Cloud/AWS",
] as const;

export function presetInterest(topic: string, depth: Depth = "beginner"): Interest {
  return { topic, weight: 3, depth, custom: false };
}

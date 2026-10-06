export const DEPTHS = ["beginner", "intermediate", "advanced"] as const;
export type Depth = (typeof DEPTHS)[number];

export const CARD_TYPES = ["text", "image", "video"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export interface Card {
  id: string;
  type: CardType;
  topic: string;
  title: string;
  depth: Depth;
  takeaway: string;
  bullets?: string[];
  explanation?: string;
  imageUrl?: string;
  imageAlt?: string;
  caption?: string;
  mermaid?: string;
  imageSource?: string;
  imageLicense?: string;
  youtubeId?: string;
  durationSeconds?: number;
  channelTitle?: string;
  concepts?: string[];
  threadLabel?: string;
}

export interface Interest {
  topic: string;
  weight: number;
  depth: Depth;
  custom?: boolean;
}

export interface KnownTopic {
  topic: string;
  strength: number;
}

export interface FeedRequest {
  interests: Interest[];
  seenIds: string[];
  recentTitles: string[];
  knownTopics: KnownTopic[];
  knownConcepts: string[];
  seenCounts: Record<string, number>;
  batchSize: number;
}

export interface LibraryCard extends Card {
  liked: boolean;
  saved: boolean;
  known: boolean;
  seenAt?: number;
  savedAt?: number;
}

export interface Profile {
  onboarded: boolean;
  interests: Interest[];
}

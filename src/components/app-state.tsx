"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  eraseLibrary,
  loadLibrary,
  replaceCards,
  saveCard,
  saveProfile,
  saveQueue,
} from "@/lib/idb";
import type { Card, FeedRequest, Interest, LibraryCard, Profile } from "@/lib/types";

export interface AppConfig {
  mode: "demo" | "bank";
  store: "file" | "redis";
  refillThreshold: number;
  total: number | null;
}

interface AuthState {
  required: boolean;
  unlocked: boolean;
  offline: boolean;
}

interface AppStateValue {
  ready: boolean;
  auth: AuthState;
  profile: Profile;
  cards: Record<string, LibraryCard>;
  queue: string[];
  config: AppConfig | null;
  unlock: (passcode: string) => Promise<string | null>;
  logout: () => Promise<void>;
  lockLocally: () => void;
  setInterests: (interests: Interest[], onboarded?: boolean) => Promise<void>;
  appendCards: (incoming: Card[]) => Promise<void>;
  insertAfter: (id: string, incoming: Card[]) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  toggleSave: (id: string) => Promise<void>;
  markKnown: (id: string) => Promise<void>;
  markSeen: (id: string) => Promise<void>;
  unreadCount: () => number;
  resetFeed: () => Promise<void>;
  eraseAll: () => Promise<void>;
  feedRequest: (batchSize?: number) => FeedRequest;
}

const emptyProfile: Profile = { onboarded: false, interests: [] };

const AppStateContext = createContext<AppStateValue | null>(null);

function toLibrary(card: Card, previous?: LibraryCard): LibraryCard {
  return {
    ...card,
    liked: previous?.liked ?? false,
    saved: previous?.saved ?? false,
    known: previous?.known ?? false,
    seenAt: previous?.seenAt,
    savedAt: previous?.savedAt,
  };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ required: false, unlocked: true, offline: false });
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [cards, setCards] = useState<Record<string, LibraryCard>>({});
  const [queue, setQueue] = useState<string[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const cardsRef = useRef(cards);
  const queueRef = useRef(queue);
  const profileRef = useRef(profile);
  useEffect(() => {
    cardsRef.current = cards;
    queueRef.current = queue;
    profileRef.current = profile;
  }, [cards, queue, profile]);

  const refreshConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/config");
      if (!response.ok) return;
      setConfig((await response.json()) as AppConfig);
    } catch {
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      let nextAuth: AuthState = { required: false, unlocked: true, offline: false };
      try {
        const response = await fetch("/api/auth/status");
        const body = (await response.json()) as { required: boolean; unlocked: boolean };
        nextAuth = { required: body.required, unlocked: body.unlocked, offline: false };
      } catch {
        nextAuth = { required: false, unlocked: true, offline: true };
      }
      try {
        const stored = await loadLibrary();
        if (cancelled) return;
        const map: Record<string, LibraryCard> = {};
        for (const card of stored.cards) map[card.id] = card;
        setCards(map);
        setQueue(stored.queue.filter((id) => map[id]));
        setProfile(stored.profile ?? emptyProfile);
      } catch {
        if (cancelled) return;
      }
      if (cancelled) return;
      setAuth(nextAuth);
      setReady(true);
      if (nextAuth.unlocked) void refreshConfig();
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [refreshConfig]);

  const persistCards = useCallback(async (nextCards: Record<string, LibraryCard>, incoming: Card[]) => {
    await Promise.all(incoming.map((card) => saveCard(nextCards[card.id]!)));
  }, []);

  const appendCards = useCallback(
    async (incoming: Card[]) => {
      const nextCards = { ...cardsRef.current };
      const nextQueue = [...queueRef.current];
      const seen = new Set(nextQueue);
      for (const card of incoming) {
        nextCards[card.id] = toLibrary(card, nextCards[card.id]);
        if (!seen.has(card.id)) {
          nextQueue.push(card.id);
          seen.add(card.id);
        }
      }
      cardsRef.current = nextCards;
      queueRef.current = nextQueue;
      setCards(nextCards);
      setQueue(nextQueue);
      await persistCards(nextCards, incoming);
      await saveQueue(nextQueue);
    },
    [persistCards],
  );

  const insertAfter = useCallback(
    async (id: string, incoming: Card[]) => {
      const nextCards = { ...cardsRef.current };
      for (const card of incoming) nextCards[card.id] = toLibrary(card, nextCards[card.id]);
      const nextQueue = [...queueRef.current];
      const index = nextQueue.indexOf(id);
      const fresh = incoming.map((card) => card.id).filter((cardId) => !nextQueue.includes(cardId));
      if (index >= 0) nextQueue.splice(index + 1, 0, ...fresh);
      else nextQueue.push(...fresh);
      cardsRef.current = nextCards;
      queueRef.current = nextQueue;
      setCards(nextCards);
      setQueue(nextQueue);
      await persistCards(nextCards, incoming);
      await saveQueue(nextQueue);
    },
    [persistCards],
  );

  const patchCard = useCallback(async (id: string, update: (card: LibraryCard) => LibraryCard) => {
    const current = cardsRef.current[id];
    if (!current) return;
    const nextCard = update(current);
    const nextCards = { ...cardsRef.current, [id]: nextCard };
    cardsRef.current = nextCards;
    setCards(nextCards);
    await saveCard(nextCard);
  }, []);

  const setInterests = useCallback(async (interests: Interest[], onboarded = true) => {
    const next = { onboarded, interests };
    profileRef.current = next;
    setProfile(next);
    await saveProfile(next);
  }, []);

  const value = useMemo<AppStateValue>(() => {
    return {
      ready,
      auth,
      profile,
      cards,
      queue,
      config,
      unlock: async (passcode: string) => {
        const response = await fetch("/api/auth/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) return body.error ?? "Could not unlock.";
        setAuth({ required: true, unlocked: true, offline: false });
        void refreshConfig();
        return null;
      },
      logout: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setAuth((current) => ({ ...current, unlocked: false }));
      },
      lockLocally: () => setAuth((current) => ({ ...current, required: true, unlocked: false })),
      setInterests,
      appendCards,
      insertAfter,
      toggleLike: (id) => patchCard(id, (card) => ({ ...card, liked: !card.liked })),
      toggleSave: (id) =>
        patchCard(id, (card) => ({
          ...card,
          saved: !card.saved,
          savedAt: card.saved ? undefined : Date.now(),
        })),
      markKnown: (id) => patchCard(id, (card) => ({ ...card, known: true })),
      markSeen: (id) => {
        const current = cardsRef.current[id];
        if (!current || current.seenAt) return Promise.resolve();
        return patchCard(id, (card) => ({ ...card, seenAt: Date.now() }));
      },
      unreadCount: () =>
        queueRef.current.filter((id) => {
          const card = cardsRef.current[id];
          return Boolean(card && !card.seenAt);
        }).length,
      resetFeed: async () => {
        const kept = Object.values(cardsRef.current).filter((card) => card.saved);
        const nextCards: Record<string, LibraryCard> = {};
        const nextQueue: string[] = [];
        for (const card of kept) {
          nextCards[card.id] = card;
          nextQueue.push(card.id);
        }
        cardsRef.current = nextCards;
        queueRef.current = nextQueue;
        setCards(nextCards);
        setQueue(nextQueue);
        await replaceCards(kept);
        await saveQueue(nextQueue);
      },
      eraseAll: async () => {
        await eraseLibrary();
        cardsRef.current = {};
        queueRef.current = [];
        profileRef.current = emptyProfile;
        setCards({});
        setQueue([]);
        setProfile(emptyProfile);
      },
      feedRequest: (batchSize = 6) => {
        const interests = profileRef.current.interests;
        const all = Object.values(cardsRef.current);
        const seenCounts: Record<string, number> = {};
        const known = new Map<string, number>();
        const concepts: string[] = [];
        for (const card of all) {
          if (card.seenAt) seenCounts[card.topic] = (seenCounts[card.topic] ?? 0) + 1;
          if (card.known) {
            known.set(card.topic, (known.get(card.topic) ?? 0) + 1);
            concepts.push(...(card.concepts ?? []));
          }
        }
        const exclude = new Set<string>([
          ...queueRef.current,
          ...all.filter((card) => card.seenAt).map((card) => card.id),
        ]);
        return {
          interests,
          seenIds: [...exclude].slice(-400),
          recentTitles: queueRef.current
            .map((id) => cardsRef.current[id]?.title)
            .filter((title): title is string => Boolean(title))
            .slice(-24),
          knownTopics: [...known.entries()].map(([topic, strength]) => ({ topic, strength })),
          knownConcepts: [...new Set(concepts)].slice(-60),
          seenCounts,
          batchSize,
        };
      },
    };
  }, [
    ready,
    auth,
    profile,
    cards,
    queue,
    config,
    refreshConfig,
    setInterests,
    appendCards,
    insertAfter,
    patchCard,
  ]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useApp must be used inside AppStateProvider");
  return value;
}

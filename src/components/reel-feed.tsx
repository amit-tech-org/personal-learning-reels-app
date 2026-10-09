"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ReelCard } from "@/components/reel-card";
import { useApp } from "@/components/app-state";
import { nextVideoIndex } from "@/lib/youtube-playback";
import type { Card, LibraryCard } from "@/lib/types";

export function ReelFeed({ mode }: { mode: "feed" | "saved" }) {
  const app = useApp();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [follow, setFollow] = useState<Record<string, string[]>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const lastSignalAt = useRef(0);
  const interestKey = app.profile.interests.map((item) => item.topic).join("|");
  const interestNow = useRef(interestKey);
  const [cursorFor, setCursorFor] = useState(interestKey);
  if (cursorFor !== interestKey) {
    setCursorFor(interestKey);
    setCursor(null);
    setExhausted(false);
  }

  useLayoutEffect(() => {
    interestNow.current = interestKey;
  }, [interestKey]);

  const savedIds = useMemo(
    () =>
      Object.values(app.cards)
        .filter((card) => card.saved)
        .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
        .map((card) => card.id),
    [app.cards],
  );

  const displayed = useMemo(() => {
    const base = mode === "feed" ? app.queue : savedIds;
    if (mode === "feed") return base;
    const ids: string[] = [];
    for (const id of base) {
      ids.push(id);
      for (const extra of follow[id] ?? []) {
        if (!ids.includes(extra)) ids.push(extra);
      }
    }
    return ids;
  }, [mode, app.queue, savedIds, follow]);

  const warmIndex = useMemo(() => {
    const types = displayed.map((id) => app.cards[id]?.type ?? "");
    return nextVideoIndex(types, activeIndex);
  }, [displayed, app.cards, activeIndex]);

  const signalNeedMore = useCallback(
    async (reason: "queue-low" | "deeper", topic?: string, depth?: Card["depth"]) => {
      const now = Date.now();
      if (reason === "queue-low" && now - lastSignalAt.current < 60_000) return;
      if (reason === "queue-low") lastSignalAt.current = now;
      const request = app.feedRequest(6);
      try {
        await fetch("/api/content/need-more", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unread: app.unreadCount(),
            reason,
            topic,
            depth,
            interests: request.interests,
            knownTopics: request.knownTopics,
            seenCounts: request.seenCounts,
          }),
        });
      } catch {
        if (reason === "queue-low") lastSignalAt.current = 0;
      }
    },
    [app],
  );

  const loadMore = useCallback(async () => {
    if (mode !== "feed" || loadingRef.current || exhausted) return;
    if (app.profile.interests.length === 0) return;
    const started = interestKey;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const request = app.feedRequest(6);
      const params = new URLSearchParams();
      params.set("limit", String(request.batchSize));
      if (cursor) params.set("cursor", cursor);
      for (const interest of request.interests) params.append("topics", interest.topic);
      if (request.seenIds.length > 0) params.set("exclude", request.seenIds.slice(-200).join(","));
      const response = await fetch(`/api/content/feed?${params.toString()}`);
      if (interestNow.current !== started) return;
      if (response.status === 401) {
        app.lockLocally();
        return;
      }
      const body = (await response.json()) as {
        cards?: Card[];
        exhausted?: boolean;
        nextCursor?: string | null;
        error?: string;
      };
      if (interestNow.current !== started) return;
      if (!response.ok) {
        setError(body.error ?? "Could not load the next reels.");
        return;
      }
      if (body.nextCursor) setCursor(body.nextCursor);
      if (body.cards && body.cards.length > 0) await app.appendCards(body.cards);
      if (interestNow.current !== started) return;
      const unread = app.unreadCount();
      const threshold = app.config?.refillThreshold ?? 20;
      if (unread < threshold) void signalNeedMore("queue-low");
      if (body.exhausted || (body.cards ?? []).length === 0) setExhausted(true);
    } catch {
      if (interestNow.current !== started) return;
      if (app.queue.length > 0) {
        setNote("Offline. Showing reels already on this device.");
        setExhausted(true);
      } else {
        setError("No connection, and there are no reels stored on this device yet.");
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [app, mode, signalNeedMore, cursor, exhausted, interestKey]);

  useEffect(() => {
    if (mode !== "feed" || exhausted) return;
    if (displayed.length > 0 && activeIndex < displayed.length - 3) return;
    const timer = window.setTimeout(() => void loadMore(), 0);
    return () => window.clearTimeout(timer);
  }, [mode, displayed.length, activeIndex, loadMore, exhausted]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.6)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.reelIndex);
        if (Number.isFinite(index)) setActiveIndex(index);
      },
      { root, threshold: [0.6, 0.8] },
    );
    root.querySelectorAll<HTMLElement>("[data-reel-index]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [displayed]);

  useEffect(() => {
    const id = displayed[activeIndex];
    if (id) void app.markSeen(id);
  }, [activeIndex, displayed, app]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "j" && event.key !== "k") {
        return;
      }
      event.preventDefault();
      const direction = event.key === "ArrowDown" || event.key === "j" ? 1 : -1;
      const next = Math.min(displayed.length - 1, Math.max(0, activeIndex + direction));
      scrollerRef.current
        ?.querySelector<HTMLElement>(`[data-reel-index="${next}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, displayed.length]);

  async function share(card: LibraryCard) {
    const text = [card.title, card.takeaway, `${card.topic} · Primer`].filter(Boolean).join("\n\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: card.title, text });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setNote("Copied the reel.");
    } catch {
      setNote("Could not copy from this browser.");
    }
    window.setTimeout(() => setNote(null), 1800);
  }

  async function deeper(card: LibraryCard, index: number) {
    setBusyId(card.id);
    setError(null);
    try {
      const request = app.feedRequest(3);
      const params = new URLSearchParams();
      params.set("limit", "3");
      params.set("topic", card.topic);
      params.set("deeper", "1");
      const exclude = [...request.seenIds, card.id].slice(-200);
      if (exclude.length > 0) params.set("exclude", exclude.join(","));
      const response = await fetch(`/api/content/feed?${params.toString()}`);
      if (response.status === 401) {
        app.lockLocally();
        return;
      }
      const body = (await response.json()) as { cards?: Card[]; error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not go deeper.");
        return;
      }
      const cards = body.cards ?? [];
      if (cards.length === 0) {
        await signalNeedMore("deeper", card.topic, card.depth);
        setNote(`Asked for more on ${card.topic}. The next refill can go deeper.`);
        window.setTimeout(() => setNote(null), 2200);
        return;
      }
      await app.insertAfter(card.id, cards);
      if (mode === "saved") {
        setFollow((current) => ({ ...current, [card.id]: cards.map((item) => item.id) }));
      }
      requestAnimationFrame(() => {
        scrollerRef.current
          ?.querySelector<HTMLElement>(`[data-reel-index="${index + 1}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      setError("Could not go deeper while offline.");
    } finally {
      setBusyId(null);
    }
  }

  if (mode === "saved" && displayed.length === 0) {
    return (
      <main className="grid h-full place-items-center px-8 text-center" data-testid="saved-view">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary">Saved</p>
          <h1 className="mt-3 font-serif text-4xl text-foreground">Nothing saved yet.</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Tap the bookmark on a reel. Saved lessons stay on this device and open without a connection.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="relative h-full" data-testid={mode === "saved" ? "saved-view" : "feed"}>
      <div
        ref={scrollerRef}
        className="reels h-full overflow-y-auto overscroll-y-contain"
      >
        {displayed.map((id, index) => {
          const card = app.cards[id];
          if (!card) return null;
          return (
            <div key={id} data-reel-index={index} data-testid="reel" data-type={card.type}>
              <ReelCard
                card={card}
                active={index === activeIndex}
                warm={index === warmIndex}
                busy={busyId === card.id}
                onLike={() => void app.toggleLike(card.id)}
                onSave={() => void app.toggleSave(card.id)}
                onKnown={() => {
                  void app.markKnown(card.id);
                  setNote("We'll show less like this.");
                  window.setTimeout(() => setNote(null), 1600);
                }}
                onDeeper={() => void deeper(card, index)}
                onShare={() => void share(card)}
              />
            </div>
          );
        })}
        {mode === "feed" && loading ? (
          <section className="reel grid h-dvh snap-start place-items-center px-8 text-center" data-reel-index={displayed.length}>
            <p className="text-sm text-muted">Pulling the next reels…</p>
          </section>
        ) : null}
        {mode === "feed" && exhausted && !loading ? (
          <section className="reel grid h-dvh snap-start place-items-center px-8 text-center" data-reel-index={displayed.length + 1}>
            <div>
              <h2 className="font-serif text-3xl text-foreground">That is the end of this stretch.</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Nothing new in the bank matches these interests. When fewer than about twenty reels are unread, Primer asks Grok Bot for a refill.
              </p>
            </div>
          </section>
        ) : null}
      </div>
      {error ? (
        <div className="absolute inset-x-4 bottom-24 z-30 rounded-2xl border border-like/40 bg-surface px-4 py-3 text-sm text-foreground shadow-lg">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 text-primary"
            onClick={() => {
              setError(null);
              if (exhausted) setExhausted(false);
              else void loadMore();
            }}
          >
            Try again
          </button>
        </div>
      ) : null}
      {note ? (
        <p className="absolute inset-x-8 bottom-24 z-30 rounded-full bg-foreground px-4 py-2 text-center text-sm text-white shadow-lg" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}

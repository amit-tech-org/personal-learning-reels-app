"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReelCard } from "@/components/reel-card";
import { useApp } from "@/components/app-state";
import type { Card, LibraryCard } from "@/lib/types";

export function ReelFeed({ mode }: { mode: "feed" | "saved" }) {
  const app = useApp();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const exhaustedRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [source, setSource] = useState<"demo" | "live" | null>(app.config?.mode ?? null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [follow, setFollow] = useState<Record<string, string[]>>({});

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

  const loadMore = useCallback(async () => {
    if (mode !== "feed" || loadingRef.current || exhaustedRef.current) return;
    if (app.profile.interests.length === 0) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(app.feedRequest(6)),
      });
      if (response.status === 401) {
        app.lockLocally();
        return;
      }
      const body = (await response.json()) as {
        cards?: Card[];
        exhausted?: boolean;
        source?: "demo" | "live";
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not load the next reels.");
        return;
      }
      if (body.source) setSource(body.source);
      if (body.cards && body.cards.length > 0) await app.appendCards(body.cards);
      if (body.exhausted || (body.cards ?? []).length === 0) {
        exhaustedRef.current = true;
        setExhausted(true);
      }
    } catch {
      if (app.queue.length > 0) {
        setNote("Offline. Showing reels already on this device.");
        exhaustedRef.current = true;
        setExhausted(true);
      } else {
        setError("No connection, and there are no reels stored on this device yet.");
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [app, mode]);

  useEffect(() => {
    if (mode !== "feed") return;
    if (displayed.length > 0 && activeIndex < displayed.length - 3) return;
    const timer = window.setTimeout(() => void loadMore(), 0);
    return () => window.clearTimeout(timer);
  }, [mode, displayed.length, activeIndex, loadMore]);

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
    const text = `${card.title}\n\n${card.takeaway}\n\n${card.topic} · Primer`;
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
      const response = await fetch("/api/feed/deeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...app.feedRequest(3), card }),
      });
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
        setNote("No further cut on this one.");
        window.setTimeout(() => setNote(null), 1800);
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
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber">Saved</p>
          <h1 className="mt-3 font-serif text-4xl text-paper">Nothing saved yet.</h1>
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
              <h2 className="font-serif text-3xl text-paper">That is the end of this stretch.</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                {source === "live"
                  ? "Nothing new matched your interests. Change them in settings, or clear read reels to start again."
                  : "The sample library is finite. Add an LLM key when you want the feed to keep writing."}
              </p>
            </div>
          </section>
        ) : null}
      </div>
      {error ? (
        <div className="absolute inset-x-4 bottom-24 z-30 rounded-2xl border border-rose/40 bg-ink px-4 py-3 text-sm text-paper">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 text-amber"
            onClick={() => {
              exhaustedRef.current = false;
              setExhausted(false);
              setError(null);
              void loadMore();
            }}
          >
            Try again
          </button>
        </div>
      ) : null}
      {note ? (
        <p className="absolute inset-x-8 bottom-24 z-30 rounded-full bg-paper px-4 py-2 text-center text-sm text-ink" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}

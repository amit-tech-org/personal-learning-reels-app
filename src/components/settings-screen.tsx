"use client";

import { useState } from "react";
import { InterestEditor } from "@/components/interest-editor";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-state";
import type { Interest } from "@/lib/types";

export function SettingsScreen() {
  const app = useApp();
  const [interests, setInterests] = useState<Interest[]>(app.profile.interests);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"feed" | "all" | null>(null);

  return (
    <main className="h-full overflow-y-auto px-5 pt-8 pb-28" data-testid="settings">
      <p className="text-[11px] uppercase tracking-[0.2em] text-amber">Settings</p>
      <h1 className="mt-2 font-serif text-4xl text-paper">Your interests</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        {app.config?.mode === "bank"
          ? `The content bank has ${app.config.total ?? 0} reels. Grok Bot refills it when fewer than ${app.config.refillThreshold} are still unread.`
          : `Demo mode reads the built-in seed${app.config?.total != null ? ` (${app.config.total} reels)` : ""}. No bot token is required.`}
      </p>
      <div className="mt-6">
        <InterestEditor interests={interests} onChange={setInterests} />
      </div>
      <Button
        className="mt-6 w-full"
        disabled={interests.length === 0}
        onClick={async () => {
          await app.setInterests(interests, true);
          setSavedNote("Interests saved.");
          window.setTimeout(() => setSavedNote(null), 1600);
        }}
      >
        Save interests
      </Button>
      {savedNote ? <p className="mt-3 text-sm text-mint">{savedNote}</p> : null}

      <section className="mt-10 space-y-3 border-t border-line pt-6">
        <h2 className="font-serif text-2xl text-paper">On this device</h2>
        <p className="text-sm leading-6 text-muted">
          Likes, saves, and what you have already read live in this browser. Clearing the read list asks the feed for fresh reels. Erasing removes interests and saves too.
        </p>
        {confirm === "feed" ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await app.resetFeed();
                setConfirm(null);
              }}
            >
              Clear read reels
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setConfirm("feed")}>
            Clear read reels
          </Button>
        )}
        {confirm === "all" ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await app.eraseAll();
                setConfirm(null);
              }}
            >
              Erase everything
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirm("all")}>
            Erase everything
          </Button>
        )}
        {app.auth.required ? (
          <Button variant="outline" onClick={() => void app.logout()}>
            Lock
          </Button>
        ) : null}
      </section>
    </main>
  );
}

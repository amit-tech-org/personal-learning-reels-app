"use client";

import { useState } from "react";
import { InterestEditor } from "@/components/interest-editor";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-state";
import type { Interest } from "@/lib/types";

export function Onboarding() {
  const { setInterests } = useApp();
  const [interests, setLocal] = useState<Interest[]>([]);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 py-10 pb-16" data-testid="onboarding">
      <p className="text-[11px] uppercase tracking-[0.22em] text-amber">Primer</p>
      <h1 className="mt-3 font-serif text-[2.6rem] leading-[1.05] text-paper">
        What should the feed teach you?
      </h1>
      <p className="mt-4 text-base leading-7 text-muted">
        Short reels, one idea at a time. Interests, likes, and saves stay on this device.
      </p>
      <div className="mt-8">
        <InterestEditor interests={interests} onChange={setLocal} />
      </div>
      <Button
        className="mt-8 w-full"
        size="lg"
        disabled={interests.length === 0 || pending}
        onClick={async () => {
          setPending(true);
          await setInterests(interests, true);
          setPending(false);
        }}
      >
        {pending ? "Saving…" : "Start the feed"}
      </Button>
    </main>
  );
}

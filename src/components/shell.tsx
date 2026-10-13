"use client";

import { BottomNav } from "@/components/bottom-nav";
import { useApp } from "@/components/app-state";

export function Shell({ children }: { children: React.ReactNode }) {
  const { profile, cards, config } = useApp();
  const seen = Object.values(cards).filter((card) => card.seenAt).length;
  const saved = Object.values(cards).filter((card) => card.saved).length;

  return (
    <div className="stage flex h-dvh overflow-hidden">
      <aside className="hidden w-80 shrink-0 flex-col justify-between border-r border-line px-8 py-10 lg:flex">
        <div>
          <p className="font-serif text-4xl text-foreground">Primer</p>
          <p className="mt-3 text-sm leading-6 text-muted">
            A private reel of short lessons. Nothing here is an account.
          </p>
          <ul className="mt-8 space-y-3">
            {profile.interests.map((interest) => (
              <li key={interest.topic} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground">{interest.topic}</span>
                <span className="text-faint">
                  {interest.depth} · {interest.weight}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm text-faint">
          <p>
            {seen} read · {saved} saved
          </p>
          <p className="mt-1">{config?.mode === "bank" ? "Content bank" : "Sample library"}</p>
          <p className="mt-4 text-xs leading-5">Arrow keys move between reels.</p>
        </div>
      </aside>
      <div className="relative mx-auto h-dvh w-full max-w-[480px] lg:border-x lg:border-line">
        {children}
        <BottomNav />
      </div>
    </div>
  );
}

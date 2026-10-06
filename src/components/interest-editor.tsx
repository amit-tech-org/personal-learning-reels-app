"use client";

import { useEffect, useRef, useState } from "react";
import { PRESET_TOPICS } from "@/lib/topics";
import type { Depth, Interest } from "@/lib/types";
import { topicsMatch } from "@/lib/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEPTHS: { id: Depth; label: string }[] = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

export function InterestEditor({
  interests,
  onChange,
}: {
  interests: Interest[];
  onChange: (next: Interest[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [active, setActive] = useState(interests[0]?.topic ?? PRESET_TOPICS[0]);
  const interestsRef = useRef(interests);
  useEffect(() => {
    interestsRef.current = interests;
  }, [interests]);
  const selected = interests.find((item) => item.topic === active) ?? interests[0];

  function commit(next: Interest[]) {
    interestsRef.current = next;
    onChange(next);
  }

  function togglePreset(topic: string) {
    const current = interestsRef.current;
    const existing = current.find((item) => topicsMatch(item.topic, topic));
    if (existing) {
      setActive(existing.topic);
      return;
    }
    commit([...current, { topic, weight: 3, depth: "beginner", custom: false }]);
    setActive(topic);
  }

  function addCustom() {
    const topic = draft.trim().replace(/\s+/g, " ");
    if (topic.length < 2) return;
    const current = interestsRef.current;
    if (current.some((item) => topicsMatch(item.topic, topic))) {
      setDraft("");
      setActive(topic);
      return;
    }
    const preset = PRESET_TOPICS.find((item) => topicsMatch(item, topic));
    commit([
      ...current,
      { topic: preset ?? topic, weight: 3, depth: "beginner", custom: !preset },
    ]);
    setActive(preset ?? topic);
    setDraft("");
  }

  function patch(topic: string, update: Partial<Interest>) {
    commit(interestsRef.current.map((item) => (item.topic === topic ? { ...item, ...update } : item)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {PRESET_TOPICS.map((topic) => {
          const on = interests.some((item) => topicsMatch(item.topic, topic));
          return (
            <button
              key={topic}
              type="button"
              aria-pressed={on}
              onClick={() => togglePreset(topic)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                on && active === topic
                  ? "border-amber bg-amber text-ink"
                  : on
                    ? "border-amber/70 bg-amber/15 text-amber-2"
                    : "border-line bg-ink-2 text-paper hover:border-muted"
              }`}
            >
              {topic}
            </button>
          );
        })}
        {interests
          .filter((item) => item.custom)
          .map((item) => (
            <button
              key={item.topic}
              type="button"
              onClick={() => setActive(item.topic)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                active === item.topic ? "border-amber bg-amber text-ink" : "border-amber/40 text-amber-2"
              }`}
            >
              {item.topic}
            </button>
          ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addCustom();
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add your own topic"
          aria-label="Custom topic"
          maxLength={60}
        />
        <Button type="submit" variant="outline" className="shrink-0">
          Add
        </Button>
      </form>

      {selected ? (
        <div className="rounded-3xl border border-line bg-ink-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Tuning</p>
              <h3 className="font-serif text-2xl text-paper">{selected.topic}</h3>
            </div>
            <button
              type="button"
              className="text-sm text-faint underline-offset-4 hover:text-paper hover:underline"
              onClick={() => {
                const remaining = interestsRef.current.filter((item) => item.topic !== selected.topic);
                commit(remaining);
                setActive(remaining[0]?.topic ?? "");
              }}
            >
              Remove
            </button>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-faint">Depth</p>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Depth for ${selected.topic}`}>
            {DEPTHS.map((depth) => (
              <button
                key={depth.id}
                type="button"
                role="radio"
                aria-checked={selected.depth === depth.id}
                onClick={() => patch(selected.topic, { depth: depth.id })}
                className={`rounded-2xl border px-2 py-2 text-sm ${
                  selected.depth === depth.id
                    ? "border-amber bg-amber/15 text-amber-2"
                    : "border-line text-muted"
                }`}
              >
                {depth.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-faint">How often</p>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label={`Weight for ${selected.topic}`}>
            {[1, 2, 3, 4, 5].map((weight) => (
              <button
                key={weight}
                type="button"
                role="radio"
                aria-checked={selected.weight === weight}
                aria-label={`Weight ${weight}`}
                onClick={() => patch(selected.topic, { weight })}
                className={`h-9 w-9 rounded-full border text-sm ${
                  weight <= selected.weight
                    ? "border-amber bg-amber text-ink"
                    : "border-line text-faint"
                }`}
              >
                {weight}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">
            Higher numbers show up more often. Depth moves forward on its own as you read.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">Pick at least one topic to start the feed.</p>
      )}
    </div>
  );
}

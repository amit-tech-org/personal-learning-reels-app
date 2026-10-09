"use client";

import { Bookmark, Check, Heart, Layers, Share } from "lucide-react";
import { useState } from "react";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { formatDuration } from "@/lib/utils";
import type { LibraryCard } from "@/lib/types";

export function ReelCard({
  card,
  active,
  busy,
  onLike,
  onSave,
  onDeeper,
  onKnown,
  onShare,
}: {
  card: LibraryCard;
  active: boolean;
  busy: boolean;
  onLike: () => void;
  onSave: () => void;
  onDeeper: () => void;
  onKnown: () => void;
  onShare: () => void;
}) {
  return (
    <article
      className="reel relative flex h-dvh snap-start snap-always flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pr-20 pb-28"
      aria-label={`${card.type} reel: ${card.title}`}
    >
      <header className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber">{card.topic}</p>
        <p className="rounded-full border border-line px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-faint">
          {card.depth}
        </p>
      </header>
      {card.threadLabel ? (
        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-mint">{card.threadLabel}</p>
      ) : null}
      <h2 className="mt-3 font-serif text-[2rem] leading-[1.12] tracking-tight text-paper">{card.title}</h2>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
        {card.type === "text" ? <TextBody card={card} /> : null}
        {card.type === "diagram" ? <DiagramBody card={card} /> : null}
        {card.type === "video" ? <VideoBody card={card} active={active} /> : null}
      </div>

      {card.takeaway ? (
        <div className="mt-4 rounded-3xl border border-line bg-ink-2/90 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber">Remember</p>
          <p className="mt-1 text-[15px] leading-snug text-paper">{card.takeaway}</p>
        </div>
      ) : null}

      <div className="absolute right-3 top-[38%] z-10 flex -translate-y-1/2 flex-col items-center gap-4">
        <RailButton label="Like" pressed={card.liked} onClick={onLike}>
          <Heart className={card.liked ? "fill-rose text-rose" : ""} />
        </RailButton>
        <RailButton label="Save" pressed={card.saved} onClick={onSave}>
          <Bookmark className={card.saved ? "fill-amber text-amber" : ""} />
        </RailButton>
        <RailButton label="Deeper" pressed={false} onClick={onDeeper} disabled={busy}>
          <Layers />
        </RailButton>
        <RailButton label="Known" pressed={card.known} onClick={onKnown}>
          <Check className={card.known ? "text-mint" : ""} />
        </RailButton>
        <RailButton label="Share" pressed={false} onClick={onShare}>
          <Share />
        </RailButton>
      </div>
    </article>
  );
}

function TextBody({ card }: { card: LibraryCard }) {
  return (
    <div className="space-y-4">
      {card.bullets && card.bullets.length > 0 ? (
        <ol className="space-y-3">
          {card.bullets.map((bullet, index) => (
            <li key={bullet} className="flex gap-3 text-[15px] leading-6 text-paper/95">
              <span className="mt-0.5 font-serif text-lg text-amber">{index + 1}</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {card.body ? <p className="text-[15px] leading-7 text-paper/95">{card.body}</p> : null}
    </div>
  );
}

function DiagramBody({ card }: { card: LibraryCard }) {
  return (
    <div className="space-y-3">
      {card.mermaid ? <MermaidDiagram chart={card.mermaid} id={card.id} /> : null}
      {card.body ? <p className="text-sm leading-6 text-muted">{card.body}</p> : null}
    </div>
  );
}

function VideoBody({ card, active }: { card: LibraryCard; active: boolean }) {
  const [playing, setPlaying] = useState(false);
  const showPlayer = playing && active && card.youtubeId;
  const poster = card.youtubeId ? `https://i.ytimg.com/vi/${card.youtubeId}/hqdefault.jpg` : undefined;

  return (
    <div className="space-y-3">
      {showPlayer ? (
        <iframe
          className="aspect-video w-full rounded-3xl bg-black"
          src={`https://www.youtube-nocookie.com/embed/${card.youtubeId}?rel=0&modestbranding=1`}
          title={card.title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          className="relative block aspect-video w-full overflow-hidden rounded-3xl bg-ink-3 text-left"
          onClick={() => setPlaying(true)}
        >
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover opacity-80" />
          ) : null}
          <span className="absolute inset-0 grid place-items-center">
            <span className="rounded-full bg-amber px-4 py-2 text-sm font-medium text-ink">Play</span>
          </span>
        </button>
      )}
      <p className="text-sm text-muted">
        {card.channelTitle ? `${card.channelTitle}` : "Video"}
        {card.durationSeconds ? ` · ${formatDuration(card.durationSeconds)}` : ""}
        {" · under 3 minutes"}
      </p>
      {card.body ? <p className="text-sm leading-6 text-muted">{card.body}</p> : null}
    </div>
  );
}

function RailButton({
  label,
  pressed,
  onClick,
  disabled,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-paper disabled:opacity-40"
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-black/45 ring-1 ring-white/10 backdrop-blur [&_svg]:h-5 [&_svg]:w-5">
        {children}
      </span>
      <span className="text-[10px] uppercase tracking-[0.12em] text-paper/80">{label}</span>
    </button>
  );
}

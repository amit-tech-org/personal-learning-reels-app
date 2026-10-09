"use client";

import { Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  actionsAfterSoundRejected,
  actionsForCommand,
  autoplayBlocked,
  playbackDecision,
  PLAYER_HOST,
  PLAYER_STATE,
  playerVarsFor,
  prefersSound,
  setPrefersSound,
  shouldFallbackToMuted,
  type PlayerAction,
} from "@/lib/youtube-playback";

type YtPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
  getIframe: () => HTMLIFrameElement;
};

type YtStateEvent = { data: number; target: YtPlayer };

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          host?: string;
          videoId?: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YtPlayer }) => void;
            onStateChange?: (event: YtStateEvent) => void;
            onError?: (event: YtStateEvent) => void;
          };
        },
      ) => YtPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        if (window.YT?.Player) resolve();
        else reject(new Error("YouTube iframe API failed"));
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = () => reject(new Error("YouTube iframe API failed"));
        document.head.appendChild(script);
      }
    });
  }
  return apiPromise;
}

function runActions(player: YtPlayer, actions: readonly PlayerAction[]) {
  for (const action of actions) {
    if (action === "mute") player.mute();
    else if (action === "unmute") player.unMute();
    else if (action === "play") player.playVideo();
    else player.pauseVideo();
  }
}

function readState(player: YtPlayer): number | null {
  try {
    const state = player.getPlayerState();
    return typeof state === "number" ? state : null;
  } catch {
    return null;
  }
}

function styleIframe(player: YtPlayer, title: string) {
  try {
    const iframe = player.getIframe();
    iframe.title = title;
    iframe.style.border = "0";
    iframe.style.overflow = "hidden";
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("playsinline", "1");
    iframe.setAttribute("webkit-playsinline", "1");
    iframe.removeAttribute("allowfullscreen");
  } catch {
    /* iframe not inserted yet */
  }
}

export function YoutubeReel({
  videoId,
  title,
  active,
}: {
  videoId: string;
  title: string;
  active: boolean;
}) {
  const coverRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const titleRef = useRef(title);
  const failedRef = useRef(false);
  const [playerSlot, setPlayerSlot] = useState<{ id: string; api: YtPlayer } | null>(null);
  const player = playerSlot?.id === videoId ? playerSlot.api : null;
  const [muted, setMuted] = useState(() => !prefersSound());
  const [paused, setPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [trackedActive, setTrackedActive] = useState(active);

  if (trackedActive !== active) {
    setTrackedActive(active);
    setBlocked(false);
    if (!active) setUserPaused(false);
    else {
      setMuted(!prefersSound());
      setFailed(false);
    }
  }

  useLayoutEffect(() => {
    titleRef.current = title;
    failedRef.current = failed;
  }, [title, failed]);

  useEffect(() => {
    const cover = coverRef.current;
    if (!cover) return;
    const token = generation.current + 1;
    generation.current = token;
    const mount = document.createElement("div");
    cover.replaceChildren(mount);
    let created: YtPlayer | null = null;
    let cancelled = false;

    void loadYouTubeIframeApi()
      .then(() => {
        if (cancelled || generation.current !== token || !window.YT?.Player) return;
        created = new window.YT.Player(mount, {
          host: PLAYER_HOST,
          videoId,
          width: "100%",
          height: "100%",
          playerVars: playerVarsFor(window.location.origin),
          events: {
            onReady: (event) => {
              if (cancelled || generation.current !== token) {
                try {
                  event.target.destroy();
                } catch {
                  /* already gone */
                }
                return;
              }
              try {
                event.target.mute();
              } catch {
                /* play path mutes again */
              }
              styleIframe(event.target, titleRef.current);
              setPlayerSlot({ id: videoId, api: event.target });
            },
            onStateChange: (event) => {
              if (cancelled || generation.current !== token) return;
              if (event.data === PLAYER_STATE.playing || event.data === PLAYER_STATE.buffering) {
                setPaused(false);
                setBlocked(false);
                setFailed(false);
              } else if (event.data === PLAYER_STATE.paused || event.data === PLAYER_STATE.ended) {
                setPaused(true);
                if (event.data === PLAYER_STATE.ended) setProgress(1);
              }
            },
            onError: () => {
              if (!cancelled && generation.current === token) {
                setFailed(true);
                setBlocked(false);
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled && generation.current === token) setFailed(true);
      });

    return () => {
      cancelled = true;
      generation.current += 1;
      try {
        created?.destroy();
      } catch {
        /* already destroyed */
      }
      cover.replaceChildren();
    };
  }, [videoId]);

  useEffect(() => {
    if (!player) return;
    let cancelled = false;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(id);
    };

    const decision = playbackDecision(active, prefersSound(), userPaused);
    if (decision === "pause") {
      try {
        player.pauseVideo();
      } catch {
        /* destroyed */
      }
    } else if (decision !== "hold") {
      try {
        runActions(player, actionsForCommand(decision));
      } catch {
        /* destroyed */
      }
      later(1500, () => {
        const state = readState(player);
        if (decision === "play-sound" && shouldFallbackToMuted(state)) {
          try {
            runActions(player, actionsAfterSoundRejected(state));
          } catch {
            /* destroyed */
          }
          setMuted(true);
          later(800, () => {
            if (!failedRef.current) setBlocked(autoplayBlocked(readState(player)));
          });
          return;
        }
        if (!failedRef.current) setBlocked(autoplayBlocked(state));
      });
    }

    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [player, active, userPaused]);

  useEffect(() => {
    if (!player || !active) return;
    const id = window.setInterval(() => {
      try {
        const duration = player.getDuration();
        const current = player.getCurrentTime();
        if (Number.isFinite(duration) && duration > 0 && Number.isFinite(current)) {
          setProgress(Math.min(1, Math.max(0, current / duration)));
        }
      } catch {
        /* player gone */
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [player, active]);

  function togglePlay() {
    if (!player || !active) return;
    const state = readState(player);
    const playing = state === PLAYER_STATE.playing || state === PLAYER_STATE.buffering;
    if (playing) {
      setUserPaused(true);
      setBlocked(false);
      try {
        player.pauseVideo();
      } catch {
        /* destroyed */
      }
      return;
    }
    setUserPaused(false);
    setBlocked(false);
    const command = playbackDecision(true, prefersSound(), false);
    if (command === "play-muted" || command === "play-sound") {
      try {
        runActions(player, actionsForCommand(command));
      } catch {
        /* destroyed */
      }
      setMuted(command === "play-muted");
    }
  }

  function toggleMute() {
    if (!player || !active) return;
    if (muted) {
      setPrefersSound(true);
      setMuted(false);
      setUserPaused(false);
      setBlocked(false);
      try {
        player.unMute();
        const state = readState(player);
        if (state !== PLAYER_STATE.playing && state !== PLAYER_STATE.buffering) player.playVideo();
      } catch {
        /* destroyed */
      }
      window.setTimeout(() => {
        try {
          if (player.isMuted()) setMuted(true);
        } catch {
          /* destroyed */
        }
      }, 400);
      return;
    }
    setPrefersSound(false);
    setMuted(true);
    try {
      player.mute();
    } catch {
      /* destroyed */
    }
  }

  const percent = Math.round(progress * 100);
  const showPaused = paused && !blocked;

  return (
    <div
      className="yt-stage min-h-0 flex-1"
      data-testid="youtube-reel"
      data-active={active ? "true" : "false"}
      data-muted={muted ? "true" : "false"}
    >
      <div ref={coverRef} className="yt-cover" />
      {failed ? <p className="sr-only">This video did not start in the reel. Use Watch on YouTube below the player.</p> : null}
      {!failed && active ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 bg-white/20"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Video progress"
          >
            <div className="h-full bg-amber" style={{ width: `${percent}%` }} />
          </div>
          <button
            type="button"
            className="yt-hit absolute inset-0 z-10"
            aria-label={showPaused || blocked ? "Play video" : "Pause video"}
            onClick={togglePlay}
          />
          <button
            type="button"
            className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-paper ring-1 ring-white/15 backdrop-blur"
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={!muted}
            data-testid="reel-mute"
            onClick={toggleMute}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {muted && active && !blocked ? <span className="text-xs">Tap for sound</span> : null}
          </button>
          {showPaused || blocked ? (
            <span className="pointer-events-none absolute top-1/2 left-1/2 z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center text-paper">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-black/55 ring-1 ring-white/20">
                <Play className="h-6 w-6 fill-paper" />
              </span>
              {blocked ? <span className="mt-2 text-xs">Tap to play</span> : null}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

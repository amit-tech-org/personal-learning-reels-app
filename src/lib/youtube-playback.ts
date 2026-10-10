/** YouTube IFrame player states used to decide play, pause, and mute fallback. */
export const PLAYER_STATE = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const;

export const PLAYER_HOST = "https://www.youtube-nocookie.com";

/**
 * Player parameters for a native reel. `modestbranding` is intentionally absent:
 * hiding the YouTube logo violates the YouTube API Services Terms.
 */
export const EMBED_PLAYER_VARS = {
  enablejsapi: 1,
  controls: 0,
  playsinline: 1,
  rel: 0,
  iv_load_policy: 3,
  fs: 0,
  disablekb: 1,
  autoplay: 0,
} as const;

export type PlaybackCommand = "pause" | "play-muted" | "play-sound";

export type PlaybackDecision = PlaybackCommand | "hold";

export type PlayerAction = "mute" | "unmute" | "play" | "pause";

let preferSound = false;

/** Session choice. Starts muted so the first autoplay is allowed. */
export function prefersSound(): boolean {
  return preferSound;
}

export function setPrefersSound(value: boolean): void {
  preferSound = value;
}

export function resetSoundPreference(): void {
  preferSound = false;
}

export function playerVarsFor(origin: string): Record<string, number | string> {
  return { ...EMBED_PLAYER_VARS, origin };
}

/**
 * Active card plays. Anything else pauses. A manual pause on the active card
 * holds until the viewer taps again or the card leaves the viewport.
 */
export function playbackDecision(active: boolean, sound: boolean, userPaused: boolean): PlaybackDecision {
  if (!active) return "pause";
  if (userPaused) return "hold";
  return sound ? "play-sound" : "play-muted";
}

export function playbackCommand(active: boolean, sound: boolean): PlaybackCommand {
  if (!active) return "pause";
  return sound ? "play-sound" : "play-muted";
}

export function actionsForCommand(command: PlaybackCommand): PlayerAction[] {
  if (command === "pause") return ["pause"];
  if (command === "play-muted") return ["mute", "play"];
  return ["unmute", "play"];
}

/** Playing or buffering means the last play() was accepted. */
export function shouldFallbackToMuted(state: number | null | undefined): boolean {
  return state !== PLAYER_STATE.playing && state !== PLAYER_STATE.buffering;
}

export function actionsAfterSoundRejected(state: number | null | undefined): PlayerAction[] {
  if (!shouldFallbackToMuted(state)) return [];
  return ["mute", "play"];
}

/**
 * True when a play request settled on a stopped state. Unknown states stay
 * false so a slow load does not flash a tap prompt before the first event.
 */
export function autoplayBlocked(state: number | null | undefined): boolean {
  if (state == null || Number.isNaN(state)) return false;
  return state !== PLAYER_STATE.playing && state !== PLAYER_STATE.buffering;
}

/** Mount the active player and the next video card only. */
export function shouldMountPlayer(active: boolean, preload: boolean): boolean {
  return active || preload;
}

/** Index of the next video card after the active reel, or null when there isn't one. */
export function nextVideoIndex(types: readonly string[], activeIndex: number): number | null {
  for (let index = activeIndex + 1; index < types.length; index += 1) {
    if (types[index] === "video") return index;
  }
  return null;
}

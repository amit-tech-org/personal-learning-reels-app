import { afterEach, describe, expect, it } from "vitest";
import {
  actionsAfterSoundRejected,
  actionsForCommand,
  autoplayBlocked,
  EMBED_PLAYER_VARS,
  nextVideoIndex,
  playbackCommand,
  playbackDecision,
  PLAYER_HOST,
  PLAYER_STATE,
  playerVarsFor,
  prefersSound,
  resetSoundPreference,
  setPrefersSound,
  shouldFallbackToMuted,
  shouldMountPlayer,
} from "./youtube-playback";

afterEach(() => {
  resetSoundPreference();
});

describe("playbackDecision", () => {
  it("pauses off-screen reels and plays the active one muted", () => {
    expect(playbackDecision(false, false, false)).toBe("pause");
    expect(playbackDecision(false, true, true)).toBe("pause");
    expect(actionsForCommand("pause")).toEqual(["pause"]);

    expect(playbackDecision(true, false, false)).toBe("play-muted");
    expect(playbackCommand(true, false)).toBe("play-muted");
    expect(actionsForCommand("play-muted")).toEqual(["mute", "play"]);
  });

  it("holds a manual pause and resumes with sound after the viewer unmutes", () => {
    expect(playbackDecision(true, false, true)).toBe("hold");
    setPrefersSound(true);
    expect(prefersSound()).toBe(true);
    expect(playbackDecision(true, prefersSound(), false)).toBe("play-sound");
    expect(actionsForCommand("play-sound")).toEqual(["unmute", "play"]);
  });

  it("falls back to muted when an unmuted play never starts", () => {
    expect(shouldFallbackToMuted(PLAYER_STATE.playing)).toBe(false);
    expect(shouldFallbackToMuted(PLAYER_STATE.buffering)).toBe(false);
    expect(shouldFallbackToMuted(PLAYER_STATE.paused)).toBe(true);
    expect(shouldFallbackToMuted(PLAYER_STATE.unstarted)).toBe(true);
    expect(shouldFallbackToMuted(undefined)).toBe(true);
    expect(actionsAfterSoundRejected(PLAYER_STATE.playing)).toEqual([]);
    expect(actionsAfterSoundRejected(PLAYER_STATE.paused)).toEqual(["mute", "play"]);
  });

  it("treats a stopped player as blocked autoplay and an unknown state as still loading", () => {
    expect(autoplayBlocked(PLAYER_STATE.paused)).toBe(true);
    expect(autoplayBlocked(PLAYER_STATE.cued)).toBe(true);
    expect(autoplayBlocked(PLAYER_STATE.playing)).toBe(false);
    expect(autoplayBlocked(PLAYER_STATE.buffering)).toBe(false);
    expect(autoplayBlocked(null)).toBe(false);
    expect(autoplayBlocked(undefined)).toBe(false);
  });
});

describe("player mounting", () => {
  it("mounts the active video and the next video card only", () => {
    expect(shouldMountPlayer(true, false)).toBe(true);
    expect(shouldMountPlayer(false, true)).toBe(true);
    expect(shouldMountPlayer(false, false)).toBe(false);

    const types = ["text", "text", "diagram", "text", "text", "video", "text", "video"];
    expect(nextVideoIndex(types, 0)).toBe(5);
    expect(nextVideoIndex(types, 5)).toBe(7);
    expect(nextVideoIndex(types, 7)).toBeNull();
    expect(nextVideoIndex(["video"], 0)).toBeNull();
  });
});

describe("embed parameters", () => {
  it("uses the nocookie host and does not suppress YouTube branding", () => {
    expect(PLAYER_HOST).toBe("https://www.youtube-nocookie.com");
    const vars = playerVarsFor("https://primer.example");
    expect(vars).toMatchObject({
      enablejsapi: 1,
      controls: 0,
      playsinline: 1,
      rel: 0,
      iv_load_policy: 3,
      fs: 0,
      disablekb: 1,
      autoplay: 0,
      origin: "https://primer.example",
    });
    expect(vars).not.toHaveProperty("modestbranding");
    expect(EMBED_PLAYER_VARS).not.toHaveProperty("modestbranding");
  });
});

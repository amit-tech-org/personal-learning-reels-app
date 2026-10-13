import { describe, expect, it } from "vitest";
import {
  filterByDuration,
  isWithinReelLimit,
  parseIso8601Duration,
  REEL_MAX_SECONDS,
} from "./youtube-duration";

describe("parseIso8601Duration", () => {
  it("parses hours, minutes, and seconds", () => {
    expect(parseIso8601Duration("PT1H2M3S")).toBe(3723);
    expect(parseIso8601Duration("PT45S")).toBe(45);
    expect(parseIso8601Duration("PT1M")).toBe(60);
    expect(parseIso8601Duration("PT100S")).toBe(100);
    expect(parseIso8601Duration("pt3m")).toBe(180);
  });

  it("rejects empty, date-only, and zero-length values", () => {
    expect(parseIso8601Duration("")).toBeNull();
    expect(parseIso8601Duration("PT")).toBeNull();
    expect(parseIso8601Duration("P1D")).toBeNull();
    expect(parseIso8601Duration("PT1.5S")).toBeNull();
    expect(parseIso8601Duration("not a duration")).toBeNull();
  });
});

describe("reel length filter", () => {
  it("keeps clips at exactly three minutes and drops the next second", () => {
    expect(REEL_MAX_SECONDS).toBe(180);
    expect(isWithinReelLimit("PT3M")).toBe(true);
    expect(isWithinReelLimit("PT3M0S")).toBe(true);
    expect(isWithinReelLimit("PT3M1S")).toBe(false);
    expect(isWithinReelLimit("PT1H")).toBe(false);
    expect(isWithinReelLimit("PT0S")).toBe(false);
  });

  it("filters YouTube contentDetails by duration", () => {
    const videos = [
      { id: "short", duration: "PT1M37S" },
      { id: "edge", duration: "PT2M29S" },
      { id: "cap", duration: "PT3M" },
      { id: "lecture", duration: "PT15M30S" },
      { id: "broken", duration: "P1DT1H" },
    ];
    expect(filterByDuration(videos).map((video) => video.id)).toEqual([
      "short",
      "edge",
      "cap",
    ]);
  });
});

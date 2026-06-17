import { describe, it, expect } from "vitest";
import { genCrashPoint } from "../src/engine/crash";

describe("genCrashPoint", () => {
  it("returns 1.00 (instant bust) when r falls inside the house edge", () => {
    const m = genCrashPoint(0.97, 1.01, () => 0);
    expect(m).toBe(1.0);
  });

  it("returns 1.00 at the upper bound of the house edge", () => {
    const m = genCrashPoint(0.97, 1.01, () => 0.02999);
    expect(m).toBe(1.0);
  });

  it("produces large values as r approaches 1", () => {
    const m = genCrashPoint(0.97, 1.01, () => 0.999);
    expect(m).toBeGreaterThan(500);
  });

  it("skips r >= 1", () => {
    let calls = 0;
    const rng = () => (calls++ === 0 ? 1.5 : 0.5);
    const m = genCrashPoint(0.97, 1.01, rng);
    expect(calls).toBe(2);
    expect(m).toBeCloseTo(1.94, 2);
  });

  it("instant-bust frequency matches 1 - rtp over many samples", () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const N = 20000;
    let busts = 0;
    for (let i = 0; i < N; i++) {
      if (genCrashPoint(0.97, 1.01, rng) === 1.0) busts++;
    }
    const p = busts / N;
    expect(p).toBeGreaterThan(0.02);
    expect(p).toBeLessThan(0.04);
  });

  it("approximates RTP P(crash >= M) = rtp/M over many samples", () => {
    let seed = 1;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const N = 20000;
    const M = 2;
    let above = 0;
    for (let i = 0; i < N; i++) {
      if (genCrashPoint(0.97, 1.01, rng) >= M) above++;
    }
    const p = above / N;
    expect(p).toBeGreaterThan(0.45);
    expect(p).toBeLessThan(0.52);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { RocketRushEngine } from "../src/engine";
import { heatFromMultiplier } from "../src/engine/heat";

function makeEngine(crashAt = 100, climbPerSec = 0) {
  let t = 0;
  const engine = new RocketRushEngine(
    { baseClimbPerSec: climbPerSec },
    { rng: () => 0.5, now: () => t },
  );
  engine.setDebugCrashPoint(crashAt);
  return {
    engine,
    advance: (ms: number) => {
      t += ms;
      return t;
    },
    clock: () => t,
  };
}

describe("RocketRushEngine - lifecycle", () => {
  it("starts idle and refuses tap before launch", () => {
    const { engine } = makeEngine();
    expect(engine.getState().status).toBe("idle");
    engine.tap();
    expect(engine.getState().taps).toBe(0);
  });

  it("launch initialises a running round at multiplier 1", () => {
    const { engine } = makeEngine(10);
    engine.launch({ stake: 5 });
    const s = engine.getState();
    expect(s.status).toBe("running");
    expect(s.stake).toBe(5);
    expect(s.crashPoint).toBe(10);
    expect(s.multiplier).toBe(1);
  });

  it("rejects launch while a round is running", () => {
    const { engine } = makeEngine();
    engine.launch({ stake: 1 });
    expect(() => engine.launch({ stake: 1 })).toThrow();
  });
});

describe("RocketRushEngine - taps and streaks", () => {
  it("individual taps progress streak counters but do not move the multiplier", () => {
    const { engine } = makeEngine(100);
    engine.launch({ stake: 1 });
    engine.tap();
    expect(engine.getState().multiplier).toBeCloseTo(1, 3);
    expect(engine.getState().streakProgress).toBe(1);
    engine.tap();
    expect(engine.getState().multiplier).toBeCloseTo(1, 3);
    expect(engine.getState().streakProgress).toBe(2);
  });

  it("completes a streak every 10 taps and adds the low-zone bonus", () => {
    const { engine } = makeEngine(1000);
    engine.launch({ stake: 1 });
    for (let i = 0; i < 10; i++) engine.tap();
    const s = engine.getState();
    expect(s.streaksCompleted).toBe(1);
    expect(s.streakProgress).toBe(0);
    // Streak completes at M=1.0 (low zone) -> +0.5x.
    expect(s.multiplier).toBeCloseTo(1.5, 3);
  });

  it("stacks multiple low-zone streaks", () => {
    const { engine } = makeEngine(1000);
    engine.launch({ stake: 1 });
    for (let i = 0; i < 25; i++) engine.tap();
    const s = engine.getState();
    expect(s.streaksCompleted).toBe(2);
    expect(s.streakProgress).toBe(5);
    // Streak 1 @ M=1.0 -> +0.5 (1.5). Streak 2 @ M=1.5 -> +0.5 (2.0).
    expect(s.multiplier).toBeCloseTo(2.0, 3);
  });

  it("streak completed in the high zone awards the high-zone bonus", () => {
    // Drive M into the high zone via time-based climb, then complete a streak.
    const { engine, advance } = makeEngine(1000, 1);
    engine.launch({ stake: 1 });
    advance(12_000); // M ~= 1 + 12 = 13 (high zone, < 50)
    engine.tick();
    const mBefore = engine.getState().multiplier;
    expect(mBefore).toBeGreaterThanOrEqual(10);
    expect(mBefore).toBeLessThan(50);
    for (let i = 0; i < 10; i++) engine.tap();
    const s = engine.getState();
    expect(s.streaksCompleted).toBe(1);
    // High-zone streak bonus is +5.0x on top of whatever the time-climb produced.
    expect(s.multiplier - mBefore).toBeGreaterThanOrEqual(5);
  });
});

describe("RocketRushEngine - heat", () => {
  it("heatFromMultiplier maps multiplier ranges to heat levels", () => {
    expect(heatFromMultiplier(1).heat).toBe("low");
    expect(heatFromMultiplier(3).heat).toBe("low");
    expect(heatFromMultiplier(10).heat).toBe("medium");
    expect(heatFromMultiplier(20).heat).toBe("medium");
    expect(heatFromMultiplier(30).heat).toBe("hot");
    expect(heatFromMultiplier(60).heat).toBe("hot");
    expect(heatFromMultiplier(80).heat).toBe("overloading");
    expect(heatFromMultiplier(150).heat).toBe("overloading");
  });

  it("engine heat advances as the multiplier climbs through zones", () => {
    const { engine, advance } = makeEngine(10_000, 1);
    engine.launch({ stake: 1 });
    expect(engine.getState().heat).toBe("low");
    advance(11_000); // M ~= 12
    engine.tick();
    expect(engine.getState().heat).toBe("medium");
    advance(20_000); // M ~= 32
    engine.tick();
    expect(engine.getState().heat).toBe("hot");
    advance(50_000); // M ~= 82
    engine.tick();
    expect(engine.getState().heat).toBe("overloading");
  });
});

describe("RocketRushEngine - crash detection", () => {
  it("crashes when a tap pushes multiplier past crashPoint", () => {
    const { engine } = makeEngine(1.5);
    engine.launch({ stake: 10 });
    for (let i = 0; i < 20; i++) engine.tap();
    const s = engine.getState();
    expect(s.status).toBe("crashed");
    expect(s.finalMultiplier).toBe(1.5);
    expect(s.payout).toBe(0);
  });

  it("cashes out at the current multiplier", () => {
    const { engine } = makeEngine(100);
    engine.launch({ stake: 10 });
    // 5 taps don't complete a streak, so the multiplier stays at 1.0.
    for (let i = 0; i < 5; i++) engine.tap();
    engine.cashOut();
    const s = engine.getState();
    expect(s.status).toBe("cashed_out");
    expect(s.finalMultiplier).toBeCloseTo(1.0, 3);
    expect(s.payout).toBeCloseTo(10, 3);
  });

  it("cashes out at the bumped multiplier after a completed streak", () => {
    const { engine } = makeEngine(100);
    engine.launch({ stake: 10 });
    for (let i = 0; i < 10; i++) engine.tap();
    engine.cashOut();
    const s = engine.getState();
    expect(s.status).toBe("cashed_out");
    expect(s.finalMultiplier).toBeCloseTo(1.5, 3);
    expect(s.payout).toBeCloseTo(15, 3);
  });
});

describe("RocketRushEngine - auto mode", () => {
  it("auto cashes out at target multiplier", () => {
    let t = 0;
    const engine = new RocketRushEngine(
      { baseClimbPerSec: 1 },
      { rng: () => 0.5, now: () => t },
    );
    engine.setDebugCrashPoint(50);
    engine.launch({ stake: 4, mode: "auto", autoTarget: 2 });
    t += 1500;
    engine.tick();
    const s = engine.getState();
    expect(s.status).toBe("cashed_out");
    expect(s.finalMultiplier).toBeGreaterThanOrEqual(2);
    expect(s.payout).toBeCloseTo(s.stake * s.finalMultiplier, 3);
  });

  it("auto mode accepts taps without crashing the round", () => {
    const { engine } = makeEngine(100);
    engine.launch({ stake: 1, mode: "auto", autoTarget: 5 });
    engine.tap();
    const s = engine.getState();
    expect(s.taps).toBe(1);
    // Individual taps don't move the multiplier under the new model.
    expect(s.multiplier).toBeCloseTo(1, 3);
  });
});

describe("RocketRushEngine - debug crashpoint", () => {
  it("setDebugCrashPoint forces the next crash value", () => {
    const { engine } = makeEngine(7.25);
    engine.launch({ stake: 1 });
    expect(engine.getState().crashPoint).toBe(7.25);
  });

  it("clearing returns to RNG-based crash points", () => {
    const { engine } = makeEngine(2);
    engine.setDebugCrashPoint(null);
    engine.launch({ stake: 1 });
    expect(engine.getState().crashPoint).toBeGreaterThan(1);
  });
});

describe("RocketRushEngine - pro mode", () => {
  it("requires maxStake >= entry stake", () => {
    const { engine } = makeEngine(100);
    expect(() => engine.launch({ stake: 5, mode: "pro" })).toThrow();
    expect(() => engine.launch({ stake: 5, mode: "pro", maxStake: 3 })).toThrow();
  });

  it("each tap adds stake up to maxStake, then stops charging", () => {
    const { engine } = makeEngine(1000);
    engine.launch({ stake: 1, mode: "pro", maxStake: 5 });
    for (let i = 0; i < 10; i++) engine.tap({ addStake: 1 });
    const s = engine.getState();
    expect(s.stake).toBe(5);
    expect(s.taps).toBe(10);
    expect(s.overloadTaps).toBe(6);
  });

  it("post-cap taps each add the overload bonus to the multiplier", () => {
    const { engine } = makeEngine(1000);
    engine.launch({ stake: 1, mode: "pro", maxStake: 1 });
    const beforeMult = engine.getState().multiplier;
    engine.tap({ addStake: 1 });
    engine.tap({ addStake: 1 });
    const s = engine.getState();
    expect(s.overloadTaps).toBe(2);
    expect(s.multiplier).toBeCloseTo(beforeMult + 2 * 0.45, 3);
  });

  it("cashout payout uses the stakeBasis, not the grown stake", () => {
    const { engine } = makeEngine(1000);
    const rtp = engine.getConfig().rtp;
    engine.launch({ stake: 1, mode: "pro", maxStake: 50 });
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    let expectedBasis = 1;
    for (let i = 0; i < 49; i++) {
      const mAdd = engine.getState().multiplier;
      engine.tap({ addStake: 1 });
      // Match the engine: round3 per top-up to mirror accumulated FP rounding.
      expectedBasis = r3(expectedBasis + r3((1 * rtp) / mAdd));
    }
    const m = engine.getState().multiplier;
    engine.cashOut();
    const s = engine.getState();
    expect(s.stake).toBe(50);
    expect(s.proTopUps.length).toBe(49);
    expect(s.stakeBasis).toBeCloseTo(expectedBasis, 3);
    expect(s.payout).toBeCloseTo(r3(expectedBasis * m), 3);
    expect(s.payout).toBeLessThan(50 * m);
  });

  it("a top-up contributes ΔS · M_final/M_add · rtp to payout", () => {
    // Drive the multiplier purely via taps (no time-based climb in this fixture).
    // Each completed streak in the low zone (<10x) adds +0.5x.
    // M after 10 completed streaks = 1.0 + 10 * 0.5 = 6.0.
    const { engine } = makeEngine(1000);
    const rtp = engine.getConfig().rtp;
    engine.launch({ stake: 6, mode: "pro", maxStake: 10 });
    for (let i = 0; i < 100; i++) engine.tap({ addStake: 0 });
    const mAdd = engine.getState().multiplier;
    expect(mAdd).toBeCloseTo(6.0, 3);
    // Top-up tap at M=6.0: stake basis += 1 * rtp / 6.0; this single tap does
    // not complete a streak, so the multiplier stays at 6.0.
    engine.tap({ addStake: 1 });
    const sMid = engine.getState();
    expect(sMid.stake).toBe(7);
    expect(sMid.proTopUps).toEqual([{ multiplier: mAdd, stakeAdded: 1 }]);
    expect(sMid.stakeBasis).toBeCloseTo(6 + rtp / mAdd, 3);
    const mFinal = engine.getState().multiplier;
    engine.cashOut();
    const s = engine.getState();
    // Payout = base * M_final + ΔS * (M_final / M_add) * rtp
    const expectedPayout = 6 * mFinal + 1 * (mFinal / mAdd) * rtp;
    expect(s.payout).toBeCloseTo(expectedPayout, 2);
    // Naive grown-stake formula would overpay.
    expect(s.payout).toBeLessThan(7 * mFinal);
  });
});

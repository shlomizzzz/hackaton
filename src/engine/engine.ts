import { genCrashPoint, round3 } from "./crash";
import { heatFromMultiplier, zoneFromMultiplier, zoneStreakBonus } from "./heat";
import type {
  EngineConfig,
  EngineEvent,
  EngineListener,
  HeatLevel,
  RoundConfig,
  RoundState,
} from "./types";

export const DEFAULT_CONFIG: EngineConfig = {
  rtp: 0.97,
  baseClimbPerSec: 0.3,
  tapIncrement: 0,
  streakSize: 10,
  zoneStreakBonuses: [0.5, 5, 10],
  minCrashPoint: 1.01,
  proOverloadTapBonus: 0.45,
};

export interface EngineDeps {
  /** RNG injected for deterministic tests; defaults to Math.random. */
  rng?: () => number;
  /** Clock source in ms; defaults to performance.now or Date.now. */
  now?: () => number;
}

const defaultNow = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export class RocketRushEngine {
  private readonly config: EngineConfig;
  private readonly rng: () => number;
  private readonly now: () => number;
  private readonly listeners = new Set<EngineListener>();
  private debugCrashPoint: number | null = null;
  private state: RoundState;

  constructor(config: Partial<EngineConfig> = {}, deps: EngineDeps = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = deps.rng ?? Math.random;
    this.now = deps.now ?? defaultNow;
    this.state = this.makeIdleState();
  }

  getState(): RoundState {
    return this.state;
  }

  getConfig(): EngineConfig {
    return this.config;
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Force the next launched round to crash at this value. Pass null to clear. */
  setDebugCrashPoint(value: number | null): void {
    if (value !== null && value < this.config.minCrashPoint) {
      throw new Error(`debug crashpoint must be >= ${this.config.minCrashPoint}`);
    }
    this.debugCrashPoint = value;
  }

  getDebugCrashPoint(): number | null {
    return this.debugCrashPoint;
  }

  launch(round: RoundConfig): RoundState {
    if (this.state.status === "running") {
      throw new Error("cannot launch while a round is running");
    }
    if (round.stake <= 0) throw new Error("stake must be > 0");
    const mode = round.mode ?? "classic";
    const hasAuto = mode === "auto" || mode === "pro-auto";
    const hasPro = mode === "pro" || mode === "pro-auto";
    if (hasAuto) {
      if (!round.autoTarget || round.autoTarget <= 1) {
        throw new Error("auto mode requires autoTarget > 1");
      }
    }
    if (hasPro) {
      if (!round.maxStake || round.maxStake < round.stake) {
        throw new Error("pro mode requires maxStake >= stake");
      }
    }
    const crashPoint =
      this.debugCrashPoint !== null
        ? round3(this.debugCrashPoint)
        : genCrashPoint(this.config.rtp, this.config.minCrashPoint, this.rng);

    this.state = {
      ...this.makeIdleState(),
      status: "running",
      mode,
      stake: round.stake,
      stakeBasis: round.stake,
      proTopUps: [],
      maxStake: hasPro ? (round.maxStake as number) : round.stake,
      crashPoint,
      autoTarget: hasAuto ? round.autoTarget ?? null : null,
      startedAt: this.now(),
      debugCrashPoint: this.debugCrashPoint,
      streakClimbAccum: 0,
      heatPercent: 0,
    };
    this.emit({ type: "launch", state: this.state });
    return this.state;
  }

  tap(opts: { addStake?: number } = {}): RoundState {
    if (this.state.status !== "running") return this.state;
    // Sync the multiplier to the moment of the tap so M_add reflects what the
    // player saw. If time-based climb crashed the round in between, reject.
    this.recomputeMultiplier(this.now());
    if (this.state.status !== "running") return this.state;
    const s = this.state;
    const taps = s.taps + 1;
    const streakProgress = taps % this.config.streakSize;
    const streakJustCompleted = streakProgress === 0;
    const streaksCompleted = streakJustCompleted
      ? s.streaksCompleted + 1
      : s.streaksCompleted;
    const room = Math.max(0, s.maxStake - s.stake);
    const requested = Math.max(0, opts.addStake ?? 0);
    const stakeDelta = Math.min(requested, room);
    const nextStake = round3(s.stake + stakeDelta);
    const isProMode = s.mode === "pro" || s.mode === "pro-auto";
    const overloadTaps = isProMode && requested > 0 && room === 0
      ? s.overloadTaps + 1
      : s.overloadTaps;
    const mAtTap = s.multiplier;
    const basisDelta =
      stakeDelta > 0 && mAtTap > 0
        ? round3((stakeDelta * this.config.rtp) / mAtTap)
        : 0;
    const stakeBasis = round3(s.stakeBasis + basisDelta);
    const proTopUps =
      stakeDelta > 0
        ? [...s.proTopUps, { multiplier: mAtTap, stakeAdded: stakeDelta }]
        : s.proTopUps;
    const streakBonus = streakJustCompleted
      ? zoneStreakBonus(mAtTap, this.config.zoneStreakBonuses)
      : 0;
    const streakClimbAccum = streakJustCompleted
      ? round3(s.streakClimbAccum + streakBonus)
      : s.streakClimbAccum;
    this.state = {
      ...s,
      taps,
      streakProgress,
      streaksCompleted,
      stake: nextStake,
      stakeBasis,
      proTopUps,
      overloadTaps,
      streakClimbAccum,
    };
    this.emit({ type: "tap", state: this.state });
    if (streakJustCompleted) {
      this.emit({
        type: "streak",
        state: this.state,
        streak: streaksCompleted,
        bonus: streakBonus,
      });
    }
    this.recomputeMultiplier(this.now());
    return this.state;
  }

  cashOut(): RoundState {
    if (this.state.status !== "running") return this.state;
    const m = this.state.multiplier;
    this.state = {
      ...this.state,
      status: "cashed_out",
      finalMultiplier: m,
      payout: round3(this.state.stakeBasis * m),
      endedAt: this.now(),
    };
    this.emit({ type: "cashout", state: this.state });
    return this.state;
  }

  /** Advance the round clock. Caller drives this from RAF/setInterval/tests. */
  tick(nowMs?: number): RoundState {
    if (this.state.status !== "running") return this.state;
    const t = nowMs ?? this.now();
    this.recomputeMultiplier(t);
    if (this.state.status === "running") {
      this.emit({ type: "tick", state: this.state });
    }
    return this.state;
  }

  /** Force end the active round as crashed (operator/limit kill-switch). */
  forceCrash(): RoundState {
    if (this.state.status !== "running") return this.state;
    this.state = { ...this.state, multiplier: this.state.crashPoint };
    this.applyCrash(this.now());
    return this.state;
  }

  private recomputeMultiplier(nowMs: number): void {
    const s = this.state;
    if (s.startedAt === null) return;
    const elapsedSec = Math.max(0, (nowMs - s.startedAt) / 1000);
    const climb = elapsedSec * this.config.baseClimbPerSec;
    const tapClimb = s.taps * this.config.tapIncrement;
    const streakClimb = s.streakClimbAccum;
    const overloadClimb = s.overloadTaps * this.config.proOverloadTapBonus;
    const next = round3(1 + climb + tapClimb + streakClimb + overloadClimb);
    if (next >= s.crashPoint) {
      this.state = { ...s, multiplier: s.crashPoint };
      this.applyCrash(nowMs);
      return;
    }
    const heat = heatFromMultiplier(next);
    const prevHeatIndex = s.heatIndex;
    this.state = {
      ...s,
      multiplier: next,
      zone: zoneFromMultiplier(next),
      heat: heat.heat,
      heatIndex: heat.heatIndex,
      heatPercent: heat.heatPercent,
    };
    if (heat.heatIndex !== prevHeatIndex) {
      this.emit({ type: "heat", state: this.state, heat: heat.heat });
    }
    if (
      (s.mode === "auto" || s.mode === "pro-auto") &&
      s.autoTarget !== null &&
      next >= s.autoTarget
    ) {
      this.cashOut();
    }
  }

  private applyCrash(nowMs: number): void {
    const s = this.state;
    this.state = {
      ...s,
      status: "crashed",
      finalMultiplier: s.crashPoint,
      payout: 0,
      zone: zoneFromMultiplier(s.crashPoint),
      endedAt: nowMs,
    };
    this.emit({ type: "crash", state: this.state });
  }

  private makeIdleState(): RoundState {
    return {
      status: "idle",
      mode: "classic",
      stake: 0,
      stakeBasis: 0,
      proTopUps: [],
      multiplier: 1,
      crashPoint: 0,
      finalMultiplier: 0,
      payout: 0,
      taps: 0,
      streaksCompleted: 0,
      streakProgress: 0,
      heat: "low" as HeatLevel,
      heatIndex: 0,
      heatPercent: 0,
      streakClimbAccum: 0,
      zone: "idle",
      autoTarget: null,
      maxStake: 0,
      overloadTaps: 0,
      startedAt: null,
      endedAt: null,
      debugCrashPoint: null,
    };
  }

  private emit(event: EngineEvent): void {
    for (const l of this.listeners) l(event);
  }
}

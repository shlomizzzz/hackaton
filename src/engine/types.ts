export type RoundStatus = "idle" | "running" | "cashed_out" | "crashed";

export type RoundMode = "classic" | "auto" | "pro" | "pro-auto";

export type HeatLevel = "low" | "medium" | "hot" | "overloading";

export type Zone = "idle" | "low" | "high" | "jackpot";

export interface EngineConfig {
  /** Target RTP used by the crash-point formula (0.97 = 97%). */
  rtp: number;
  /** Base time-based climb in multiplier units per second. */
  baseClimbPerSec: number;
  /** Multiplier added per individual tap (immediate per-tap nudge, default 0). */
  tapIncrement: number;
  /** Number of taps that complete one streak. */
  streakSize: number;
  /**
   * Streak-completion multiplier bonus by zone, evaluated at the multiplier
   * when the streak completes. Index [low (<10), high (10..<50), jackpot (>=50)].
   */
  zoneStreakBonuses: readonly [number, number, number];
  /** Lowest multiplier emitted by the crash RNG. */
  minCrashPoint: number;
  /** Extra multiplier added by each tap after Pro-mode stake cap is reached. */
  proOverloadTapBonus: number;
}

export interface RoundConfig {
  stake: number;
  mode?: RoundMode;
  /** Target multiplier for auto mode; engine cashes out when reached. */
  autoTarget?: number;
  /** Stake ceiling for Pro mode; taps add stake up to this cap. */
  maxStake?: number;
}

/** A single Pro-mode stake top-up applied during a round. */
export interface ProTopUp {
  /** Multiplier at the moment the stake was added. */
  multiplier: number;
  /** Amount of stake added by this tap. */
  stakeAdded: number;
}

export interface RoundState {
  status: RoundStatus;
  mode: RoundMode;
  stake: number;
  /**
   * Effective stake basis used for payout: launch stake plus each top-up
   * weighted by `rtp / multiplier_at_topup`. Payout = stakeBasis * finalMultiplier.
   */
  stakeBasis: number;
  /** Ordered list of Pro-mode top-ups applied during the round. */
  proTopUps: ProTopUp[];
  /** Current visible multiplier (1.00 when idle). */
  multiplier: number;
  /** Crash point for the round. Server truth; UI may hide while running. */
  crashPoint: number;
  /** Multiplier locked in at end of round (cash-out value or crash point). */
  finalMultiplier: number;
  /** Payout = stake * finalMultiplier when cashed_out, else 0. */
  payout: number;
  /** Total taps in the active round. */
  taps: number;
  /** Number of completed 10-tap streaks. */
  streaksCompleted: number;
  /** Progress within the current streak, 0..streakSize-1. */
  streakProgress: number;
  /** Discrete heat level derived from the live multiplier. Cosmetic for FE. */
  heat: HeatLevel;
  /** Numeric heat index 0..3 matching HeatLevel order. */
  heatIndex: number;
  /** Continuous 0..1 heat fill driven by the multiplier. */
  heatPercent: number;
  /** Running sum of zone-weighted streak-completion bonuses applied so far. */
  streakClimbAccum: number;
  /** Spatial zone of the current multiplier. */
  zone: Zone;
  /** Auto-mode cash-out target if set. */
  autoTarget: number | null;
  /** Stake ceiling (Pro mode). Equal to entry stake for Classic/Auto. */
  maxStake: number;
  /** Taps that occurred after the Pro stake cap was reached. */
  overloadTaps: number;
  /** Round start timestamp in ms (performance.now compatible). */
  startedAt: number | null;
  /** Round end timestamp in ms. */
  endedAt: number | null;
  /** Whether the active round used the debug crash-point override. */
  debugCrashPoint: number | null;
}

export type EngineEvent =
  | { type: "launch"; state: RoundState }
  | { type: "tick"; state: RoundState }
  | { type: "tap"; state: RoundState }
  | { type: "streak"; state: RoundState; streak: number; bonus: number }
  | { type: "heat"; state: RoundState; heat: HeatLevel }
  | { type: "cashout"; state: RoundState }
  | { type: "crash"; state: RoundState };

export type EngineListener = (event: EngineEvent) => void;

import type { HeatLevel, Zone } from "./types";

export const HEAT_LEVELS: readonly HeatLevel[] = [
  "low",
  "medium",
  "hot",
  "overloading",
] as const;

/**
 * Heat is derived from the live multiplier and rendered as a 0..1 percent
 * plus a discrete `HeatLevel` for theming. Mapping (piecewise linear):
 *   - M = 1   -> 0%   (cold)
 *   - M = 10  -> 50%  (warm)
 *   - M = 50  -> 85%  (hot)
 *   - M >= 100-> 100% (overloading)
 */
export function heatFromMultiplier(m: number): {
  heat: HeatLevel;
  heatIndex: number;
  heatPercent: number;
} {
  let pct: number;
  if (m <= 1) pct = 0;
  else if (m < 10) pct = ((m - 1) / 9) * 0.5;
  else if (m < 50) pct = 0.5 + ((m - 10) / 40) * 0.35;
  else pct = 0.85 + Math.min(1, (m - 50) / 50) * 0.15;
  pct = Math.max(0, Math.min(1, pct));
  let heatIndex: number;
  if (pct < 0.25) heatIndex = 0;
  else if (pct < 0.6) heatIndex = 1;
  else if (pct < 0.9) heatIndex = 2;
  else heatIndex = 3;
  return { heat: HEAT_LEVELS[heatIndex] as HeatLevel, heatIndex, heatPercent: pct };
}

export function zoneFromMultiplier(m: number): Zone {
  if (m < 1) return "idle";
  if (m < 10) return "low";
  if (m < 50) return "high";
  return "jackpot";
}

/**
 * Streak-completion bonus, by multiplier zone evaluated at the moment of
 * completion. Index aligns with `bonuses[0]` for low (M < 10), `bonuses[1]`
 * for high (10 <= M < 50), `bonuses[2]` for jackpot (M >= 50).
 */
export function zoneStreakBonus(m: number, bonuses: readonly [number, number, number]): number {
  if (m < 10) return bonuses[0];
  if (m < 50) return bonuses[1];
  return bonuses[2];
}

/**
 * Provably-fair crash-point with explicit house-edge bust:
 *   - P(crash = 1.00) = 1 - rtp           (instant bust, the house edge)
 *   - otherwise crash = 1 / (1 - u), u ~ Uniform[0, 1)
 * Yields P(crash >= M) = rtp / M for M >= 1, i.e. the target RTP.
 */
export function genCrashPoint(
  rtp: number,
  minCrashPoint: number,
  rng: () => number = Math.random,
): number {
  let r = rng();
  while (r >= 1) r = rng();
  const houseEdge = 1 - rtp;
  if (r < houseEdge) return 1.0;
  const u = (r - houseEdge) / rtp;
  const raw = 1 / (1 - u);
  return Math.max(minCrashPoint, round3(raw));
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface StakeTopUpLike {
  stakeAdded: number;
}

export function initialStakeFromTotal(
  totalStake: number,
  topUps: readonly StakeTopUpLike[] | undefined,
): number {
  if (!Number.isFinite(totalStake)) return 0;
  const topUpTotal = (topUps ?? []).reduce((sum, topUp) => {
    return sum + (Number.isFinite(topUp.stakeAdded) ? topUp.stakeAdded : 0);
  }, 0);
  return Math.max(0, Math.round((totalStake - topUpTotal) * 100) / 100);
}
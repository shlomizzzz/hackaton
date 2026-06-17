import { describe, expect, it } from "vitest";
import { initialStakeFromTotal } from "../src/game/history";

describe("history stake display helpers", () => {
  it("derives initial stake from total stake and Pro top-ups", () => {
    const initial = initialStakeFromTotal(8, [
      { stakeAdded: 1 },
      { stakeAdded: 1 },
      { stakeAdded: 1 },
      { stakeAdded: 1 },
      { stakeAdded: 1 },
      { stakeAdded: 1 },
      { stakeAdded: 1 },
    ]);

    expect(initial).toBe(1);
  });

  it("keeps total stake as the initial stake when there are no top-ups", () => {
    expect(initialStakeFromTotal(2.5, undefined)).toBe(2.5);
  });
});
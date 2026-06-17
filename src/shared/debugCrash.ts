import type { RocketRushEngine } from "../engine";

export const DEBUG_CRASH_KEY = "rr.debugCrashPoint";

export function readPersistedDebugCrash(): number | null {
  try {
    const raw = localStorage.getItem(DEBUG_CRASH_KEY);
    if (raw === null || raw === "") return null;
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function persistDebugCrash(value: number | null): void {
  try {
    if (value === null) localStorage.removeItem(DEBUG_CRASH_KEY);
    else localStorage.setItem(DEBUG_CRASH_KEY, String(value));
  } catch {
    /* ignore */
  }
}

/**
 * Applies the persisted override to the engine on load and keeps it in sync
 * across tabs/pages by listening to the `storage` event.
 */
export function bindPersistedDebugCrash(
  engine: RocketRushEngine,
  onChange?: (value: number | null) => void,
): void {
  const apply = (value: number | null) => {
    try {
      engine.setDebugCrashPoint(value);
      onChange?.(value);
    } catch {
      /* invalid value ignored */
    }
  };
  apply(readPersistedDebugCrash());
  window.addEventListener("storage", (e) => {
    if (e.key !== DEBUG_CRASH_KEY) return;
    const v = e.newValue === null || e.newValue === "" ? null : parseFloat(e.newValue);
    apply(Number.isFinite(v as number) ? (v as number) : null);
  });
}

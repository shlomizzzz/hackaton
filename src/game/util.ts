/** Crockford base32 alphabet (excludes I, L, O, U). */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Generates a ULID-like 26-character identifier using Crockford base32.
 * Time-prefixed so IDs sort chronologically and read like real round IDs.
 */
export function generateRoundId(now: number = Date.now()): string {
  let time = now;
  const timeChars: string[] = [];
  for (let i = 0; i < 10; i++) {
    timeChars.unshift(CROCKFORD[time % 32] ?? "0");
    time = Math.floor(time / 32);
  }
  let rand = "";
  for (let i = 0; i < 16; i++) {
    rand += CROCKFORD[Math.floor(Math.random() * 32)] ?? "0";
  }
  return timeChars.join("") + rand;
}

/**
 * Returns "YYYY-MM-DD, HH:MM:SS GMT ±N" using the local timezone offset.
 */
export function formatDateTime(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "−";
  const hours = Math.floor(Math.abs(offsetMin) / 60);
  const mins = Math.abs(offsetMin) % 60;
  const tz = mins === 0 ? `GMT ${sign}${hours}` : `GMT ${sign}${hours}:${pad(mins)}`;
  return `${date}, ${time} ${tz}`;
}

/** Formats a Date as a "YYYY-MM-DD" date heading. */
export function formatDateHeading(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Formats a Date as "HH:MM" wall clock. */
export function formatClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

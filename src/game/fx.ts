import { getSkin } from "./rockets";

const SPARK_COLORS = ["#facc15", "#fbbf24", "#f87171", "#60a5fa", "#4ade80"];
type MultiplierTheme = "low" | "high" | "jackpot";

const THEME_SPARK_COLORS: Record<MultiplierTheme, readonly string[]> = {
  low: ["#bbf7d0", "#4ade80", "#22c55e", "#86efac"],
  high: ["#fef3c7", "#fbbf24", "#f59e0b", "#fde047"],
  jackpot: ["#fecaca", "#f87171", "#ef4444", "#fb923c"],
};

const boostTimers = new WeakMap<HTMLElement, number>();
const spaceBoostTimers = new WeakMap<HTMLElement, number>();

export function rocketTap(rocket: HTMLElement): void {
  rocket.classList.remove("tap");
  void rocket.offsetWidth;
  rocket.classList.add("tap");
}

export function rocketBoost(rocket: HTMLElement): void {
  const previous = boostTimers.get(rocket);
  if (previous !== undefined) clearTimeout(previous);
  rocket.classList.remove("boost");
  void rocket.offsetWidth;
  rocket.classList.add("boost");
  const handle = window.setTimeout(() => {
    rocket.classList.remove("boost");
    boostTimers.delete(rocket);
  }, 460);
  boostTimers.set(rocket, handle);
}

export function spaceBoost(zones: HTMLElement): void {
  const previous = spaceBoostTimers.get(zones);
  if (previous !== undefined) clearTimeout(previous);
  zones.classList.remove("sky-boost");
  void zones.offsetWidth;
  zones.classList.add("sky-boost");
  const handle = window.setTimeout(() => {
    zones.classList.remove("sky-boost");
    spaceBoostTimers.delete(zones);
  }, 180);
  spaceBoostTimers.set(zones, handle);
}

export function setRocketFlying(rocket: HTMLElement, flying: boolean): void {
  rocket.classList.toggle("flying", flying);
}

export function applyRocketSkin(body: HTMLElement, skinId: string): void {
  body.innerHTML = getSkin(skinId).svg;
}

export function setHeatTint(rocket: HTMLElement, heatIndex: number): void {
  rocket.classList.remove("h1", "h2", "h3");
  if (heatIndex === 1) rocket.classList.add("h1");
  else if (heatIndex === 2) rocket.classList.add("h2");
  else if (heatIndex >= 3) rocket.classList.add("h3");
}

const ROCKET_BOTTOM_MIN_PCT = 4;
const ROCKET_BOTTOM_MAX_PCT = 36;

export function setRocketY(rocket: HTMLElement, multiplier: number): void {
  const t = Math.min(1, Math.log10(Math.max(1, multiplier)) / Math.log10(100));
  const pct = ROCKET_BOTTOM_MIN_PCT + t * (ROCKET_BOTTOM_MAX_PCT - ROCKET_BOTTOM_MIN_PCT);
  rocket.style.bottom = `${pct}%`;
}

let streakFlashTimer: number | null = null;

export function streakBurst(
  streakEl: HTMLElement,
  bonus: number,
  theme: MultiplierTheme = "low",
): void {
  if (streakFlashTimer !== null) {
    clearTimeout(streakFlashTimer);
    streakFlashTimer = null;
  }
  streakEl.classList.remove("flash");
  void streakEl.offsetWidth;
  streakEl.classList.add("flash");
  streakFlashTimer = window.setTimeout(() => {
    streakEl.classList.remove("flash");
    streakFlashTimer = null;
  }, 620);

  const floater = document.createElement("div");
  floater.className = `streak-floater zone-${theme}`;
  floater.textContent = `+${bonus.toFixed(2)}×`;
  streakEl.appendChild(floater);
  setTimeout(() => floater.remove(), 950);

  const sparkColors = THEME_SPARK_COLORS[theme] ?? SPARK_COLORS;
  for (let i = 0; i < 8; i++) {
    const s = document.createElement("div");
    s.className = "spark streak-spark";
    const angle = Math.PI + (Math.PI * (i + 0.5)) / 8 + (Math.random() * 0.3 - 0.15);
    const dist = 26 + Math.random() * 22;
    s.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    s.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    s.style.background =
      sparkColors[Math.floor(Math.random() * sparkColors.length)] ?? "#facc15";
    streakEl.appendChild(s);
    setTimeout(() => s.remove(), 720);
  }
}

export function showBanner(
  zones: HTMLElement,
  kind: "win" | "lose",
  text: string,
): void {
  const existing = zones.querySelector(".banner");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = `banner ${kind}`;
  el.textContent = text;
  zones.appendChild(el);
}

export function clearBanner(zones: HTMLElement): void {
  const existing = zones.querySelector(".banner");
  if (existing) existing.remove();
}

export function stakeFloater(
  zones: HTMLElement,
  amount: number,
  x: number,
  y: number,
): void {
  const el = document.createElement("div");
  el.className = "stake-floater";
  el.textContent = `+€${amount.toFixed(2)}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  zones.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

export function rocketCrash(rocket: HTMLElement): void {
  rocket.classList.remove("h1", "h2", "h3", "tap", "boost", "flying");
  rocket.classList.add("crash");
}

export function rocketFlyAway(rocket: HTMLElement): void {
  rocket.classList.remove("h1", "h2", "h3", "tap", "boost", "crash");
  rocket.classList.add("flying", "flyaway");
  const onEnd = (e: Event): void => {
    if ((e as AnimationEvent).animationName !== "rocketFlyAway") return;
    rocket.removeEventListener("animationend", onEnd);
    rocket.classList.remove("flyaway", "flying");
    rocket.style.bottom = `${ROCKET_BOTTOM_MIN_PCT}%`;
  };
  rocket.addEventListener("animationend", onEnd);
}

export function rocketReset(rocket: HTMLElement): void {
  const previous = boostTimers.get(rocket);
  if (previous !== undefined) {
    clearTimeout(previous);
    boostTimers.delete(rocket);
  }
  rocket.classList.remove("crash", "tap", "boost", "h1", "h2", "h3", "flying", "flyaway");
  rocket.style.bottom = `${ROCKET_BOTTOM_MIN_PCT}%`;
}

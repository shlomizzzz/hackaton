import { RocketRushEngine } from "../engine";
import type { RoundMode, RoundState } from "../engine";
import { bindPersistedDebugCrash } from "../shared/debugCrash";
import { mount, setMuteIcon, type Refs } from "./view";
import {
  applyRocketSkin,
  clearBanner,
  rocketBoost,
  rocketCrash,
  rocketFlyAway,
  rocketReset,
  rocketTap,
  setHeatTint,
  setRocketFlying,
  setRocketY,
  showBanner,
  spaceBoost,
  stakeFloater,
  streakBurst,
} from "./fx";
import { DEFAULT_SKIN_ID, ROCKET_SKINS, type RocketSkinId } from "./rockets";
import { initialStakeFromTotal } from "./history";
import {
  formatClock,
  formatDateHeading,
  formatDateTime,
  generateRoundId,
  readJSON,
  writeJSON,
} from "./util";

const MIN_STAKE = 0.5;
const MAX_STAKE = 50;
const STAKE_STEP = 1;
const START_BALANCE = 100;
/** Default Pro mode values; configurable via the Pro Mode Settings popup. */
const PRO_MAX_STAKE = 50;
const PRO_PER_TAP_STAKE = 1;
const PRO_PERTAP_MIN = 0.1;
const PRO_PERTAP_MAX = 5;
const PRO_PERTAP_STEP = 0.1;
const PRO_MAXSTAKE_MIN = 1;
const PRO_MAXSTAKE_MAX = 200;
const PRO_MAXSTAKE_STEP = 5;
const GAME_NAME = "ROCKET RUSH";
const HISTORY_KEY = "rr.history";
const MUTED_KEY = "rr.muted";
const AUTOPLAY_KEY = "rr.autoplay";
const SKIN_KEY = "rr.rocketSkin";
const PRO_SETTINGS_KEY = "rr.proSettings";
const HISTORY_LIMIT = 200;
const AUTOPLAY_GAP_MS = 1600;
const MULTIPLIER_ZONE_CLASSES = ["zone-idle", "zone-low", "zone-high", "zone-jackpot"];
type SpaceCheckpoint = { multiplier: number; y: number };
const SPACE_STRIP_CHECKPOINTS: readonly SpaceCheckpoint[] = [
  { multiplier: 1, y: -90 },
  { multiplier: 1.2, y: -84 },
  { multiplier: 2.2, y: -78 },
  { multiplier: 4.5, y: -70 },
  { multiplier: 8, y: -60 },
  { multiplier: 10, y: -50 },
  { multiplier: 16, y: -44 },
  { multiplier: 26, y: -37 },
  { multiplier: 40, y: -30 },
  { multiplier: 48, y: -25 },
  { multiplier: 50, y: -21 },
  { multiplier: 70, y: -12 },
  { multiplier: 100, y: 0 },
];
type MultiplierTheme = "low" | "high" | "jackpot";

interface BetRecordTopUp {
  multiplier: number;
  stakeAdded: number;
}

interface BetRecord {
  id: string;
  game: string;
  stake: number;
  startedAt: number;
  endedAt: number;
  crashPoint: number;
  cashOut: number | null;
  payout: number;
  /** Effective stake basis (= stake when no top-ups occurred). Optional for back-compat. */
  stakeBasis?: number;
  /** Pro-mode stake top-ups applied during the round. */
  proTopUps?: BetRecordTopUp[];
}

interface UI {
  balance: number;
  stake: number;
  mode: RoundMode;
  autoTarget: number | null;
  roundId: string;
  muted: boolean;
  history: BetRecord[];
  recentExpanded: boolean;
  recentPage: number;
  rocketSkin: RocketSkinId;
}

interface AutoplaySettings { rounds: number; target: number; targetEnabled: boolean; proEnabled: boolean; }
interface ProSettings { initialStake: number; perTap: number; maxStake: number; }
interface AutoplayState {
  active: boolean;
  pendingStop: boolean;
  total: number;
  current: number;
  timer: number | null;
}

const RECENT_PAGE_SIZE = 10;
const REVEAL_MS = 1200;

type GhostPhase = "idle" | "animating" | "frozen";
interface GhostState {
  phase: GhostPhase;
  startMult: number;
  startedAt: number;
  crashPoint: number;
}
const ghost: GhostState = { phase: "idle", startMult: 1, startedAt: 0, crashPoint: 0 };

const root = document.getElementById("app");
if (!root) throw new Error("missing #app root");

const engine = new RocketRushEngine();
const refs = mount(root);

function migrateHistory(records: BetRecord[]): BetRecord[] {
  const MIN_VALID_MS = 1_000_000_000_000;
  const now = Date.now();
  let mutated = false;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r || r.endedAt >= MIN_VALID_MS) continue;
    const endedAt = now - i * 1000;
    const duration = Math.max(0, r.endedAt - r.startedAt);
    r.endedAt = endedAt;
    r.startedAt = endedAt - duration;
    mutated = true;
  }
  if (mutated) writeJSON(HISTORY_KEY, records);
  return records;
}

const AUTOPLAY_ROUNDS_OPTIONS = [5, 10, 25, 50, 100] as const;

function loadAutoplaySettings(): AutoplaySettings {
  const raw = readJSON<Partial<AutoplaySettings> & { target?: number | null }>(
    AUTOPLAY_KEY,
    {} as Partial<AutoplaySettings>,
  );
  const rounds = pickRoundsOption(
    typeof raw.rounds === "number" && raw.rounds >= 1 ? Math.floor(raw.rounds) : 10,
  );
  const storedTarget = typeof raw.target === "number" ? raw.target : null;
  const targetEnabled =
    typeof raw.targetEnabled === "boolean" ? raw.targetEnabled : storedTarget !== null;
  const target = storedTarget !== null && storedTarget > 1 ? storedTarget : 2.0;
  const proEnabled = typeof raw.proEnabled === "boolean" ? raw.proEnabled : false;
  return { rounds, target, targetEnabled, proEnabled };
}

function loadRocketSkin(): RocketSkinId {
  const stored = readJSON<string | null>(SKIN_KEY, null);
  return ROCKET_SKINS.find((s) => s.id === stored)?.id ?? DEFAULT_SKIN_ID;
}

function loadProSettings(): ProSettings {
  const raw = readJSON<Partial<ProSettings>>(PRO_SETTINGS_KEY, {});
  const initialStake =
    typeof raw.initialStake === "number" && raw.initialStake > 0 ? raw.initialStake : 1;
  const perTap =
    typeof raw.perTap === "number" && raw.perTap > 0 ? raw.perTap : PRO_PER_TAP_STAKE;
  const maxStake =
    typeof raw.maxStake === "number" && raw.maxStake > 0 ? raw.maxStake : PRO_MAX_STAKE;
  return { initialStake, perTap, maxStake };
}

const ui: UI = {
  balance: START_BALANCE,
  stake: 1,
  mode: "classic",
  autoTarget: 2,
  roundId: generateRoundId(),
  muted: readJSON<boolean>(MUTED_KEY, false),
  history: migrateHistory(readJSON<BetRecord[]>(HISTORY_KEY, [])),
  recentExpanded: false,
  recentPage: 0,
  rocketSkin: loadRocketSkin(),
};

const autoplaySettings: AutoplaySettings = loadAutoplaySettings();
ui.autoTarget = autoplaySettings.targetEnabled ? autoplaySettings.target : null;

const proSettings: ProSettings = loadProSettings();

const autoplay: AutoplayState = {
  active: false, pendingStop: false, total: 0, current: 0, timer: null,
};

function fmtMoney(n: number): string {
  return n.toFixed(2);
}

function fmtMult(m: number): string {
  return `${m.toFixed(2)}×`;
}

function formatStake(v: number): string {
  return v.toFixed(2);
}

function isStakeLocked(): boolean {
  return engine.getState().status === "running" || autoplay.active;
}

function renderStake(): void {
  if (document.activeElement !== refs.stakeInput) {
    refs.stakeInput.value = formatStake(ui.stake);
  }
  if (document.activeElement !== refs.autoplayStakeInput) {
    refs.autoplayStakeInput.value = formatStake(ui.stake);
  }
  const locked = isStakeLocked();
  refs.stakeInput.disabled = locked;
  refs.autoplayStakeInput.disabled = locked;
  const atMin = ui.stake <= MIN_STAKE;
  const atMax = ui.stake >= MAX_STAKE || ui.stake >= ui.balance;
  refs.stakeDec.disabled = locked || atMin;
  refs.stakeInc.disabled = locked || atMax;
  refs.autoplayStakeDec.disabled = locked || atMin;
  refs.autoplayStakeInc.disabled = locked || atMax;
  const maxReachable = Math.min(MAX_STAKE, ui.balance);
  [refs.presets, refs.autoplayPresets].forEach((list) =>
    list.forEach((b) => updatePresetButton(b, locked, maxReachable)),
  );
}

function updatePresetButton(b: HTMLButtonElement, locked: boolean, maxReachable: number): void {
  const p = b.dataset.preset ?? "";
  if (p === "min") {
    b.classList.toggle("active", ui.stake === MIN_STAKE);
    b.disabled = locked;
  } else if (p === "max") {
    b.classList.toggle("active", ui.stake === maxReachable);
    b.disabled = locked;
  } else {
    const v = Number(p);
    b.classList.toggle("active", v === ui.stake);
    b.disabled = locked || v > ui.balance;
  }
}

function renderHeader(): void {
  refs.balance.textContent = `€${fmtMoney(ui.balance)}`;
  refs.roundIdLabel.textContent = `#${ui.roundId}`;
  refs.dateTime.textContent = formatDateTime();
}

function renderTabs(): void {
  refs.tabClassicPill.classList.toggle("active", ui.mode === "classic");
  refs.tabProPill.classList.toggle("active", ui.mode === "pro");
  refs.tabAuto.classList.toggle("active", ui.mode === "auto");
  refs.tabsRow.hidden = autoplay.active;
  refs.btnStopAutoplay.hidden = !autoplay.active;
  refs.btnStopAutoplay.disabled = autoplay.pendingStop;
  refs.btnStopAutoplay.textContent = autoplay.pendingStop
    ? "Stopping…"
    : "Stop autoplay";
  renderInfoToggle();
}

function renderInfoToggle(): void {
  // Info buttons live next to Classic/Pro tabs; they hide with the tabs row
  // automatically during active autoplay. No per-mode visibility needed.
}

function isProRound(mode: RoundMode): boolean {
  return mode === "pro" || mode === "pro-auto";
}

function multiplierTheme(multiplier: number): MultiplierTheme {
  if (multiplier >= 50) return "jackpot";
  if (multiplier >= 10) return "high";
  return "low";
}

function spaceStripY(multiplier: number): number {
  const value = Math.max(1, multiplier);
  let prev = SPACE_STRIP_CHECKPOINTS[0]!;
  for (const next of SPACE_STRIP_CHECKPOINTS.slice(1)) {
    if (value <= next.multiplier) {
      const prevLog = Math.log10(prev.multiplier);
      const nextLog = Math.log10(next.multiplier);
      const range = nextLog - prevLog;
      const t = range === 0 ? 1 : (Math.log10(value) - prevLog) / range;
      return prev.y + Math.min(1, Math.max(0, t)) * (next.y - prev.y);
    }
    prev = next;
  }
  return prev.y;
}

function renderMultiplierTheme(state: RoundState): void {
  const active = state.status !== "idle";
  const multiplier = active ? state.multiplier : 1;
  const themeClass = active ? `zone-${multiplierTheme(multiplier)}` : "zone-idle";
  refs.zones.classList.toggle("speeding", state.status === "running");
  refs.zones.classList.toggle("solar-reached", active && multiplier >= 10);
  refs.zones.classList.toggle("asteroid-reached", active && multiplier >= 48);
  refs.zones.classList.toggle("outer-reached", active && multiplier >= 50);
  for (const el of [refs.zones, refs.streakContainer, refs.mult]) {
    el.classList.remove(...MULTIPLIER_ZONE_CLASSES);
    el.classList.add(themeClass);
  }
  const y = spaceStripY(multiplier);
  refs.zones.style.setProperty("--space-y", `${y.toFixed(2)}%`);
}

function renderAction(state: RoundState): void {
  const btn = refs.action;
  btn.classList.remove("launch", "cashout", "crashed", "stop");
  btn.disabled = false;
  let main: string;
  if (state.status === "running") {
    btn.classList.add("cashout");
    const payout = state.stakeBasis * state.multiplier;
    main = `Cash Out · €${fmtMoney(payout)}`;
  } else if (autoplay.active) {
    btn.classList.add("launch");
    main = "Next round…";
    btn.disabled = true;
  } else {
    btn.classList.add("launch");
    main = "Launch";
    btn.disabled = ui.stake > ui.balance;
  }
  refs.actionMain.textContent = main;
  refs.actionSub.textContent = autoplaySubText();
  updateProPanelVisibility(state);
}

function renderProCompact(): void {
  refs.proCompactInitial.textContent = `€${fmtMoney(proSettings.initialStake)}`;
  refs.proCompactPerTap.textContent = `+ €${fmtMoney(proSettings.perTap)}`;
  refs.proCompactMax.textContent = `€${fmtMoney(proSettings.maxStake)}`;
}

function updateProPanelVisibility(state: RoundState): void {
  const showCompact = state.status === "running" && isProRound(state.mode);
  refs.betPanel.hidden = showCompact;
  refs.proCompact.hidden = !showCompact;
  if (showCompact) renderProCompact();
}

function autoplaySubText(): string {
  if (!autoplay.active) return "";
  const human = Math.min(autoplay.current + 1, autoplay.total);
  if (autoplay.pendingStop) {
    return `Stopping after round ${human} / ${autoplay.total}`;
  }
  const tail =
    ui.autoTarget !== null
      ? `target ${ui.autoTarget.toFixed(2)}×`
      : "manual cash out";
  return `Round ${human} / ${autoplay.total} · ${tail}`;
}

function renderStreak(state: RoundState): void {
  const running = state.status === "running";
  const filled = running ? state.streakProgress : 0;
  if (!running || state.streakProgress > 0) {
    refs.streakContainer.classList.remove("flash");
  }
  refs.streakDots.forEach((d, i) => d.classList.toggle("on", i < filled));
}

function renderHeat(state: RoundState): void {
  renderMultiplierTheme(state);
  const pct = state.status === "running" ? state.heatPercent * 100 : 0;
  refs.heatFill.style.clipPath = `inset(${100 - pct}% 0 0 0)`;
  setHeatTint(refs.rocket, state.status === "running" ? state.heatIndex : 0);
}

function renderMult(state: RoundState): void {
  refs.mult.classList.remove("crashed", "cashed");
  if (state.status === "crashed") refs.mult.classList.add("crashed");
  else if (state.status === "cashed_out") refs.mult.classList.add("cashed");
  refs.mult.textContent = fmtMult(state.status === "idle" ? 1 : state.multiplier);
}

function renderAll(state: RoundState): void {
  renderMult(state);
  renderStreak(state);
  renderHeat(state);
  renderAction(state);
  renderInfoToggle();
  renderStake();
  setRocketY(refs.rocket, state.status === "idle" ? 1 : state.multiplier);
  setRocketFlying(refs.rocket, state.status === "running");
}

function setRocketSkin(id: RocketSkinId): void {
  ui.rocketSkin = id;
  writeJSON(SKIN_KEY, id);
  refs.rocket.dataset.skin = id;
  applyRocketSkin(refs.rocketBody, id);
  refs.skinGrid.querySelectorAll<HTMLElement>(".skin-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.skin === id);
  });
}

function onSkinGridClick(e: Event): void {
  const card = (e.target as HTMLElement).closest<HTMLElement>(".skin-card");
  if (!card || !card.dataset.skin) return;
  const id = card.dataset.skin as RocketSkinId;
  if (!ROCKET_SKINS.some((s) => s.id === id)) return;
  setRocketSkin(id);
  closeAllOverlays();
}

function renderRecent(): void {
  refs.recent.innerHTML = "";
  const items = ui.history.slice(0, 12);
  for (const r of items) {
    const chip = document.createElement("div");
    const win = r.payout > 0;
    chip.className = `chip ${win ? "win" : "lose"}`;
    chip.textContent = `${r.crashPoint.toFixed(2)}×`;
    refs.recent.appendChild(chip);
  }
}

function renderRecentList(): void {
  const list = refs.recentList;
  if (ui.history.length === 0) {
    list.innerHTML = `<div class="recent-list-rows"><div class="row"><span class="t">No rounds yet</span></div></div>`;
    return;
  }
  const totalPages = Math.max(1, Math.ceil(ui.history.length / RECENT_PAGE_SIZE));
  ui.recentPage = Math.min(Math.max(0, ui.recentPage), totalPages - 1);
  const start = ui.recentPage * RECENT_PAGE_SIZE;
  const slice = ui.history.slice(start, start + RECENT_PAGE_SIZE);
  const rowsHtml = slice.map((r) => {
    const win = r.payout > 0;
    const delta = win ? r.payout - r.stake : r.stake;
    return `<div class="row ${win ? "win" : "lose"}">
      <span class="t">${formatClock(new Date(r.endedAt))}</span>
      <span class="m">${r.crashPoint.toFixed(2)}×</span>
      <span class="t">${win ? "+" : "−"}€${fmtMoney(delta)}</span>
    </div>`;
  }).join("");
  const showPager = totalPages > 1;
  const footHtml = showPager ? `
    <div class="recent-list-foot">
      <button class="pg" data-pg="prev" aria-label="Newer" ${ui.recentPage === 0 ? "disabled" : ""}>‹</button>
      <span class="pg-label">${ui.recentPage + 1} / ${totalPages}</span>
      <button class="pg" data-pg="next" aria-label="Older" ${ui.recentPage >= totalPages - 1 ? "disabled" : ""}>›</button>
    </div>` : "";
  list.innerHTML = `<div class="recent-list-rows">${rowsHtml}</div>${footHtml}`;
}

function renderTopUpsHtml(r: BetRecord): string {
  if (!r.proTopUps || r.proTopUps.length === 0) return "";
  const rtp = engine.getConfig().rtp;
  const cashedAt = r.cashOut;
  const initialStake = initialStakeFromTotal(r.stake, r.proTopUps);
  const rows = r.proTopUps
    .map((t) => {
      const contrib =
        cashedAt !== null && t.multiplier > 0
          ? t.stakeAdded * (cashedAt / t.multiplier) * rtp
          : 0;
      const contribLabel =
        cashedAt !== null ? `→ +€${fmtMoney(contrib)}` : `→ €0.00`;
      return `<div class="topup-row">
        <span class="topup-add">+€${fmtMoney(t.stakeAdded)} @ ${t.multiplier.toFixed(2)}×</span>
        <span class="topup-contrib">${contribLabel}</span>
      </div>`;
    })
    .join("");
  return `<div class="topups">
    <div class="lbl">PRO TOP-UPS</div>
    <div class="topup-row initial-stake">
      <span class="topup-add">Initial stake</span>
      <span class="topup-contrib">€${fmtMoney(initialStake)}</span>
    </div>
    ${rows}
  </div>`;
}

function renderHistorySheet(): void {
  const body = refs.historyBody;
  body.innerHTML = "";
  if (ui.history.length === 0) {
    body.innerHTML = `<div class="empty">No bets yet — place your first one.</div>`;
    return;
  }
  let lastDay = "";
  for (const r of ui.history) {
    const day = formatDateHeading(new Date(r.endedAt));
    if (day !== lastDay) {
      const h = document.createElement("div");
      h.className = "day-hdr";
      h.textContent = day;
      body.appendChild(h);
      lastDay = day;
    }
    const card = document.createElement("div");
    card.className = "bet-card";
    const win = r.payout > 0;
    const topUpsHtml = renderTopUpsHtml(r);
    card.innerHTML = `
      <div class="top">
        <div class="bet-game">${r.game}</div>
        <div class="stake">€${fmtMoney(r.stake)}</div>
      </div>
      <div class="meta-row">
        <span class="rid" title="${r.id}">#${r.id}</span>
        <span class="payout ${win ? "win" : "lose"}">€${fmtMoney(r.payout)}</span>
      </div>
      <div class="details">
        <div><div class="lbl">CRASH</div><div class="val">${win ? "—" : r.crashPoint.toFixed(2) + "×"}</div></div>
        <div><div class="lbl">CASH OUT</div><div class="val">${r.cashOut !== null ? r.cashOut.toFixed(2) + "×" : "—"}</div></div>
        <div><div class="lbl">PAYOUT</div><div class="val">€${fmtMoney(r.payout)}</div></div>
      </div>
      ${topUpsHtml}
    `;
    card.addEventListener("click", () => card.classList.toggle("expanded"));
    body.appendChild(card);
  }
}

function setStake(v: number): void {
  if (!Number.isFinite(v)) v = MIN_STAKE;
  const cents = Math.round(v * 100) / 100;
  const cap = Math.max(MIN_STAKE, Math.min(MAX_STAKE, ui.balance));
  ui.stake = Math.max(MIN_STAKE, Math.min(cap, cents));
  renderStake();
  renderAction(engine.getState());
}

function onStakeInput(): void {
  const raw = refs.stakeInput.value.replace(",", ".");
  if (raw === "" || raw === "." || raw === "-") return;
  const n = parseFloat(raw);
  if (Number.isFinite(n)) setStake(n);
}

function onStakeBlur(): void {
  refs.stakeInput.value = formatStake(ui.stake);
}

type ProField = "initialStake" | "perTap" | "maxStake";

function proFieldBounds(field: ProField): { min: number; max: number } {
  if (field === "initialStake") {
    return { min: MIN_STAKE, max: Math.max(MIN_STAKE, Math.min(MAX_STAKE, ui.balance)) };
  }
  if (field === "perTap") return { min: PRO_PERTAP_MIN, max: PRO_PERTAP_MAX };
  return { min: PRO_MAXSTAKE_MIN, max: PRO_MAXSTAKE_MAX };
}

function setProField(field: ProField, raw: number): void {
  if (!Number.isFinite(raw)) return;
  const { min, max } = proFieldBounds(field);
  const cents = Math.round(raw * 100) / 100;
  proSettings[field] = Math.max(min, Math.min(max, cents));
  renderProModalFields();
}

function onProFieldInput(field: ProField, input: HTMLInputElement): void {
  const raw = input.value.replace(",", ".");
  if (raw === "" || raw === "." || raw === "-") return;
  const n = parseFloat(raw);
  if (Number.isFinite(n)) setProField(field, n);
}

function onProFieldBlur(field: ProField, input: HTMLInputElement): void {
  input.value = formatStake(proSettings[field]);
}

function onProPresetClick(field: ProField, b: HTMLButtonElement): void {
  const p = b.dataset.preset ?? "";
  if (p === "max") setProField(field, proFieldBounds(field).max);
  else setProField(field, Number(p));
}

function highlightProPresetGroup(buttons: HTMLButtonElement[], value: number, field: ProField): void {
  const { max } = proFieldBounds(field);
  buttons.forEach((b) => {
    const p = b.dataset.preset ?? "";
    if (p === "max") b.classList.toggle("active", value === max);
    else b.classList.toggle("active", Number(p) === value);
  });
}

function renderProModalFields(): void {
  if (document.activeElement !== refs.proInitialInput) {
    refs.proInitialInput.value = formatStake(proSettings.initialStake);
  }
  if (document.activeElement !== refs.proPerTapInput) {
    refs.proPerTapInput.value = formatStake(proSettings.perTap);
  }
  if (document.activeElement !== refs.proMaxInput) {
    refs.proMaxInput.value = formatStake(proSettings.maxStake);
  }
  refs.proCurrentStakeValue.textContent = `€${fmtMoney(proSettings.initialStake)}`;
  highlightProPresetGroup(refs.proInitialPresets, proSettings.initialStake, "initialStake");
  highlightProPresetGroup(refs.proPerTapPresets, proSettings.perTap, "perTap");
  highlightProPresetGroup(refs.proMaxPresets, proSettings.maxStake, "maxStake");
}

function openProModal(): void {
  renderProModalFields();
  openOverlay(refs.proModal);
}

/** Saves the configured Pro settings, applies the initial stake, and
 * immediately launches a Pro round using the existing Pro mode logic. */
function startProFromModal(): void {
  if (proSettings.maxStake < proSettings.initialStake) {
    proSettings.maxStake = proSettings.initialStake;
  }
  writeJSON(PRO_SETTINGS_KEY, proSettings);
  closeAllOverlays();
  ui.mode = "pro";
  setStake(proSettings.initialStake);
  proSettings.initialStake = ui.stake;
  renderTabs();
  if (ui.stake > ui.balance) return;
  launchRound();
}

function pickRoundsOption(n: number): number {
  let best: number = AUTOPLAY_ROUNDS_OPTIONS[0];
  let bestDelta = Math.abs(n - best);
  for (const v of AUTOPLAY_ROUNDS_OPTIONS) {
    const d = Math.abs(n - v);
    if (d < bestDelta) { best = v; bestDelta = d; }
  }
  return best;
}

function renderAutoplayRounds(): void {
  refs.autoplayRoundsButtons.forEach((b) => {
    const v = Number(b.dataset.rounds);
    b.classList.toggle("active", v === autoplaySettings.rounds);
  });
}

function onAutoplayRoundsClick(b: HTMLButtonElement): void {
  const v = Number(b.dataset.rounds);
  if (!Number.isFinite(v)) return;
  autoplaySettings.rounds = v;
  renderAutoplayRounds();
}

function stepAutoplayTarget(delta: number): void {
  const raw = refs.autoplayTargetInput.value.trim();
  let base: number;
  if (raw === "") {
    base = autoplaySettings.target ?? 2.0;
  } else {
    const n = parseFloat(raw);
    base = Number.isFinite(n) ? n : 2.0;
  }
  const next = Math.max(1.1, Math.round((base + delta) * 10) / 10);
  refs.autoplayTargetInput.value = next.toFixed(2);
}

function onAutoplayStakeInput(): void {
  const raw = refs.autoplayStakeInput.value.replace(",", ".");
  if (raw === "" || raw === "." || raw === "-") return;
  const n = parseFloat(raw);
  if (Number.isFinite(n)) setStake(n);
}

function onAutoplayStakeBlur(): void {
  refs.autoplayStakeInput.value = formatStake(ui.stake);
}

function setMode(m: RoundMode): void {
  if (engine.getState().status === "running") return;
  if (autoplay.active) return;
  ui.mode = m;
  renderTabs();
  renderAction(engine.getState());
  showTapHintOnce(m);
}

function onTabAutoClick(): void {
  if (autoplay.active) return;
  if (engine.getState().status === "running") return;
  openAutoplayModal();
}

function onTabProClick(): void {
  if (autoplay.active) return;
  if (engine.getState().status === "running") return;
  openProModal();
}

function setMuted(muted: boolean): void {
  ui.muted = muted;
  writeJSON(MUTED_KEY, muted);
  setMuteIcon(refs.btnMute, muted);
}

function toggleRecentList(): void {
  ui.recentExpanded = !ui.recentExpanded;
  refs.recentList.hidden = !ui.recentExpanded;
  refs.recentExpand.classList.toggle("open", ui.recentExpanded);
  if (ui.recentExpanded) {
    ui.recentPage = 0;
    renderRecentList();
  }
}

function onRecentListClick(e: Event): void {
  const target = e.target as HTMLElement;
  const btn = target.closest<HTMLButtonElement>("button[data-pg]");
  if (!btn || btn.disabled) return;
  const totalPages = Math.max(1, Math.ceil(ui.history.length / RECENT_PAGE_SIZE));
  if (btn.dataset.pg === "prev") ui.recentPage = Math.max(0, ui.recentPage - 1);
  else if (btn.dataset.pg === "next") ui.recentPage = Math.min(totalPages - 1, ui.recentPage + 1);
  renderRecentList();
}

function closeAllOverlays(): void {
  refs.helpModal.hidden = true;
  refs.historySheet.hidden = true;
  refs.autoplayModal.hidden = true;
  refs.skinModal.hidden = true;
  refs.proModal.hidden = true;
}

function openOverlay(el: HTMLElement): void {
  closeAllOverlays();
  el.hidden = false;
}

function initEvents(r: Refs): void {
  r.stakeDec.addEventListener("click", () => setStake(ui.stake - STAKE_STEP));
  r.stakeInc.addEventListener("click", () => setStake(ui.stake + STAKE_STEP));
  r.stakeInput.addEventListener("input", onStakeInput);
  r.stakeInput.addEventListener("blur", onStakeBlur);
  r.stakeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  });
  const onPresetClick = (b: HTMLButtonElement) => {
    const p = b.dataset.preset ?? "";
    if (p === "min") setStake(MIN_STAKE);
    else if (p === "max") setStake(MAX_STAKE);
    else setStake(Number(p));
  };
  r.presets.forEach((b) => b.addEventListener("click", () => onPresetClick(b)));
  r.autoplayPresets.forEach((b) => b.addEventListener("click", () => onPresetClick(b)));
  r.autoplayRoundsButtons.forEach((b) =>
    b.addEventListener("click", () => onAutoplayRoundsClick(b)),
  );
  r.autoplayTargetDec.addEventListener("click", () => stepAutoplayTarget(-0.1));
  r.autoplayTargetInc.addEventListener("click", () => stepAutoplayTarget(0.1));
  r.autoplayTargetEnabled.addEventListener("change", onTargetEnabledChange);
  r.autoplayProInfoBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    showAutoplayInfo();
  });
  r.autoplayProInfoText.addEventListener("pointerdown", hideAutoplayInfo);
  r.autoplayModal.addEventListener("pointerdown", () => {
    if (!r.autoplayProInfoText.hidden) hideAutoplayInfo();
  });
  r.autoplayStakeDec.addEventListener("click", () => setStake(ui.stake - STAKE_STEP));
  r.autoplayStakeInc.addEventListener("click", () => setStake(ui.stake + STAKE_STEP));
  r.autoplayStakeInput.addEventListener("input", onAutoplayStakeInput);
  r.autoplayStakeInput.addEventListener("blur", onAutoplayStakeBlur);
  r.autoplayStakeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  });
  r.tabClassic.addEventListener("click", () => setMode("classic"));
  r.tabPro.addEventListener("click", onTabProClick);
  r.tabAuto.addEventListener("click", onTabAutoClick);
  r.action.addEventListener("click", onAction);
  r.btnStopAutoplay.addEventListener("click", requestStopAutoplay);
  r.autoplayClose.addEventListener("click", closeAllOverlays);
  r.autoplayModal.addEventListener("click", (e) => {
    if (e.target === r.autoplayModal) closeAllOverlays();
  });
  r.autoplayStart.addEventListener("click", startAutoplayFromModal);
  r.proClose.addEventListener("click", closeAllOverlays);
  r.proModal.addEventListener("click", (e) => {
    if (e.target === r.proModal) closeAllOverlays();
  });
  r.proInitialDec.addEventListener("click", () =>
    setProField("initialStake", proSettings.initialStake - STAKE_STEP),
  );
  r.proInitialInc.addEventListener("click", () =>
    setProField("initialStake", proSettings.initialStake + STAKE_STEP),
  );
  r.proInitialInput.addEventListener("input", () => onProFieldInput("initialStake", r.proInitialInput));
  r.proInitialInput.addEventListener("blur", () => onProFieldBlur("initialStake", r.proInitialInput));
  r.proInitialInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  });
  r.proInitialPresets.forEach((b) =>
    b.addEventListener("click", () => onProPresetClick("initialStake", b)),
  );
  r.proPerTapDec.addEventListener("click", () =>
    setProField("perTap", proSettings.perTap - PRO_PERTAP_STEP),
  );
  r.proPerTapInc.addEventListener("click", () =>
    setProField("perTap", proSettings.perTap + PRO_PERTAP_STEP),
  );
  r.proPerTapInput.addEventListener("input", () => onProFieldInput("perTap", r.proPerTapInput));
  r.proPerTapInput.addEventListener("blur", () => onProFieldBlur("perTap", r.proPerTapInput));
  r.proPerTapInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  });
  r.proPerTapPresets.forEach((b) => b.addEventListener("click", () => onProPresetClick("perTap", b)));
  r.proMaxDec.addEventListener("click", () =>
    setProField("maxStake", proSettings.maxStake - PRO_MAXSTAKE_STEP),
  );
  r.proMaxInc.addEventListener("click", () =>
    setProField("maxStake", proSettings.maxStake + PRO_MAXSTAKE_STEP),
  );
  r.proMaxInput.addEventListener("input", () => onProFieldInput("maxStake", r.proMaxInput));
  r.proMaxInput.addEventListener("blur", () => onProFieldBlur("maxStake", r.proMaxInput));
  r.proMaxInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  });
  r.proMaxPresets.forEach((b) => b.addEventListener("click", () => onProPresetClick("maxStake", b)));
  r.proStart.addEventListener("click", startProFromModal);
  r.zones.addEventListener("pointerdown", onZoneTap);
  r.infoToggleClassic.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    showTapHintFor("classic");
  });
  r.infoTogglePro.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    showTapHintFor("pro");
  });
  document.addEventListener("pointerdown", (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.closest(".info-toggle") || target.closest(".tap-hint"))) return;
    hideAllTapHints();
  }, true);
  r.btnMute.addEventListener("click", () => setMuted(!ui.muted));
  r.btnHelp.addEventListener("click", () => openOverlay(r.helpModal));
  r.helpClose.addEventListener("click", closeAllOverlays);
  r.helpModal.addEventListener("click", (e) => {
    if (e.target === r.helpModal) closeAllOverlays();
  });
  r.btnHistory.addEventListener("click", () => {
    renderHistorySheet();
    openOverlay(r.historySheet);
  });
  r.historyClose.addEventListener("click", closeAllOverlays);
  r.historySheet.addEventListener("click", (e) => {
    if (e.target === r.historySheet) closeAllOverlays();
  });
  r.btnSkin.addEventListener("click", () => openOverlay(r.skinModal));
  r.skinClose.addEventListener("click", closeAllOverlays);
  r.skinModal.addEventListener("click", (e) => {
    if (e.target === r.skinModal) closeAllOverlays();
  });
  r.skinGrid.addEventListener("click", onSkinGridClick);
  r.recentExpand.addEventListener("click", toggleRecentList);
  r.recentList.addEventListener("click", onRecentListClick);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllOverlays();
  });
}

function onAction(): void {
  const s = engine.getState();
  if (s.status === "running") {
    engine.cashOut();
    return;
  }
  if (autoplay.active) return;
  launchRound();
}

function requestStopAutoplay(): void {
  if (!autoplay.active || autoplay.pendingStop) return;
  autoplay.pendingStop = true;
  renderTabs();
  renderAction(engine.getState());
}

function launchRound(): void {
  if (ui.stake > ui.balance) return;
  if (ui.recentExpanded) toggleRecentList();
  ghost.phase = "idle";
  ui.balance -= ui.stake;
  ui.roundId = generateRoundId();
  clearBanner(refs.zones);
  rocketReset(refs.rocket);
  renderHeader();
  const useAutoTarget = autoplay.active && ui.autoTarget !== null;
  const isProAutoplay = autoplay.active && autoplaySettings.proEnabled;
  const isProManual = !autoplay.active && ui.mode === "pro";
  const isPro = isProManual || isProAutoplay;
  const mode: RoundMode =
    useAutoTarget && isProAutoplay ? "pro-auto" :
    useAutoTarget ? "auto" :
    isPro ? "pro" : "classic";
  engine.launch({
    stake: ui.stake,
    mode,
    autoTarget: useAutoTarget ? (ui.autoTarget as number) : undefined,
    maxStake: isPro ? Math.max(ui.stake, proSettings.maxStake) : undefined,
  });
}

function openAutoplayModal(): void {
  refs.autoplayStakeInput.value = formatStake(ui.stake);
  renderAutoplayRounds();
  refs.autoplayTargetInput.value = autoplaySettings.target.toFixed(2);
  refs.autoplayTargetEnabled.checked = autoplaySettings.targetEnabled;
  refs.autoplayProEnabled.checked = autoplaySettings.proEnabled;
  refs.autoplayProInfoText.innerHTML =
    `<b>Pro:</b> every <b>10 taps</b> adds <b>+0.5×</b> to the multiplier. ` +
    `Each tap commits <b>€${fmtMoney(proSettings.perTap)}</b> to your stake. ` +
    `Stake cap <b>€${fmtMoney(proSettings.maxStake)}</b>.`;
  hideAutoplayInfo();
  applyTargetEnabledUI();
  openOverlay(refs.autoplayModal);
}

function applyTargetEnabledUI(): void {
  const enabled = refs.autoplayTargetEnabled.checked;
  refs.autoplayTargetStepper.classList.toggle("disabled", !enabled);
  refs.autoplayTargetInput.disabled = !enabled;
  refs.autoplayTargetDec.disabled = !enabled;
  refs.autoplayTargetInc.disabled = !enabled;
}

function onTargetEnabledChange(): void {
  applyTargetEnabledUI();
  if (refs.autoplayTargetEnabled.checked) {
    refs.autoplayTargetInput.focus();
    refs.autoplayTargetInput.select();
  }
}

function startAutoplayFromModal(): void {
  const rounds = pickRoundsOption(autoplaySettings.rounds);
  const targetEnabled = refs.autoplayTargetEnabled.checked;
  const proEnabled = refs.autoplayProEnabled.checked;
  const raw = refs.autoplayTargetInput.value.trim();
  const parsed = Number(raw);
  const targetValue =
    isFinite(parsed) && parsed > 1 ? parsed : autoplaySettings.target;
  autoplaySettings.rounds = rounds;
  autoplaySettings.target = targetValue;
  autoplaySettings.targetEnabled = targetEnabled;
  autoplaySettings.proEnabled = proEnabled;
  writeJSON(AUTOPLAY_KEY, autoplaySettings);
  ui.autoTarget = targetEnabled ? targetValue : null;
  refs.autoplayTargetInput.value = targetValue.toFixed(2);
  if (ui.stake > ui.balance) return;
  autoplay.active = true;
  autoplay.pendingStop = false;
  autoplay.total = rounds;
  autoplay.current = 0;
  closeAllOverlays();
  renderTabs();
  renderAction(engine.getState());
  launchRound();
}

function stopAutoplay(): void {
  autoplay.active = false;
  autoplay.pendingStop = false;
  autoplay.current = 0;
  autoplay.total = 0;
  if (autoplay.timer !== null) {
    clearTimeout(autoplay.timer);
    autoplay.timer = null;
  }
  renderTabs();
  renderAction(engine.getState());
}

function onAutoplayRoundEnded(): void {
  if (!autoplay.active) return;
  autoplay.current += 1;
  if (autoplay.pendingStop || autoplay.current >= autoplay.total || ui.stake > ui.balance) {
    stopAutoplay();
    return;
  }
  renderAction(engine.getState());
  autoplay.timer = window.setTimeout(() => {
    autoplay.timer = null;
    if (!autoplay.active) return;
    launchRound();
  }, AUTOPLAY_GAP_MS);
}

function onZoneTap(e: PointerEvent): void {
  hideAllTapHints();
  const s = engine.getState();
  if (s.status !== "running") return;
  let addStake = 0;
  if (isProRound(s.mode)) {
    const room = Math.max(0, s.maxStake - s.stake);
    addStake = Math.min(proSettings.perTap, room, ui.balance);
  }
  engine.tap({ addStake });
  if (addStake > 0) {
    ui.balance -= addStake;
    renderHeader();
    const rect = refs.zones.getBoundingClientRect();
    stakeFloater(refs.zones, addStake, e.clientX - rect.left, e.clientY - rect.top);
  }
  rocketTap(refs.rocket);
  spaceBoost(refs.zones);
}

const INFO_AUTO_HIDE_MS = 4000;
const tapHintTimers = new WeakMap<HTMLElement, number>();
const tapHintShownModes = new Set<RoundMode>();
let tapHintZCounter = 10;

function showTapHintOnce(mode: RoundMode): void {
  if (mode !== "classic" && mode !== "pro") return;
  if (tapHintShownModes.has(mode)) return;
  tapHintShownModes.add(mode);
  showTapHintFor(mode);
}

function tapHintElementFor(mode: "classic" | "pro"): HTMLElement {
  return mode === "pro" ? refs.tapHintPro : refs.tapHintClassic;
}

function tapHintAnchorFor(mode: "classic" | "pro"): HTMLElement {
  return mode === "pro" ? refs.infoTogglePro : refs.infoToggleClassic;
}

function tapHintContentFor(mode: "classic" | "pro"): string {
  if (mode === "pro") {
    return `<b>Pro:</b> every <b>10 taps</b> adds <b>+0.5×</b> to the multiplier. ` +
      `Each tap commits <b>€${fmtMoney(proSettings.perTap)}</b> to your stake. ` +
      `Stake cap <b>€${fmtMoney(proSettings.maxStake)}</b>.`;
  }
  return `<b>Classic:</b> every <b>10 taps</b> adds <b>+0.5×</b> to the multiplier. ` +
    `Cash out before the rocket crashes.`;
}

function positionTapHint(el: HTMLElement, anchor: HTMLElement): void {
  const root = el.offsetParent as HTMLElement | null;
  if (!root) return;
  const rRect = root.getBoundingClientRect();
  const aRect = anchor.getBoundingClientRect();
  const ARROW_INSET = 24;
  const PAD = 8;
  const triggerCenterX = aRect.left + aRect.width / 2 - rRect.left;
  el.style.left = "0px";
  el.style.right = "auto";
  el.style.bottom = `${rRect.bottom - aRect.top + 8}px`;
  const tipWidth = el.getBoundingClientRect().width;
  let left = triggerCenterX - ARROW_INSET;
  const maxLeft = rRect.width - tipWidth - PAD;
  if (left < PAD) left = PAD;
  if (left > maxLeft) left = Math.max(PAD, maxLeft);
  el.style.left = `${left}px`;
  el.style.setProperty("--arrow-x", `${triggerCenterX - left}px`);
}

function showTapHintFor(mode: "classic" | "pro"): void {
  const el = tapHintElementFor(mode);
  const text = el.querySelector(".tap-hint-text");
  if (text) text.innerHTML = tapHintContentFor(mode);
  positionTapHint(el, tapHintAnchorFor(mode));
  tapHintZCounter += 1;
  el.style.zIndex = String(tapHintZCounter);
  el.classList.add("show");
  const prev = tapHintTimers.get(el);
  if (prev !== undefined) clearTimeout(prev);
  const handle = window.setTimeout(() => {
    tapHintTimers.delete(el);
    hideTapHintEl(el);
  }, INFO_AUTO_HIDE_MS);
  tapHintTimers.set(el, handle);
}

function hideTapHintEl(el: HTMLElement): void {
  const prev = tapHintTimers.get(el);
  if (prev !== undefined) {
    clearTimeout(prev);
    tapHintTimers.delete(el);
  }
  el.classList.remove("show");
}

function hideAllTapHints(): void {
  hideTapHintEl(refs.tapHintClassic);
  hideTapHintEl(refs.tapHintPro);
}

let autoplayInfoTimer: number | null = null;
function showAutoplayInfo(): void {
  refs.autoplayProInfoText.hidden = false;
  if (autoplayInfoTimer !== null) clearTimeout(autoplayInfoTimer);
  autoplayInfoTimer = window.setTimeout(() => {
    autoplayInfoTimer = null;
    hideAutoplayInfo();
  }, INFO_AUTO_HIDE_MS);
}
function hideAutoplayInfo(): void {
  if (autoplayInfoTimer !== null) { clearTimeout(autoplayInfoTimer); autoplayInfoTimer = null; }
  refs.autoplayProInfoText.hidden = true;
}
function recordBet(s: RoundState, cashed: boolean): void {
  const endedAt = Date.now();
  const durationMs =
    s.startedAt !== null && s.endedAt !== null ? s.endedAt - s.startedAt : 0;
  const record: BetRecord = {
    id: ui.roundId,
    game: GAME_NAME,
    stake: s.stake,
    startedAt: endedAt - Math.max(0, durationMs),
    endedAt,
    crashPoint: s.crashPoint,
    cashOut: cashed ? s.finalMultiplier : null,
    payout: s.payout,
    stakeBasis: s.stakeBasis,
    proTopUps:
      s.proTopUps.length > 0
        ? s.proTopUps.map((t) => ({ multiplier: t.multiplier, stakeAdded: t.stakeAdded }))
        : undefined,
  };
  ui.history.unshift(record);
  if (ui.history.length > HISTORY_LIMIT) ui.history.length = HISTORY_LIMIT;
  writeJSON(HISTORY_KEY, ui.history);
  renderRecent();
  if (ui.recentExpanded) renderRecentList();
}

function initEngine(): void {
  engine.subscribe((ev) => {
    const s = ev.state;
    if (ev.type === "streak") {
      const theme = multiplierTheme(s.multiplier);
      streakBurst(refs.streakContainer, ev.bonus, theme);
      rocketBoost(refs.rocket);
    }
    if (ev.type === "cashout") {
      hideAllTapHints();
      ui.balance += s.payout;
      showBanner(refs.zones, "win", `+ €${fmtMoney(s.payout)}`);
      recordBet(s, true);
      renderHeader();
      setStake(ui.stake);
      ghost.phase = "frozen";
      rocketFlyAway(refs.rocket);
      onAutoplayRoundEnded();
    }
    if (ev.type === "crash") {
      hideAllTapHints();
      refs.rocketExplosionMult.textContent = fmtMult(s.crashPoint);
      rocketCrash(refs.rocket);
      showBanner(refs.zones, "lose", `Oh no! Rocket crashed.`);
      recordBet(s, false);
      renderHeader();
      setStake(ui.stake);
      onAutoplayRoundEnded();
    }
    if (ghost.phase === "idle") {
      renderAll(s);
    } else {
      renderMult(s);
      renderStreak(s);
      renderHeat(s);
      renderAction(s);
      renderInfoToggle();
      renderStake();
    }
  });
}

bindPersistedDebugCrash(engine);
setMuteIcon(refs.btnMute, ui.muted);
setRocketSkin(ui.rocketSkin);
renderStake();
renderHeader();
renderTabs();
renderRecent();
renderAll(engine.getState());
initEvents(refs);
initEngine();
showTapHintOnce(ui.mode);
setInterval(() => {
  refs.dateTime.textContent = formatDateTime();
}, 1000);
loop();

function loop(): void {
  engine.tick();
  const s = engine.getState();
  if (ghost.phase === "idle") {
    renderAll(s);
  } else {
    renderStreak(s);
    renderHeat(s);
    renderAction(s);
    if (ghost.phase === "animating") tickGhost();
  }
  requestAnimationFrame(loop);
}

function tickGhost(): void {
  const elapsed = performance.now() - ghost.startedAt;
  const t = Math.min(1, elapsed / REVEAL_MS);
  const m = ghost.startMult + (ghost.crashPoint - ghost.startMult) * t;
  if (t >= 1) {
    refs.mult.classList.remove("cashed");
    refs.mult.classList.add("crashed");
    refs.mult.textContent = fmtMult(ghost.crashPoint);
    setRocketY(refs.rocket, ghost.crashPoint);
    refs.rocketExplosionMult.textContent = fmtMult(ghost.crashPoint);
    rocketCrash(refs.rocket);
    ghost.phase = "frozen";
    return;
  }
  refs.mult.classList.remove("crashed");
  refs.mult.classList.add("cashed");
  refs.mult.textContent = fmtMult(m);
  setRocketY(refs.rocket, m);
}

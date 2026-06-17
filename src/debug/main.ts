import { RocketRushEngine, type RoundState } from "../engine";
import {
  bindPersistedDebugCrash,
  persistDebugCrash,
} from "../shared/debugCrash";

const engine = new RocketRushEngine();
const app = document.getElementById("app")!;

app.innerHTML = `
  <h1>🚀 Rocket Rush · Engine Debug</h1>

  <section class="card">
    <h2>Round</h2>
    <div id="mult" class="mult">1.00×</div>
    <div class="kv" id="kv"></div>
    <div style="margin-top:12px"><div class="bar"><span id="streakbar" style="width:0%"></span></div></div>
  </section>

  <section class="row">
    <div class="card">
      <h2>Launch</h2>
      <div class="controls" style="margin-bottom:8px">
        <div class="field"><label>Stake</label><input id="stake" type="number" value="10" min="0.01" step="0.5" /></div>
        <div class="field"><label>Mode</label>
          <select id="mode"><option value="classic">classic</option><option value="auto">auto</option></select>
        </div>
        <div class="field"><label>Auto target ×</label><input id="autoTarget" type="number" value="2" min="1.01" step="0.1" /></div>
      </div>
      <div class="controls">
        <button class="btn primary" id="launch">Launch rocket</button>
        <button class="btn ok" id="cash">Cash out</button>
        <button class="btn danger" id="forceCrash">Force crash</button>
      </div>
    </div>

    <div class="card">
      <h2>Debug crashpoint</h2>
      <div class="controls" style="margin-bottom:8px">
        <div class="field" style="flex:1"><label>Crashpoint (applied next launch)</label>
          <input id="debugCp" type="number" placeholder="e.g. 5" step="0.01" min="1.01" />
        </div>
      </div>
      <div class="controls">
        <button class="btn" id="setCp">Set</button>
        <button class="btn" id="clearCp">Clear (use RNG)</button>
      </div>
      <div class="kv" style="margin-top:12px">
        <span>Active override</span><b id="cpStatus">none</b>
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Tap</h2>
    <div class="controls">
      <button class="btn primary" id="tap" style="font-size:18px;padding:14px 24px">TAP TO FUEL</button>
      <span style="color:var(--muted);font-size:12px;align-self:center">Spacebar also taps.</span>
    </div>
  </section>

  <section class="card">
    <h2>Event log</h2>
    <div id="log" class="log"></div>
  </section>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const elMult = $("mult");
const elKv = $("kv");
const elStreak = $("streakbar");
const elLog = $<HTMLDivElement>("log");
const elCpStatus = $("cpStatus");

function render(s: RoundState) {
  elMult.textContent = `${s.multiplier.toFixed(2)}×`;
  elMult.classList.toggle("crashed", s.status === "crashed");
  elMult.classList.toggle("cashed", s.status === "cashed_out");
  elKv.innerHTML = `
    <span>Status</span><b>${s.status}</b>
    <span>Mode</span><b>${s.mode}</b>
    <span>Stake</span><b>${s.stake.toFixed(2)}</b>
    <span>Crash point</span><b>${s.crashPoint ? s.crashPoint.toFixed(2) + "×" : "—"}</b>
    <span>Final ×</span><b>${s.finalMultiplier ? s.finalMultiplier.toFixed(2) + "×" : "—"}</b>
    <span>Payout</span><b>${s.payout.toFixed(2)}</b>
    <span>Taps</span><b>${s.taps} (streaks ${s.streaksCompleted})</b>
    <span>Heat</span><b><span class="heat ${s.heat}">${s.heat}</span></b>
    <span>Zone</span><b><span class="zone ${s.zone}">${s.zone}</span></b>
    <span>Debug CP</span><b>${s.debugCrashPoint ?? "—"}</b>
  `;
  elStreak.style.width = `${(s.streakProgress / 10) * 100}%`;
  elCpStatus.textContent = engine.getDebugCrashPoint()?.toString() ?? "none";
}

function log(line: string, cls = "") {
  const div = document.createElement("div");
  div.className = `ev ${cls}`;
  div.textContent = `${new Date().toLocaleTimeString()} · ${line}`;
  elLog.prepend(div);
  while (elLog.children.length > 80) elLog.lastElementChild?.remove();
}

engine.subscribe((ev) => {
  if (ev.type === "tick") return; // too chatty
  const s = ev.state;
  if (ev.type === "launch") log(`launch stake=${s.stake} crash=${s.crashPoint}× mode=${s.mode}`);
  if (ev.type === "tap") log(`tap #${s.taps} mult=${s.multiplier.toFixed(2)}×`);
  if (ev.type === "streak") log(`streak ${ev.streak} → +0.5×`, "streak");
  if (ev.type === "heat") log(`heat → ${ev.heat}`, "heat");
  if (ev.type === "cashout") log(`cashout @ ${s.finalMultiplier.toFixed(2)}× payout=${s.payout.toFixed(2)}`, "cashout");
  if (ev.type === "crash") log(`crash @ ${s.crashPoint.toFixed(2)}×`, "crash");
  render(s);
});

$("launch").addEventListener("click", () => {
  try {
    engine.launch({
      stake: parseFloat(($("stake") as HTMLInputElement).value),
      mode: ($("mode") as HTMLSelectElement).value as "classic" | "auto",
      autoTarget: parseFloat(($("autoTarget") as HTMLInputElement).value),
    });
  } catch (e) { log(`error: ${(e as Error).message}`, "crash"); }
});
$("tap").addEventListener("click", () => engine.tap());
$("cash").addEventListener("click", () => engine.cashOut());
$("forceCrash").addEventListener("click", () => engine.forceCrash());
$("setCp").addEventListener("click", () => {
  const v = parseFloat(($("debugCp") as HTMLInputElement).value);
  if (!Number.isFinite(v)) return;
  try {
    engine.setDebugCrashPoint(v);
    persistDebugCrash(v);
    render(engine.getState());
    log(`debug crashpoint set: ${v}`);
  } catch (e) { log(`error: ${(e as Error).message}`, "crash"); }
});
$("clearCp").addEventListener("click", () => {
  engine.setDebugCrashPoint(null);
  persistDebugCrash(null);
  ($("debugCp") as HTMLInputElement).value = "";
  render(engine.getState()); log("debug crashpoint cleared");
});
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); engine.tap(); }
});

function loop() {
  engine.tick();
  render(engine.getState());
  requestAnimationFrame(loop);
}

bindPersistedDebugCrash(engine, (v) => {
  if (v !== null) ($("debugCp") as HTMLInputElement).value = String(v);
});
render(engine.getState());
requestAnimationFrame(loop);

import {
  CHEVRON_SVG,
  CLOSE_SVG,
  HELP_SVG,
  HISTORY_SVG,
  ROCKET_SVG,
  SOUND_OFF_SVG,
  SOUND_ON_SVG,
} from "./icons";
import { ROCKET_SKINS } from "./rockets";

export interface Refs {
  mult: HTMLElement;
  zones: HTMLElement;
  rocket: HTMLElement;
  rocketBody: HTMLElement;
  rocketFlame: HTMLElement;
  rocketExplosion: HTMLElement;
  rocketExplosionMult: HTMLElement;
  tapHintClassic: HTMLElement;
  tapHintPro: HTMLElement;
  heatFill: HTMLElement;
  streakContainer: HTMLElement;
  streakDots: HTMLElement[];
  recent: HTMLElement;
  recentExpand: HTMLButtonElement;
  recentList: HTMLElement;
  dateTime: HTMLElement;
  roundIdLabel: HTMLElement;
  balance: HTMLElement;
  tabClassic: HTMLButtonElement;
  tabPro: HTMLButtonElement;
  tabAuto: HTMLButtonElement;
  tabClassicPill: HTMLElement;
  tabProPill: HTMLElement;
  tabsRow: HTMLElement;
  btnStopAutoplay: HTMLButtonElement;
  infoToggleClassic: HTMLButtonElement;
  infoTogglePro: HTMLButtonElement;
  stakeInput: HTMLInputElement;
  stakeDec: HTMLButtonElement;
  stakeInc: HTMLButtonElement;
  presets: HTMLButtonElement[];
  action: HTMLButtonElement;
  actionMain: HTMLElement;
  actionSub: HTMLElement;
  btnHelp: HTMLButtonElement;
  btnHistory: HTMLButtonElement;
  btnMute: HTMLButtonElement;
  btnSkin: HTMLButtonElement;
  btnLobby: HTMLButtonElement;
  helpModal: HTMLElement;
  helpClose: HTMLButtonElement;
  historySheet: HTMLElement;
  historyClose: HTMLButtonElement;
  historyBody: HTMLElement;
  skinModal: HTMLElement;
  skinClose: HTMLButtonElement;
  skinGrid: HTMLElement;
  autoplayModal: HTMLElement;
  autoplayClose: HTMLButtonElement;
  autoplayRoundsButtons: HTMLButtonElement[];
  autoplayTargetInput: HTMLInputElement;
  autoplayTargetDec: HTMLButtonElement;
  autoplayTargetInc: HTMLButtonElement;
  autoplayTargetEnabled: HTMLInputElement;
  autoplayTargetStepper: HTMLElement;
  autoplayProEnabled: HTMLInputElement;
  autoplayProInfoBtn: HTMLButtonElement;
  autoplayProInfoText: HTMLElement;
  autoplayStakeInput: HTMLInputElement;
  autoplayStakeDec: HTMLButtonElement;
  autoplayStakeInc: HTMLButtonElement;
  autoplayPresets: HTMLButtonElement[];
  autoplayStart: HTMLButtonElement;
}

const PRESET_VALUES = [1, 5, 10, 25];

export function mount(root: HTMLElement): Refs {
  root.innerHTML = `
    <header class="hdr">
      <button class="lobby-btn" data-ref="btnLobby" aria-label="Back to lobby">
        <span class="lobby-chev">‹</span><span class="lobby-text">Lobby</span>
      </button>
      <div class="hdr-icons">
        <button class="icon-btn" data-ref="btnSkin" aria-label="Choose rocket">${ROCKET_SVG}</button>
        <button class="icon-btn mute" data-ref="btnMute" aria-label="Mute">${SOUND_ON_SVG}</button>
        <button class="icon-btn" data-ref="btnHelp" aria-label="How to play">${HELP_SVG}</button>
        <button class="icon-btn" data-ref="btnHistory" aria-label="Bet history">${HISTORY_SVG}</button>
      </div>
    </header>

    <div class="meta">
      <div class="meta-left">
        <div class="dt" data-ref="dateTime">—</div>
        <div class="game-name">ROCKET RUSH</div>
        <div class="rid" data-ref="roundIdLabel">—</div>
      </div>
      <div class="meta-right">
        <div class="bal-label">BALANCE</div>
        <div class="bal-value" data-ref="balance">€100.00</div>
      </div>
    </div>

    <div class="recent-section">
      <div class="recent-wrap">
        <div class="recent" data-ref="recent"></div>
        <button class="recent-expand" data-ref="recentExpand" aria-label="Toggle recent rounds">${CHEVRON_SVG}</button>
      </div>
      <div class="recent-list" data-ref="recentList" hidden></div>
    </div>

    <section class="stage">
      <div class="mult-wrap"><div class="mult" data-ref="mult">1.00×</div></div>
      <div class="zones" data-ref="zones">
        <div class="space-bg" aria-hidden="true">
          <div class="bg-layer bg-launch">
            <div class="earth-horizon"></div>
          </div>
          <div class="bg-layer bg-clouds">
            <img class="cloud cloud-a" src="/game-assets/space/cloud1.png" alt="">
            <img class="cloud cloud-b" src="/game-assets/space/cloud2.png" alt="">
            <img class="cloud cloud-c" src="/game-assets/space/cloud3.png" alt="">
          </div>
          <div class="bg-layer bg-orbit">
            <img class="satellite-ship satellite-main" src="/game-assets/space/satellite-ship.png" alt="">
            <img class="station-sprite" src="/game-assets/space/space-station.png" alt="">
          </div>
          <div class="bg-layer bg-edge">
            <img class="satellite-ship satellite-exit" src="/game-assets/space/satellite-ship.png" alt="">
          </div>
          <div class="bg-layer bg-solar">
            <div class="orbit-ring ring-a"></div>
            <div class="orbit-ring ring-b"></div>
            <div class="planet moon"></div>
            <div class="planet mars"></div>
            <div class="planet jupiter"></div>
            <div class="planet saturn"></div>
          </div>
          <div class="bg-layer bg-asteroid">
            <img class="asteroid-strip" src="/game-assets/space/asteroid-strip.png" alt="">
            <img class="meteor meteor-a" src="/game-assets/space/meteor-1.png" alt="">
            <img class="meteor meteor-b" src="/game-assets/space/meteor-2.png" alt="">
          </div>
          <div class="bg-layer bg-outer">
            <div class="outer-star star-a"></div>
            <div class="outer-star star-b"></div>
            <div class="andromeda"></div>
            <img class="ufo ufo-a" src="/game-assets/space/ufo-green.png" alt="">
            <img class="ufo ufo-b" src="/game-assets/space/ufo-blue.png" alt="">
          </div>
        </div>
        <div class="heat-bar"><span data-ref="heatFill"></span></div>
        <div class="streak" data-ref="streakDots">
          ${Array.from({ length: 10 }, () => `<div class="dot"></div>`).join("")}
        </div>
        <div class="rocket" data-ref="rocket">
          <div class="rocket-explosion" data-ref="rocketExplosion">
            <div class="rocket-explosion-flash"></div>
            <div class="rocket-explosion-cloud"></div>
          </div>
          <div class="rocket-flame" data-ref="rocketFlame"></div>
          <div class="rocket-body" data-ref="rocketBody"></div>
        </div>
        <div class="crash-mult" data-ref="rocketExplosionMult"></div>
      </div>
    </section>

    <div class="tap-hint" data-ref="tapHintClassic">
      <span class="tap-hint-text"></span>
    </div>
    <div class="tap-hint" data-ref="tapHintPro">
      <span class="tap-hint-text"></span>
    </div>

    <div class="tabs" data-ref="tabsRow">
      <div class="tab-pill active" data-ref="tabClassicPill">
        <button data-ref="tabClassic">Classic</button>
        <button class="info-toggle" data-ref="infoToggleClassic" aria-label="Classic mode info">i</button>
      </div>
      <div class="tab-pill" data-ref="tabProPill">
        <button data-ref="tabPro">Pro</button>
        <button class="info-toggle" data-ref="infoTogglePro" aria-label="Pro mode info">i</button>
      </div>
      <button data-ref="tabAuto">Autoplay</button>
    </div>
    <button class="stop-autoplay" data-ref="btnStopAutoplay" hidden>Stop autoplay</button>

    <div class="bet">
      <div class="row">
        <button class="step" data-ref="stakeDec" aria-label="decrease stake">−</button>
        <div class="stake-input">
          <span class="prefix">€</span>
          <input data-ref="stakeInput" type="text" inputmode="decimal" value="1" size="1" aria-label="Stake amount" />
        </div>
        <button class="step" data-ref="stakeInc" aria-label="increase stake">+</button>
      </div>
      <div class="presets">
        ${PRESET_VALUES.map(
          (v) => `<button data-preset="${v}">€${v.toFixed(2)}</button>`,
        ).join("")}
        <button data-preset="max">MAX</button>
      </div>
    </div>

    <button class="action launch" data-ref="action">
      <span class="action-main" data-ref="actionMain">Launch</span>
      <span class="action-sub" data-ref="actionSub"></span>
    </button>

    <div class="modal-backdrop" data-ref="helpModal" hidden>
      <div class="modal" role="dialog" aria-labelledby="help-title">
        <header>
          <h2 id="help-title">How to play</h2>
          <button class="icon-btn close" data-ref="helpClose" aria-label="Close">${CLOSE_SVG}</button>
        </header>
        <div class="body">
          <ol>
            <li>Choose your stake with the <b>+ / −</b> buttons or a quick preset.</li>
            <li>Tap <b>Launch</b> to start a single round, or open <b>Autoplay</b> to chain rounds.</li>
            <li>The multiplier climbs while the rocket flies — tap the stage to fuel it (every <b>10 taps</b> adds <b>+0.5×</b> to the multiplier).</li>
            <li>Tap <b>Cash Out</b> before the rocket flies away. Payout = stake × current multiplier.</li>
            <li>In Autoplay, switch on <b>Auto cash out</b> to cash out automatically at a target multiplier, or leave it off to cash out manually each round. You can always cash out early by tapping the button.</li>
            <li>Tap <b>Stop autoplay</b> to end the chain after the current round.</li>
            <li>If the rocket flies away first, you lose your stake.</li>
          </ol>
          <p class="rtp-note">Target RTP: 97%. Minimum crash multiplier: 1.00×.</p>
        </div>
      </div>
    </div>

    <div class="modal-backdrop" data-ref="autoplayModal" hidden>
      <div class="modal" role="dialog" aria-labelledby="autoplay-title">
        <header>
          <h2 id="autoplay-title">AUTOPLAY</h2>
          <button class="icon-btn close" data-ref="autoplayClose" aria-label="Close">${CLOSE_SVG}</button>
        </header>
        <div class="ap-info-text" data-ref="autoplayProInfoText" hidden></div>
        <div class="body">
          <div class="ap-field">
            <div class="ap-toggle-row">
              <span class="ap-label">Pro mode<button type="button" class="ap-info-btn" data-ref="autoplayProInfoBtn" aria-label="What is Pro mode?">i</button></span>
              <label class="ap-switch">
                <input type="checkbox" data-ref="autoplayProEnabled" />
                <span class="ap-switch-slider" aria-hidden="true"></span>
              </label>
            </div>
          </div>
          <div class="ap-field">
            <span class="ap-label">Stake</span>
            <div class="ap-stepper">
              <button type="button" class="ap-step" data-ref="autoplayStakeDec" aria-label="decrease stake">−</button>
              <div class="ap-input-prefix">
                <span>€</span>
                <input data-ref="autoplayStakeInput" type="text" inputmode="decimal" value="1" size="1" aria-label="Autoplay stake" />
              </div>
              <button type="button" class="ap-step" data-ref="autoplayStakeInc" aria-label="increase stake">+</button>
            </div>
            <div class="ap-presets">
              ${PRESET_VALUES.map(
                (v) => `<button type="button" data-preset="${v}">€${v.toFixed(2)}</button>`,
              ).join("")}
              <button type="button" data-preset="max">MAX</button>
            </div>
          </div>
          <div class="ap-field">
            <span class="ap-label">Number of rounds</span>
            <div class="ap-presets ap-rounds">
              ${[5, 10, 25, 50, 100]
                .map((v) => `<button type="button" data-rounds="${v}">${v}</button>`)
                .join("")}
            </div>
          </div>
          <div class="ap-field">
            <div class="ap-toggle-row">
              <span class="ap-label">Auto cash out</span>
              <label class="ap-switch">
                <input type="checkbox" data-ref="autoplayTargetEnabled" />
                <span class="ap-switch-slider" aria-hidden="true"></span>
              </label>
            </div>
            <div class="ap-stepper" data-ref="autoplayTargetStepper">
              <button type="button" class="ap-step" data-ref="autoplayTargetDec" aria-label="decrease target">−</button>
              <div class="ap-input-suffix">
                <input data-ref="autoplayTargetInput" type="text" inputmode="decimal" placeholder="2.00" size="1" aria-label="Cash out multiplier" />
                <span>×</span>
              </div>
              <button type="button" class="ap-step" data-ref="autoplayTargetInc" aria-label="increase target">+</button>
            </div>
          </div>
          <button class="action launch ap-start" data-ref="autoplayStart">Start autoplay</button>
        </div>
      </div>
    </div>

    <div class="sheet-backdrop" data-ref="historySheet" hidden>
      <aside class="sheet" role="dialog" aria-labelledby="hist-title">
        <header>
          <span class="sheet-icon">${HISTORY_SVG}</span>
          <h2 id="hist-title">Bet history</h2>
          <button class="icon-btn close" data-ref="historyClose" aria-label="Close">${CLOSE_SVG}</button>
        </header>
        <div class="body" data-ref="historyBody"></div>
      </aside>
    </div>

    <div class="modal-backdrop" data-ref="skinModal" hidden>
      <div class="modal" role="dialog" aria-labelledby="skin-title">
        <header>
          <h2 id="skin-title">Choose rocket</h2>
          <button class="icon-btn close" data-ref="skinClose" aria-label="Close">${CLOSE_SVG}</button>
        </header>
        <div class="body">
          <div class="skin-grid" data-ref="skinGrid">
            ${ROCKET_SKINS.map(
              (s) => `<button type="button" class="skin-card" data-skin="${s.id}">
                <div class="skin-preview">${s.svg}</div>
                <div class="skin-name">${s.name}</div>
              </button>`,
            ).join("")}
          </div>
        </div>
      </div>
    </div>
  `;

  const q = <T extends HTMLElement>(name: string) =>
    root.querySelector<T>(`[data-ref="${name}"]`)!;

  return {
    mult: q("mult"),
    zones: q("zones"),
    rocket: q("rocket"),
    rocketBody: q("rocketBody"),
    rocketFlame: q("rocketFlame"),
    rocketExplosion: q("rocketExplosion"),
    rocketExplosionMult: q("rocketExplosionMult"),
    tapHintClassic: q("tapHintClassic"),
    tapHintPro: q("tapHintPro"),
    heatFill: q("heatFill"),
    streakContainer: q("streakDots"),
    streakDots: Array.from(q("streakDots").children) as HTMLElement[],
    recent: q("recent"),
    recentExpand: q<HTMLButtonElement>("recentExpand"),
    recentList: q("recentList"),
    dateTime: q("dateTime"),
    roundIdLabel: q("roundIdLabel"),
    balance: q("balance"),
    tabClassic: q<HTMLButtonElement>("tabClassic"),
    tabPro: q<HTMLButtonElement>("tabPro"),
    tabAuto: q<HTMLButtonElement>("tabAuto"),
    tabClassicPill: q("tabClassicPill"),
    tabProPill: q("tabProPill"),
    tabsRow: q("tabsRow"),
    btnStopAutoplay: q<HTMLButtonElement>("btnStopAutoplay"),
    infoToggleClassic: q<HTMLButtonElement>("infoToggleClassic"),
    infoTogglePro: q<HTMLButtonElement>("infoTogglePro"),
    stakeInput: q<HTMLInputElement>("stakeInput"),
    stakeDec: q<HTMLButtonElement>("stakeDec"),
    stakeInc: q<HTMLButtonElement>("stakeInc"),
    presets: Array.from(root.querySelectorAll<HTMLButtonElement>(".bet .presets [data-preset]")),
    action: q<HTMLButtonElement>("action"),
    actionMain: q("actionMain"),
    actionSub: q("actionSub"),
    btnHelp: q<HTMLButtonElement>("btnHelp"),
    btnHistory: q<HTMLButtonElement>("btnHistory"),
    btnMute: q<HTMLButtonElement>("btnMute"),
    btnSkin: q<HTMLButtonElement>("btnSkin"),
    btnLobby: q<HTMLButtonElement>("btnLobby"),
    helpModal: q("helpModal"),
    helpClose: q<HTMLButtonElement>("helpClose"),
    historySheet: q("historySheet"),
    historyClose: q<HTMLButtonElement>("historyClose"),
    historyBody: q("historyBody"),
    skinModal: q("skinModal"),
    skinClose: q<HTMLButtonElement>("skinClose"),
    skinGrid: q("skinGrid"),
    autoplayModal: q("autoplayModal"),
    autoplayClose: q<HTMLButtonElement>("autoplayClose"),
    autoplayRoundsButtons: Array.from(root.querySelectorAll<HTMLButtonElement>(".ap-rounds [data-rounds]")),
    autoplayTargetInput: q<HTMLInputElement>("autoplayTargetInput"),
    autoplayTargetDec: q<HTMLButtonElement>("autoplayTargetDec"),
    autoplayTargetInc: q<HTMLButtonElement>("autoplayTargetInc"),
    autoplayTargetEnabled: q<HTMLInputElement>("autoplayTargetEnabled"),
    autoplayTargetStepper: q<HTMLElement>("autoplayTargetStepper"),
    autoplayProEnabled: q<HTMLInputElement>("autoplayProEnabled"),
    autoplayProInfoBtn: q<HTMLButtonElement>("autoplayProInfoBtn"),
    autoplayProInfoText: q<HTMLElement>("autoplayProInfoText"),
    autoplayStakeInput: q<HTMLInputElement>("autoplayStakeInput"),
    autoplayStakeDec: q<HTMLButtonElement>("autoplayStakeDec"),
    autoplayStakeInc: q<HTMLButtonElement>("autoplayStakeInc"),
    autoplayPresets: Array.from(root.querySelectorAll<HTMLButtonElement>(".ap-presets [data-preset]")),
    autoplayStart: q<HTMLButtonElement>("autoplayStart"),
  };
}

export function setMuteIcon(btn: HTMLElement, muted: boolean): void {
  btn.innerHTML = muted ? SOUND_OFF_SVG : SOUND_ON_SVG;
}

export const PRESETS = PRESET_VALUES;

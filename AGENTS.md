# AI Agent Guide for Rocket Rush

Use this file as the first-stop context for future AI work in this repo.

## Project Summary

Rocket Rush is a TypeScript/Vite browser game with a pure game engine and DOM-based UI.

- App entry: `index.html` -> `src/game/main.ts`
- Debug entry: `debug.html` -> `src/debug/main.ts`
- Build output: `dist/` (generated; do not edit by hand)
- Static assets: `public/`
- Tests: `test/**/*.test.ts` using Vitest

## Important Commands

```bash
npm run dev          # local Vite server
npm run dev:lan      # LAN-accessible Vite server
npm run typecheck    # TypeScript check only
npm test             # Vitest test suite
npm run build        # TypeScript check + Vite production build
```

## Code Map

- `src/engine/`
  - Pure game rules and state transitions.
  - Keep this browser-independent where possible.
  - Public exports are collected in `src/engine/index.ts`.
- `src/game/main.ts`
  - Main UI state, event wiring, round flow, autoplay, history, rendering coordination.
- `src/game/view.ts`
  - DOM template and typed element refs returned by `mount()`.
- `src/game/styles.css`
  - Visual layout, responsive UI, animations, modals.
- `src/game/fx.ts`
  - Visual effects and rocket animation helpers.
- `src/game/rockets.ts`
  - Rocket skin data/SVGs.
- `src/game/util.ts`
  - Formatting, localStorage JSON helpers, round ID helpers.
- `src/shared/debugCrash.ts`
  - Debug crash-point persistence/binding used by app and debug page.

## Development Guidelines

- Prefer small, focused changes.
- Do not edit `dist/`, `node_modules/`, or generated files.
- Preserve the pure engine/UI separation:
  - Engine logic belongs in `src/engine/`.
  - DOM rendering and browser storage belong in `src/game/` or `src/shared/`.
- For game-rule changes, update or add Vitest coverage in `test/`.
- For UI changes, check `src/game/view.ts`, `src/game/main.ts`, and `src/game/styles.css` together.
- After code edits, run the smallest relevant check first, then broader checks if needed:
  1. `npm test`
  2. `npm run typecheck`
  3. `npm run build`

## Common Change Targets

- Change crash odds/RTP/crash math: `src/engine/crash.ts`, `src/engine/engine.ts`, tests.
- Change round lifecycle/cashout/taps/autoplay engine behavior: `src/engine/engine.ts`, `src/engine/types.ts`, tests.
- Change visible gameplay UI: `src/game/main.ts`, `src/game/view.ts`, `src/game/styles.css`.
- Change rocket appearance/skins/effects: `src/game/rockets.ts`, `src/game/fx.ts`, `src/game/styles.css`.
- Change persisted history/settings: constants and helpers in `src/game/main.ts` and `src/game/util.ts`.

## Future AI Workflow

When responding to a future task:

1. Read this guide and the relevant files before editing.
2. Confirm existing function/type names before using them.
3. Make minimal changes with clear reasoning.
4. Add/update tests when behavior changes.
5. Run relevant validation commands and report exact results.
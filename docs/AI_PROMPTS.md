# Future AI Prompt Templates

Copy one of these prompts when asking an AI agent to work on this repo. Replace bracketed text with specifics.

## Quick Bug Fix

```text
Please fix this bug in the Rocket Rush repo:

Bug: [describe what happens]
Expected: [describe expected behavior]
Where noticed: [page/file/browser/test if known]

Please inspect the relevant files, make the smallest safe fix, add/update tests if behavior changes, and run the relevant validation command(s).
```

## Engine/Game Rule Change

```text
Please change the Rocket Rush engine behavior:

Rule change: [describe the rule]
Edge cases: [list important cases]
Compatibility: [state whether existing saved history/settings must keep working]

Start with `src/engine/`, update tests in `test/`, and avoid putting browser/UI code into the engine.
Run `npm test` and `npm run typecheck` when done.
```

## UI/UX Change

```text
Please update the Rocket Rush UI:

Change: [describe UI/UX change]
Screens/areas: [main game, modal, history, rocket, controls, etc.]
Responsive needs: [mobile/desktop expectations]

Relevant files are likely `src/game/main.ts`, `src/game/view.ts`, and `src/game/styles.css`.
Do not edit `dist/`; use source files only.
```

## Add a Feature

```text
Please add this feature to Rocket Rush:

Feature: [short name]
User flow: [step-by-step behavior]
Persistence: [localStorage/session/no persistence]
Tests: [what should be covered]

Please propose a short plan, implement it, update or add tests, and run the smallest relevant validation commands.
```

## Refactor Safely

```text
Please refactor [area/file/function] without changing behavior.

Goal: [readability, split large function, remove duplication, improve naming, etc.]
Constraints: [public API must remain, no UI changes, no storage migration, etc.]

Please run existing tests before/after if useful, keep changes minimal, and summarize how behavior was preserved.
```

## Test/Validation Request

```text
Please validate the current Rocket Rush repo state.

Run the relevant checks, starting with:
- `npm test`
- `npm run typecheck`
- `npm run build`

If anything fails, diagnose the failure and suggest or apply the smallest safe fix.
```

## Useful Context to Include in Prompts

- Exact error text or screenshot description.
- Browser/device if UI-related.
- Steps to reproduce.
- Whether saved localStorage data must remain compatible.
- Whether the change is for the main game, debug page, or both.
- Whether the AI should stop after planning or proceed with edits.
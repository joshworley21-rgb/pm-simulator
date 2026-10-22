# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

PM Simulator is a text-heavy British political-simulation game rebuilt from scratch in React Native / Expo. The player is the Prime Minister. A weekly-tick engine drives public approval, party confidence, MP loyalty, a fiscal model, pledge tracking, and narrative events. The original decompiled APK (v2.6.0, package `io.innovateapps.pmsim`) is the design reference — there is no source code from it, only extracted strings and mechanics documented in `docs/`.

## Tech stack

- React Native (Expo SDK 54+, Hermes engine, New Architecture)
- TypeScript
- State: React Context + useReducer, or Zustand (TBD — pick one and stay consistent)
- No server — the full simulation runs client-side
- RevenueCat for IAP (freemium unlocks: Full Game, Insights, Random Events)
- Sentry for crash reporting (optional for MVP)

## Key architectural pattern

The game engine is a **pure-function reducer** that takes `(GameState, Action) → GameState`. The UI is a separate layer that dispatches actions and reads state. Keep the engine fully deterministic (no `Math.random()` inside the reducer — seed randomness via the action payload so replays/saves work).

## Reference material

- `docs/original-game-mechanics.md` — everything extracted from the decompiled APK about how the original sim works
- `docs/design-features.md` — design doc for new features added in the rebuild
- `docs/template-variables.md` — the ~52 template variables used in event/dialogue strings

## Build & run

```bash
npx expo start        # dev server
npx expo start --ios  # iOS simulator
npx expo start --android  # Android emulator / device
```

Tests (framework TBD):
```bash
npx jest              # run all tests
npx jest --watch      # watch mode
```

## Game state schema (core entities)

- `Player` — PM stats (Intellect, Charisma, Integrity, Resilience, Authority), term count, days in office
- `Parliament` — 650 seats, MP buckets (loyal/wavering/hostile), 1922 letters, confidence vote state
- `Approval` — overall % + per-demographic-group %s (working class, middle class, business, pensioners, rural, ethnic minority, under-35, public sector)
- `Economy` — per-department budgets, GDP growth, CPI inflation, gilt yields, deficit, debt/GDP, OBR forecast
- `Pledges` — promised vs delivered tracking with target band and unit
- `Events` — active event queue, decision history
- `Relationships` — foreign leader disposition, cabinet cohesion, backbench sentiment

## Simulation tick order (weekly)

1. Apply passive approval decay
2. Compute MP drift (approval thresholds + sleaze + pledge delivery)
3. Check 1922 Committee thresholds → trigger confidence vote if crossed
4. Advance ongoing projects
5. Process event queue → dispatch consequences
6. Recalculate vote-share forecast
7. If election week: resolve election
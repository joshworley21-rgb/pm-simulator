# The Red Box

A UK government simulator. You are the Prime Minister: work the dispatch box, the
Treasury, your party and the country, then face the electorate on a 650-seat map.

Built with Expo / React Native (TypeScript), with a deterministic simulation
engine in `src/app/` and a bare Android project in `android/`.

## Running it

```bash
npm install
npm start          # Expo dev server
npm run android    # build + install on an Android device/emulator
npm run web        # browser build
```

## Testing

```bash
npm run typecheck  # TypeScript
npm test           # typecheck + engine suites + every slice harness
npm run test:ui    # boots the web build and drives the first-run flow (needs Playwright)
npm run test:fuzzers
```

- `test:engine` compiles and runs the three core engine suites.
- `test:slices` discovers every `scripts/*-test.ts` harness and runs it.
- `test:ui` writes screenshots to `artifacts/ui-smoke/`.
- The integration fuzzer includes a **Reformer** control that plays competently and
  asserts it survives at least as well as doing nothing (the **Idle** floor).

## UI architecture

- `src/app/theme.ts` — the whole palette, type scale, spacing and radii. Change
  colour here, not in screens.
- `src/app/components/ui.tsx` — shared primitives: `Card`, `Button`, `Chip`,
  `SectionTitle`, `Sheet`, `Meter`, `StatTile`, `Segmented`; meters ease to new
  values and changed stat figures pulse once.
- `src/app/screens/GameScreen.tsx` — the Record / Papers / Divisions / Office
  index, running folio, office index, dossier/PMQ/budget sheets and game-over modal.
- `src/app/screens/RedBoxScreen.tsx` — the chronological Official Record, approval
  ledger and notices requiring a decision.
- `src/app/components/game/` — tab surfaces (`MoneyTab`, `WorldTab`, `NationTab`).
- `src/app/components/election/` — `ElectionNightModal` + `Swingometer`.
- `src/app/components/press/NewsTicker.tsx` — press coverage in the record's
  restrained wire format.
- Lucide React Native supplies the section-index and action icons. New notices
  ease into the record; the leading press line crossfades when it changes.

## App identity and icons

Identity lives in `app.json`:

- `slug` — `the-red-box`
- `android.package` / `ios.bundleIdentifier` — `com.joshworley21.theredbox`
- `android.versionCode` — bump before every Play Store upload; `version` is the
  user-facing version.

The **package name is permanent** once an app is published. Do not change it.

Icons are generated from the artboards in `scripts/icons/index.html`:

```bash
npx playwright install chromium   # once
npm run icons
```

That writes `assets/icon.png`, the splash art, the favicon, and every Android
launcher/adaptive/monochrome size (replacing the old `.webp` mipmaps). The
artwork is the red despatch box with brass hardware on parliamentary green
(`#1B5E3F`).

## Deep mechanics

Most of the simulation is player-facing:

- **Nation** tab — the Union and Sewel consent, council stress / s114 bailouts,
  the asylum backlog and removals, lobbying and select committees, and the
  Bank of England (lean on it, appoint hawks/doves).
- **Red Box** — investigations can be admitted or covered up; cover-ups defer
  the damage and may be exposed.
- **Commons** — the Parliament Act can force one bill past the Lords per term;
  lost by-elections can be answered with a visit or a ministerial defence.
- **World** — trade deals can be negotiated, concluded, suspended or withdrawn.

## Release checklist

1. Bump `version` / `android.versionCode` in `app.json`.
2. `npm run typecheck && npm test && npm run test:ui && npm run test:fuzzers`.
3. Re-run `npm run icons` if the brand artwork changed.
4. Build the Android app (`npm run android`) and install on a device to confirm
   the launcher icon, splash and status-bar contrast.
5. Tag the release.

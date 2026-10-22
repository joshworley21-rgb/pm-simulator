=== PM SIMULATOR - OVERFLOW STRING ANALYSIS ===
File analyzed: /workspace/pm-sim/apk_decompile/hermes_strings.txt.overflow
Date: 2026-10-20

======================================================================
SUMMARY
======================================================================

FILE STATISTICS:
  - Total entries: 4,954 lines (5,110 file lines, some blank/wrapping)
  - File size: ~1.6 MB
  - Strings > 500 chars: 225
  - Strings > 1,000 chars: 73
  - Strings > 5,000 chars: 5
  - Template variables found: 52 unique (like {APPROVAL}, {GDP_GROWTH}, etc.)

======================================================================
GAME IDENTITY: "PM Simulator" - British Prime Minister text-based RPG
======================================================================

This is a React Native app (Expo + Hermes JS engine) that is a
political simulation game. The player is the British Prime Minister,
facing choices, crises, PMQs, and managing policy trade-offs.

CONTENT BREAKDOWN:
  - 84.1% Game dialogue / scenario text (4,166 lines)
  - 7.2%  JavaScript source code fragments (357 lines)
  - 5.7%  CSS/styling fragments (280 lines)
  - 2.0%  Dialogue with quotes (101 lines)
  - 0.9%  JSON-like template text (43 lines)
  - 0.1%  HTML markup (7 lines)

======================================================================
1. JSON-LIKE CONTENT
======================================================================
  - 23 strings start with { or [ (all with null-byte Unicode spacing
    in some cases, indicating obfuscated or specially encoded strings)
  - NONE are parseable as pure JSON -- they are game dialogue templates
    containing variables like {APPROVAL}, {BILLS_PASSED_THIS_TERM}, etc.
  - These are string interpolation templates, not data/config JSON.
  - 45 false positive "parse errors" were lines starting with [NNNNN] refs.

======================================================================
2. GAME DATA TABLES / MECHANICS
======================================================================
  - NO CSV or tabular data found in the overflow strings.
  - 52 unique template variables identified -- these ARE the game state:
    * Player state: {APPROVAL}, {PARTY_VOTE_SHARE}, {LEAD_OVER_OPPOSITION}
    * Economy: {GDP_GROWTH}, {UNEMPLOYMENT}, {INFATION}, {DEBT_GDP}
    * Health: {NHS_STAT}, {HOMELESSNESS}, {TEACHER_VACANCIES}
    * Military: {ARMY_STRENGTH}, {NC_THREAT} (nuclear/conventional threat)
    * Legislative: {BILLS_PASSED_THIS_TERM}, {BILL_TITLE}
    * Relations: {LEADER_NAME}, {LEADER_COUNTRY}, {LEADER_TITLE}
    * Election: {WEEKS_TO_ELECTION}, {PROMISED_VALUE}, {DELIVERED_VALUE}
    * Misc: {PROJECT_NAME}, {CO2_CUT}, {NET_MIGRATION}, {SCANDAL_COUNT},
      {HOSTILE_PCT}, {MAYOR}, {REGION}, {PARTY_NOTE}, {ASK}

  - POLICY AREAS (by keyword frequency):
    tax(70), NHS(66), trade(60), defence(59), housing(47), pension(46),
    climate(41), energy(39), immigration, education, crime, transport

  - GAME MECHANICS (by keyword frequency):
    turn(348), round(131), vote(102), decision(94), election(70),
    campaign(56), poll(54), choice(37), score, points, outcome,
    consequence, rating, popularity

  - NATIONS/REGIONS referenced:
    EU(117), London(58), England(56), USA(53), Europe(33), Wales(19),
    Russia(18), Scotland(16), China, France, Germany, Japan

  - The game appears to involve:
    * Turn-based PM decision-making
    * Parliamentary votes (PMQs style debates)
    * Foreign leader calls (dialogues with world leaders)
    * Policy trade-offs across multiple domains
    * Election cycles and polling
    * Crisis events (cyber attacks, energy crises, etc.)
    * Budget management (GDP, debt, tax levels)

======================================================================
3. SOURCE CODE FRAGMENTS
======================================================================
  Technology stack identified:
    - React Native (Expo managed workflow)
    - Hermes JavaScript engine (confirmed by hermes_strings.txt)
    - react-native-reanimated (extensive animation worklet code)
    - @gorhom/bottom-sheet (bottom sheet UI component)
    - react-native-gesture-handler
    - RevenueCat (react-native-purchases) for IAP
    - Svelte components (RCB = RevenueCat Billing UI components)
    - expo-file-system

  Key source patterns found:
    - function: 323 matches (worklet functions, animation helpers)
    - react: 286 matches (React Native internals, warnings)
    - require: 47 matches (deprecation warnings, module loading)
    - export: 26 matches (mostly "export" in dialogue context)
    - component: 19 matches (React component references)
    - import: 14 matches (deprecation notices, dialogue)
    - => arrow functions: 1 match (in deflate algorithm code)
    - useState / useEffect: 0 matches (likely in main bundle, not overflow)

  The largest strings are:
    1. base64 PNG data-URI (12,434 chars) - in-game image asset
    2. Deflate/inflate implementation (10,329 chars) - compression lib
    3. Reanimated Spring animation (7,986 chars)
    4. Reanimated layout manager (7,240 chars)
    5. Various animation helpers (3,000-5,000 chars each)

======================================================================
4. REVENUECAT PRODUCTS / ENTITLEMENTS
======================================================================
  - "io.innovateaps": 0 matches (bundle ID not found in overflow)
  - "revenuecat": 1 match - an error message line:
    "[RevenueCat] Native module (RNPurchases) not found."
  - "entitlement": 6 matches (all game dialogue, not RevenueCat config)
  - "offering": 9 matches (all diplomatic/negotiation dialogue)
  - "product": 37 matches (mostly economic/productivity dialogue,
    plus RevenueCat CSS classes: .rcb-product-title, .rcb-product-description)
  - "purchase": 4 matches (land purchase, simulated store, gas)
  - "subscription": 0 matches

  RevenueCat UI components are present (Svelte-based):
    - .rc-checkout-container, .rc-checkout-form
    - .rc-simulated-store-modal (Test Store Purchase UI)
    - .rcb-pricing-info-header, .rcb-product-title
    - .rcb-subscribe-to

  The actual product IDs / entitlement mappings are NOT in the overflow
  strings -- they are likely in the main Hermes bytecode bundle.

======================================================================
5. ACHIEVEMENTS / BADGES / STATS
======================================================================
  - achievement: 1 match (BAFTA award scenario text)
  - badge: 0 matches
  - stat: 324 matches (mostly "statement", "state", "status" in dialogue,
    plus the game template variable {NHS_STAT})
  - unlock: 8 matches (legislative/planning context)
  - milestone: 13 matches (policy milestones, project checkpoints)

  The game DOES appear to have a stats/state system based on the
  template variables, but no formal achievement/badge system was found
  in the overflow strings. Stats tracking seems tied to:
    - Approval rating ({APPROVAL})
    - Vote share ({PARTY_VOTE_SHARE})
    - Bills passed ({BILLS_PASSED_THIS_TERM})
    - GDP growth ({GDP_GROWTH})
    - Various delivered-vs-promised metrics ({DELIVERED_VALUE} vs {PROMISED_VALUE})

======================================================================
6. CSS / STYLING
======================================================================
  - 108 CSS blocks extracted
  - RevenueCat UI classes: svelte-zfhfge (checkout), svelte-17914yi (modal store)
  - Game UI classes: carousel, sheet, backdrop, video-outer, video-media
  - Paywall styles (.paywall h6 {text-wrap:balance;})
  - Appears to use a mix of React Native styles and Svelte-scoped CSS

======================================================================
FILES WRITTEN:
======================================================================
All output files are in /workspace/pm-sim/apk_decompile/analysis/

  00_content_categories.txt    - Content categorization breakdown
  01_overflow_stats.txt        - Size stats, JSON parse attempts
  02_data_tables.txt           - Data table / game balance keyword search
  03_source_fragments.txt      - Source code fragment search
  04_revenuecat.txt            - RevenueCat / IAP keyword search
  05_achievements.txt          - Achievement / stat system search
  06_large_strings_detail.txt  - Top 50 largest strings with type info
  07_json_deep_dive.txt        - All 23 JSON-looking strings examined
  08_template_variables.txt    - 52 game template variables extracted
  09_css_extracts.txt          - CSS blocks extracted with class names
  10_game_mechanics.txt        - Game mechanics keyword frequencies
  11_structured_data.txt       - Structured/tabular data candidates
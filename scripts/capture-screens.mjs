// Mobile UI capture harness — ACTIVE walkthrough.
//
// Unlike a passive screenshotter, this drives real interactions and asserts that
// state actually changed, so it fails (non-zero exit) if any UI-to-engine action
// breaks or throws.
//
// Usage:
//   node scripts/capture-screens.mjs
//   BASE_URL=http://localhost:8081 node scripts/capture-screens.mjs
//
// Selector notes (why these work):
//   * Bottom tab bar sets accessibilityLabel -> aria-label -> getByRole('tab', {name}).
//   * Politics sub-tabs are the ui.tsx Segmented control, also role="tab".
//     The Division Lobby sub-tab is labelled "Commons" in the UI (key 'westminster').
//   * React Native Web maps testID -> data-testid, and accessibilityLabel -> aria-label.
//   * CreateScreen needs first AND last name before "Enter Number 10" enables.

import { chromium, devices } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
const OUT_DIR = path.resolve('artifacts/ui-captures');
const DEVICE = devices['Pixel 7'];
const MIN_HIT = 44; // px minimum touch target

const failures = [];
const checks = [];
const pageErrors = [];
// Module-scoped so the crash path can always close it; otherwise a leaked
// browser keeps the event loop alive and the process hangs instead of exiting.
let browser = null;

function pass(what, detail = '') {
  checks.push({ what, detail, ok: true });
  console.log(`   ✓ ${what}${detail ? ` — ${detail}` : ''}`);
}
function fail(what, detail = '') {
  checks.push({ what, detail, ok: false });
  failures.push(`${what}${detail ? ` — ${detail}` : ''}`);
  console.error(`   ✗ ${what}${detail ? ` — ${detail}` : ''}`);
}

/** Wait for text to appear; throws on timeout. */
async function waitForText(page, text, timeout = 15_000) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout });
}

/** Read a StatTile's rendered text by its label (RNW nests value+label+hint in a View). */
async function readStatTile(page, label) {
  return page.evaluate((lbl) => {
    const nodes = Array.from(document.querySelectorAll('div'));
    const labelEl = nodes.find(
      (n) => n.children.length === 0 && n.textContent && n.textContent.trim() === lbl,
    );
    return labelEl?.parentElement?.textContent ?? null;
  }, label);
}

function firstNumber(text) {
  const m = (text ?? '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

/** Click helper that tries testID first, then falls back to a text matcher. */
async function clickBy(page, testId, textRegex) {
  const byId = page.locator(`[data-testid="${testId}"]`);
  if ((await byId.count()) > 0) {
    await byId.first().click();
    return `testid:${testId}`;
  }
  const byText = page.getByText(textRegex).first();
  await byText.click();
  return `text:${textRegex}`;
}

async function closeSheet(page) {
  const close = page.getByLabel('Close').first();
  if ((await close.count()) > 0) {
    await close.click();
    await page.waitForTimeout(400);
  }
}

async function snap(page, file) {
  await page.screenshot({ path: path.join(OUT_DIR, file) });
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ ...DEVICE });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  // Any unhandled page exception is a hard failure.
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
    console.error(`   !! pageerror: ${err.message}`);
  });

  // Optionally seed a deterministic save. At week 1 the Red Box has no urgent
  // briefings at all, so their action buttons would be unreachable; the fixture
  // (scripts/make-capture-fixture.ts) forces week 49 + a bill + a restless minister.
  const fixturePath = path.resolve('artifacts/fixtures/redbox-state.json');
  let seeded = false;
  try {
    const fixture = await readFile(fixturePath, 'utf8');
    await page.addInitScript((payload) => {
      try {
        window.localStorage.setItem('pm-sim-save-v7', payload);
      } catch {
        /* ignore */
      }
    }, fixture);
    seeded = true;
  } catch {
    console.log('→ no fixture; creating a fresh game instead');
  }

  console.log(`→ opening ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await waitForText(page, 'PM Simulator', 120_000);

  // ---- reach the game shell --------------------------------------------
  let continued = false;
  if (seeded) {
    const cont = page.getByText('Continue where you left off', { exact: true }).first();
    try {
      await cont.waitFor({ timeout: 20_000 });
      await cont.click();
      continued = true;
    } catch {
      /* save did not load; fall through to create */
    }
  }
  if (!continued) {
    await page.getByText(/^(Start a new game|New game)$/).first().click();
    await waitForText(page, 'Create your Prime Minister');
    await page.locator('input[placeholder="First name"]').fill('Alex');
    await page.locator('input[placeholder="Last name"]').fill('Worley');
    await page.getByText('Enter Number 10', { exact: true }).click();
  }

  await page.getByRole('tab', { name: 'Red Box', exact: true }).waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1200);
  console.log(`→ in game shell (${continued ? 'restored from fixture' : 'fresh game'})\n`);

  // =====================================================================
  // 1. RED BOX — metrics render, then tap an active paper
  // =====================================================================
  console.log('1) Red Box');
  try {
    await waitForText(page, 'Approval Triad');
    pass('Red Box metrics header renders', 'Approval Triad');

    for (const tile of ['Public Approval', 'Party Confidence', 'Press Mood']) {
      const raw = await readStatTile(page, tile);
      const val = firstNumber(raw);
      if (Number.isFinite(val)) pass(`metric renders: ${tile}`, String(val));
      else fail(`metric missing: ${tile}`, String(raw));
    }

    // Tap the first active paper (Red Box dossier) — proves OPEN_DOSSIER wiring.
    await page.getByText('Decide', { exact: true }).first().click();
    await waitForText(page, 'Adviser:');
    pass('tapped active paper -> dossier sheet opened', 'Adviser advice visible');

    await snap(page, '01_red_box_action.png');
    pass('captured 01_red_box_action.png');
    await closeSheet(page);
  } catch (err) {
    fail('Red Box walkthrough', err.message.split('\n')[0]);
  }

  // =====================================================================
  // 2. CABINET — open a minister's action sheet, verify 44px targets
  // =====================================================================
  console.log('\n2) Cabinet Room');
  try {
    await page.getByRole('tab', { name: 'Politics', exact: true }).first().click();
    await page.getByRole('tab', { name: 'Cabinet', exact: true }).first().click();
    await waitForText(page, 'Cabinet Room');
    pass('Cabinet Room renders');

    const manage = page.locator('[data-testid^="manage-"]').first();
    if ((await manage.count()) === 0) throw new Error('no minister Manage button found');
    await manage.click();
    await waitForText(page, 'Promote a backbencher');
    pass('minister card -> action sheet opened', 'promotion list visible');

    // 44px hit-target verification on the emergency actions.
    const sack = page.locator('[data-testid="confirm-sack"]').first();
    if ((await sack.count()) === 0) throw new Error('sack button not found');
    const sackBox = await sack.boundingBox();
    if (sackBox && sackBox.height >= MIN_HIT) {
      pass('sack button hit target >= 44px', `${sackBox.height.toFixed(1)}px`);
    } else {
      fail('sack button hit target', `${sackBox ? sackBox.height.toFixed(1) : 'null'}px < ${MIN_HIT}px`);
    }

    const promoteRow = page.locator('[data-testid^="promote-"]').first();
    if ((await promoteRow.count()) > 0) {
      const box = await promoteRow.boundingBox();
      if (box && box.height >= MIN_HIT) {
        pass('backbencher row hit target >= 44px', `${box.height.toFixed(1)}px`);
      } else {
        fail('backbencher row hit target', `${box ? box.height.toFixed(1) : 'null'}px < ${MIN_HIT}px`);
      }
    }

    await snap(page, '02_cabinet_sheet.png');
    pass('captured 02_cabinet_sheet.png');
    await closeSheet(page);
  } catch (err) {
    fail('Cabinet walkthrough', err.message.split('\n')[0]);
  }

  // =====================================================================
  // 3. DIVISION LOBBY — cycle the 3-way whip control, prove UI updates
  // =====================================================================
  console.log('\n3) Division Lobby');
  try {
    await page.getByRole('tab', { name: 'Commons', exact: true }).first().click();
    await waitForText(page, 'Division Lobby');
    pass('Division Lobby renders');
    await waitForText(page, 'Working Majority');
    pass('parliamentary metrics render', 'Working Majority line');

    // Default whip is two-line; the CTA label embeds the selected whip.
    await waitForText(page, 'Two-Line Whip');
    pass('default whip reflects state', 'Two-Line Whip');

    await page.getByRole('tab', { name: 'Three-line', exact: true }).first().click();
    await waitForText(page, 'Three-Line Whip');
    pass('whip -> three-line updates CTA', 'Three-Line Whip');

    await page.getByRole('tab', { name: 'Free vote', exact: true }).first().click();
    await waitForText(page, 'Free Vote');
    pass('whip -> free vote updates CTA', 'Free Vote');

    // Back to two-line for the capture.
    await page.getByRole('tab', { name: 'Two-line', exact: true }).first().click();
    await waitForText(page, 'Two-Line Whip');
    pass('whip -> two-line updates CTA', 'Two-Line Whip');

    await snap(page, '03_division_whip.png');
    pass('captured 03_division_whip.png');
  } catch (err) {
    fail('Division Lobby walkthrough', err.message.split('\n')[0]);
  }

  // =====================================================================
  // 4. PRESS — open the spin sheet, fire a real briefing, prove cooldown
  // =====================================================================
  console.log('\n4) Press Room');
  try {
    await page.getByRole('tab', { name: 'Press', exact: true }).first().click();
    await waitForText(page, 'Press Room');
    pass('Press Room renders');

    const hostilityBefore = firstNumber(await readStatTile(page, 'Hostility'));
    pass('hostility baseline read', String(hostilityBefore));

    await clickBy(page, 'open-spin-sheet', 'Call a lobby briefing');
    await waitForText(page, 'Lobby Briefing');
    await waitForText(page, 'BRIEFING READY');
    pass('spin sheet opened', 'BRIEFING READY');

    // Trigger the real BRIEF_PRESS action on a friendly outlet.
    await clickBy(page, 'brief-boost-national-standard', /^Boost/);
    await page.waitForTimeout(900);
    pass('fired boost briefing (BRIEF_PRESS)', 'national-standard');

    const hostilityAfter = firstNumber(await readStatTile(page, 'Hostility'));
    if (Number.isFinite(hostilityAfter) && hostilityAfter > hostilityBefore) {
      pass('engine round-trip: hostility rose', `${hostilityBefore} -> ${hostilityAfter}`);
    } else {
      fail('engine round-trip: hostility unchanged', `${hostilityBefore} -> ${hostilityAfter}`);
    }

    // Re-open: the cooldown is derived from engine state (lastBriefingWeek).
    await clickBy(page, 'open-spin-sheet', 'Call a lobby briefing');
    await waitForText(page, 'COOLDOWN');
    pass('cooldown enforced after briefing', 'COOLDOWN visible');

    await snap(page, '04_press_briefing.png');
    pass('captured 04_press_briefing.png');
    await closeSheet(page);
  } catch (err) {
    fail('Press walkthrough', err.message.split('\n')[0]);
  }

  // =====================================================================
  // 5. RED BOX BRIEFING ACTIONS — the tab-navigation wiring
  // =====================================================================
  console.log('\n5) Red Box briefing actions');
  try {
    await page.getByRole('tab', { name: 'Red Box', exact: true }).first().click();
    await waitForText(page, 'Urgent Briefings');
    pass('urgent briefings section renders');

    const review = page.getByRole('button', { name: 'Review', exact: true }).first();
    const manage = page.getByRole('button', { name: 'Manage', exact: true }).first();
    await review.waitFor({ timeout: 15_000 });
    await manage.waitFor({ timeout: 15_000 });
    pass('briefing action buttons render', 'Review + Manage');

    for (const [name, loc] of [
      ['Review', review],
      ['Manage', manage],
    ]) {
      const box = await loc.boundingBox();
      if (box && box.height >= MIN_HIT) {
        pass(`${name} briefing button >= 44px`, `${box.height.toFixed(1)}px`);
      } else {
        fail(`${name} briefing button hit target`, `${box ? box.height.toFixed(1) : 'null'}px < ${MIN_HIT}px`);
      }
    }

    await snap(page, '05_red_box_briefing_actions.png');
    pass('captured 05_red_box_briefing_actions.png');

    // Manage -> Politics > Cabinet
    await manage.click();
    await waitForText(page, 'Cabinet Room');
    pass('Manage -> navigated to Politics > Cabinet');

    // back to the desk, then Review -> Politics > Commons (Division Lobby)
    await page.getByRole('tab', { name: 'Red Box', exact: true }).first().click();
    await waitForText(page, 'Urgent Briefings');
    await review.click();
    await waitForText(page, 'Division Lobby');
    pass('Review -> navigated to Politics > Commons');
  } catch (err) {
    fail('Red Box briefing actions', err.message.split('\n')[0]);
  }

  await context.close();
  await browser.close();
  browser = null;

  // ---- report ----------------------------------------------------------
  if (pageErrors.length > 0) {
    fail(`${pageErrors.length} unhandled page exception(s)`);
  }

  console.log(`\n=== active walkthrough: ${checks.filter((c) => c.ok).length}/${checks.length} checks passed ===`);
  if (failures.length > 0) {
    console.log('\nFAILURES:');
    for (const f of failures) console.log(` - ${f}`);
    process.exitCode = 1;
  } else {
    console.log('All interactions behaved; UI is wired to the engine end-to-end.');
  }
}

// Always terminate with an explicit code: a stray browser handle must never
// leave the harness hanging (and a CI gate must never hang on a crash).
run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(async (err) => {
    console.error('harness crashed:', err?.message ?? err);
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    process.exit(1);
  });

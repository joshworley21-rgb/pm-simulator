// End-to-end UI smoke test: boots the Expo web build, drives the first-run
// flow, asserts layout at phone width and captures screenshots as artifacts.
//
// Usage:
//   npm run test:ui
//   UI_TEST_PORT=8090 npm run test:ui

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.UI_TEST_PORT ?? 8089);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.join(ROOT, 'artifacts', 'ui-smoke');
const EXPO_LOG = path.join(OUT_DIR, 'expo.log');
const MIN_HIT = 44;

let browser = null;
let expo = null;

function stopExpo() {
  if (!expo) return;
  try {
    if (process.platform === 'win32') expo.kill('SIGTERM');
    else process.kill(-expo.pid, 'SIGTERM');
  } catch {
    /* already stopped */
  }
}

function startExpo() {
  mkdirSync(OUT_DIR, { recursive: true });
  const log = createWriteStream(EXPO_LOG, { flags: 'w' });
  expo = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  expo.stdout.pipe(log);
  expo.stderr.pipe(log);
  expo.on('exit', (code) => {
    if (code && code !== 0) console.error(`expo exited with code ${code}`);
  });
}

async function waitForServer(timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) return;
    } catch {
      /* not ready yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Expo web server did not start at ${BASE_URL}`);
}

async function expectText(page, text, timeout = 20_000) {
  await page.getByText(text, { exact: true }).first().waitFor({ state: 'visible', timeout });
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function assertNoTextOverlap(page, first, second, label) {
  const a = await page.getByText(first, { exact: true }).first().boundingBox();
  const b = await page.getByText(second, { exact: true }).first().boundingBox();
  if (!a || !b) throw new Error(`${label}: could not measure both text nodes`);
  if (overlaps(a, b)) throw new Error(`${label}: "${first}" overlaps "${second}"`);
}

async function assertHitTarget(locator, label) {
  const box = await locator.boundingBox();
  if (!box || box.height < MIN_HIT) {
    throw new Error(`${label}: expected >= ${MIN_HIT}px, got ${box ? box.height.toFixed(1) : 'null'}px`);
  }
}

async function run() {
  startExpo();
  await waitForServer();

  browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  console.log(`→ opening ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await expectText(page, 'PM Simulator', 120_000);
  await expectText(page, 'Start a new game');
  await page.screenshot({ path: path.join(OUT_DIR, '01-menu.png'), fullPage: true });
  console.log('   ✓ menu renders');

  await page.getByText('Start a new game', { exact: true }).click();
  await expectText(page, 'Create your Prime Minister');
  await assertNoTextOverlap(page, 'Conservative Party', '24% base', 'party card');
  await assertHitTarget(page.getByRole('button', { name: 'Enter Number 10' }), 'start game button');
  await page.screenshot({ path: path.join(OUT_DIR, '02-create.png'), fullPage: true });
  console.log('   ✓ create screen renders; party card text does not overlap');

  await page.getByPlaceholder('First name').fill('Jane');
  await page.getByPlaceholder('Last name').fill('Hartley');
  await page.getByText('Enter Number 10', { exact: true }).click();

  await expectText(page, 'State of the Nation', 120_000);
  await expectText(page, 'Advance');

  // The red box drawer replaces the tab bar: open it, switch files, switch back.
  await page.getByTestId('open-red-box').click();
  await expectText(page, 'Choose your file');
  await page.getByTestId('nav-govern').click();
  await expectText(page, 'Legislative agenda');
  await page.getByTestId('open-red-box').click();
  await page.getByTestId('nav-desk').click();
  await expectText(page, 'State of the Nation');

  await page.screenshot({ path: path.join(OUT_DIR, '03-game.png'), fullPage: true });
  console.log('   ✓ first-run flow reaches the game shell');

  if (pageErrors.length > 0) {
    throw new Error(`unhandled page exceptions:\n${pageErrors.join('\n')}`);
  }

  console.log(`\nUI smoke test passed. Screenshots: ${path.relative(ROOT, OUT_DIR)}`);
}

try {
  await run();
} catch (err) {
  console.error(`\nUI smoke test failed: ${err?.message ?? err}`);
  try {
    const log = await readFile(EXPO_LOG, 'utf8');
    console.error('\n--- expo.log (tail) ---');
    console.error(log.split('\n').slice(-40).join('\n'));
  } catch {
    /* no log */
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  stopExpo();
}

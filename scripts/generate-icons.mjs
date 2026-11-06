import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Renders the icon artboards in scripts/icons/index.html to every size the
// Expo config and the bare Android project need. Run with `npm run icons`.

const ROOT = path.resolve(import.meta.dirname, '..');
const ANDROID = 'android/app/src/main/res';

const launcherDpis = { 48: 'mdpi', 72: 'hdpi', 96: 'xhdpi', 144: 'xxhdpi', 192: 'xxxhdpi' };
const layerDpis = { 108: 'mdpi', 162: 'hdpi', 216: 'xhdpi', 324: 'xxhdpi', 432: 'xxxhdpi' };
const splashDpis = { 288: 'mdpi', 432: 'hdpi', 576: 'xhdpi', 864: 'xxhdpi', 1152: 'xxxhdpi' };

const MAP = {
  icon: ['assets/icon.png'],
  splash: ['assets/splash-icon.png'],
  'fg-512': ['assets/android-icon-foreground.png'],
  'mono-512': ['assets/android-icon-monochrome.png'],
  'bgsolid-512': ['assets/android-icon-background.png'],
  favicon: ['assets/favicon.png'],
};
for (const N of [48, 72, 96, 144, 192]) {
  MAP[`launcher-${N}`] = [
    `${ANDROID}/mipmap-${launcherDpis[N]}/ic_launcher.png`,
    `${ANDROID}/mipmap-${launcherDpis[N]}/ic_launcher_round.png`,
  ];
}
for (const N of [108, 162, 216, 324, 432]) {
  const dir = `${ANDROID}/mipmap-${layerDpis[N]}`;
  MAP[`fg-${N}`] = [`${dir}/ic_launcher_foreground.png`];
  MAP[`mono-${N}`] = [`${dir}/ic_launcher_monochrome.png`];
  MAP[`bgsolid-${N}`] = [`${dir}/ic_launcher_background.png`];
}
for (const N of [288, 432, 576, 864, 1152]) {
  MAP[`splash-${N}`] = [`${ANDROID}/drawable-${splashDpis[N]}/splashscreen_logo.png`];
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1 });
await page.goto(`file://${path.join(ROOT, 'scripts/icons/index.html')}`);
await page.waitForTimeout(300);

for (const [board, targets] of Object.entries(MAP)) {
  const buf = await page.locator(`#board-${board}`).screenshot({ omitBackground: true });
  for (const rel of targets) {
    const file = path.join(ROOT, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, buf);
    console.log('wrote', rel, buf.length, 'bytes');
  }
}

await browser.close();
console.log('done');

/**
 * generate-report.ts
 *
 * Scans the project root for fuzzer output files (`*-results.json`), parses each
 * one and prints a clean, human-readable text summary of the fuzzer outcomes:
 * survival / ousting rates, average ousting turns, economy limits hit, Red Box
 * crash rates, behaviour mixes and so on.
 *
 * Run with tsx:
 *   npx --yes tsx scripts/generate-report.ts
 *
 * Like the other scripts in this folder it deliberately avoids a test framework
 * and node type definitions (so `require` is used for fs/path and `// @ts-ignore`
 * silences the missing-name errors that the project's strict tsconfig would
 * otherwise raise).
 */

// @ts-ignore - no node type definitions in this project
const fs = require('fs');
// @ts-ignore - no node type definitions in this project
const path = require('path');

declare const __dirname: string;
declare const process: { cwd(): string };

/** Suffix that marks a fuzzer output file in the project root. */
const RESULT_SUFFIX = '-results.json';
/** Total width of the rule lines. */
const WIDTH = 78;
/** Width of the left-hand label column. */
const LABEL_WIDTH = 20;

/* ----------------------------------------------------------------------- */
/* formatting helpers                                                       */
/* ----------------------------------------------------------------------- */

function rule(char: string, width?: number): string {
  return char.repeat(width === undefined ? WIDTH : width);
}

function padEnd(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function padStart(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

/** Format an integer with thousands separators (ICU-independent). */
function withCommas(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format a number for display: integers grouped, decimals to 2 places. */
function fmtNumber(value: unknown): string {
  if (typeof value !== 'number' || !isFinite(value)) return String(value);
  return Number.isInteger(value) ? withCommas(value) : value.toFixed(2);
}

/** Percentage of `n` out of `total`, e.g. "85.36%". */
function pct(n: number, total: number): string {
  if (!total) return '0.00%';
  return ((n / total) * 100).toFixed(2) + '%';
}

function numOrUndef(value: unknown): number | undefined {
  return typeof value === 'number' && isFinite(value) ? value : undefined;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' + p(d.getMonth() + 1) +
    '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) +
    ':' + p(d.getMinutes()) +
    ':' + p(d.getSeconds())
  );
}

function metric(label: string, value: string): string {
  return '  ' + padEnd(label, LABEL_WIDTH) + ': ' + value;
}

/* ----------------------------------------------------------------------- */
/* locating the results                                                     */
/* ----------------------------------------------------------------------- */

/** Best-effort discovery of the project root (the dir holding package.json). */
function findProjectRoot(): string {
  const candidates: string[] = [];
  try { candidates.push(process.cwd()); } catch (e) { /* ignore */ }
  try { candidates.push(path.resolve(__dirname, '..')); } catch (e) { /* ignore */ }

  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    } catch (e) { /* ignore */ }
  }

  // Fall back to walking upwards from the current directory.
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    try {
      if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    } catch (e) { /* ignore */ }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** A stable, human-friendly ordering for the known fuzzer result files. */
const ORDER = [
  'political-fuzzer-results.json',
  'political-fuzzer-mild-results.json',
  'fuzzer-results.json',
  'redbox-crawler-results.json',
];

function orderIndex(name: string): number {
  const i = ORDER.indexOf(name);
  return i === -1 ? ORDER.length : i;
}

/** List every `*-results.json` file that sits directly in the project root. */
function discoverResultFiles(root: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(root);
  } catch (e) {
    return [];
  }

  return entries
    .filter((name: string) => name.endsWith(RESULT_SUFFIX))
    .filter((name: string) => {
      try {
        return fs.statSync(path.join(root, name)).isFile();
      } catch (e) {
        return false;
      }
    })
    .sort((a: string, b: string) => orderIndex(a) - orderIndex(b) || a.localeCompare(b));
}

/* ----------------------------------------------------------------------- */
/* classifying + describing a result file                                   */
/* ----------------------------------------------------------------------- */

type Kind = 'political' | 'political-mild' | 'economy' | 'redbox' | 'generic';

function classify(file: string, d: any): Kind {
  if (d) {
    if (d.totalCrashes !== undefined || d.crashRate !== undefined) return 'redbox';
    if (d.totalFailures !== undefined || d.failureRate !== undefined) return 'economy';
    if (d.totalOustings !== undefined && (d.survivalRate !== undefined || d.behaviourCounts !== undefined)) {
      return 'political-mild';
    }
    if (d.totalOustings !== undefined || d.oustingRate !== undefined) return 'political';
  }
  if (/redbox/i.test(file)) return 'redbox';
  if (/economy/i.test(file)) return 'economy';
  if (/political-fuzzer-mild/i.test(file)) return 'political-mild';
  if (/political-fuzzer/i.test(file)) return 'political';
  return 'generic';
}

function describe(kind: Kind): string {
  switch (kind) {
    case 'economy':
      return 'Economy fuzzer - random budget/tax stress test';
    case 'political':
      return 'Political fuzzer - aggressive blunder every turn';
    case 'political-mild':
      return 'Political fuzzer - mild / cautious government';
    case 'redbox':
      return 'Red Box crawler - dossier resolution robustness';
    default:
      return 'Fuzzer result';
  }
}

function reasonTitle(kind: Kind): string {
  switch (kind) {
    case 'economy':
      return 'Economy limits hit';
    case 'redbox':
      return 'Error types';
    case 'political':
    case 'political-mild':
      return 'Ousting reasons';
    default:
      return 'Failure reasons';
  }
}

/** Pull the array of sampled failures/crashes out of a result object. */
function firstSampleArray(d: any): any[] {
  if (!d) return [];
  const keys = ['sampleFailures', 'sampleCrashes', 'failures', 'crashes', 'samples'];
  for (const key of keys) {
    if (Array.isArray(d[key])) return d[key];
  }
  return [];
}

/* ----------------------------------------------------------------------- */
/* building one section of the report                                       */
/* ----------------------------------------------------------------------- */

function buildSection(file: string, data: any, index: number, total: number): string[] {
  const kind = classify(file, data);
  const lines: string[] = [];
  const push = (label: string, value: string) => lines.push(metric(label, value));

  const sims = numOrUndef(data && data.totalSimulations);
  const oustings = numOrUndef(data && data.totalOustings);
  const failures = numOrUndef(data && data.totalFailures);
  const crashes = numOrUndef(data && data.totalCrashes);

  lines.push('[' + (index + 1) + '/' + total + '] ' + file);
  lines.push('      ' + describe(kind));
  lines.push(rule('-'));

  if (sims !== undefined) push('Simulations', withCommas(sims));

  // Survived: use the file's own figure when present, otherwise derive it.
  const failCount = oustings !== undefined ? oustings : failures !== undefined ? failures : crashes;
  let survived = numOrUndef(data && data.totalSurvived);
  if (survived === undefined && sims !== undefined && failCount !== undefined) {
    survived = sims - failCount;
  }
  if (survived !== undefined) {
    push(kind === 'redbox' ? 'Completed' : 'Survived', withCommas(survived) + (sims ? '  (' + pct(survived, sims) + ')' : ''));
  }
  if (oustings !== undefined) {
    push('Ousted', withCommas(oustings) + (sims ? '  (' + pct(oustings, sims) + ')' : ''));
  }
  if (failures !== undefined) {
    push('Failed', withCommas(failures) + (sims ? '  (' + pct(failures, sims) + ')' : ''));
  }
  if (crashes !== undefined) {
    push('Crashed', withCommas(crashes) + (sims ? '  (' + pct(crashes, sims) + ')' : ''));
  }

  if (numOrUndef(data && data.maxTurns) !== undefined) push('Max turns', withCommas(data.maxTurns));
  if (typeof (data && data.setup) === 'string') push('Setup', data.setup);

  const explicitAvgOusting = numOrUndef(data && data.averageOustingTurn);
  if (explicitAvgOusting !== undefined) push('Avg ousting turn', fmtNumber(explicitAvgOusting));
  if (numOrUndef(data && data.averageFinalLetters) !== undefined) {
    push('Avg final letters', fmtNumber(data.averageFinalLetters));
  }
  if (numOrUndef(data && data.maxFinalLetters) !== undefined) {
    push('Max final letters', withCommas(data.maxFinalLetters));
  }
  if (numOrUndef(data && data.lettersThreshold) !== undefined) {
    push('Letters threshold', withCommas(data.lettersThreshold));
  }

  /* ---- statistics derived from the sampled failures/crashes ---- */
  const samples = firstSampleArray(data);
  if (samples.length > 0) {
    const reasons = new Map<string, number>();
    const turns: number[] = [];
    for (const s of samples) {
      const reason = s && (s.failureReason !== undefined ? s.failureReason : s.reason !== undefined ? s.reason : s.errorMessage !== undefined ? s.errorMessage : s.error);
      if (typeof reason === 'string') {
        reasons.set(reason, (reasons.get(reason) || 0) + 1);
      }
      const turn = numOrUndef(s && (s.oustedOnTurn !== undefined ? s.oustedOnTurn : s.crashedOnTurn !== undefined ? s.crashedOnTurn : s.turn));
      if (turn !== undefined) turns.push(turn);
    }

    if (reasons.size > 0) {
      lines.push('  ' + reasonTitle(kind) + ' (of ' + samples.length + ' sampled):');
      const sorted = Array.from(reasons.entries()).sort((a, b) => b[1] - a[1]);
      for (const entry of sorted) {
        lines.push('      ' + padEnd('- ' + entry[0], 32) + padStart(withCommas(entry[1]), 6) + '  (' + pct(entry[1], samples.length) + ')');
      }
    }

    if (turns.length > 0) {
      const sum = turns.reduce((a, b) => a + b, 0);
      const avg = sum / turns.length;
      const min = Math.min.apply(null, turns);
      const max = Math.max.apply(null, turns);
      const label = kind === 'economy' ? 'Crash turn' : 'Ousting turn';
      if (explicitAvgOusting === undefined) {
        lines.push('  ' + padEnd(label, LABEL_WIDTH) + ': avg ' + fmtNumber(avg) + '  (min ' + min + ' / max ' + max + ')');
      } else {
        lines.push('  ' + padEnd(label, LABEL_WIDTH) + ': min ' + min + ' / max ' + max + '  (sampled)');
      }
    }

    // For the economy fuzzer, average the macro stats recorded at failure so you
    // can see how far past each clamp the runs actually ran.
    if (kind === 'economy') {
      const statLabels: { key: string; label: string }[] = [
        { key: 'debtToGdp', label: 'Debt / GDP' },
        { key: 'cpiInflation', label: 'CPI inflation' },
        { key: 'gdpGrowth', label: 'GDP growth' },
      ];
      const avgLines: string[] = [];
      for (const stat of statLabels) {
        let accum = 0;
        let count = 0;
        for (const s of samples) {
          const value = numOrUndef(s && s.resultingStats && s.resultingStats[stat.key]);
          if (value !== undefined) {
            accum += value;
            count += 1;
          }
        }
        if (count > 0) {
          avgLines.push('      ' + padEnd('- ' + stat.label, 32) + padStart(fmtNumber(accum / count), 8));
        }
      }
      if (avgLines.length > 0) {
        lines.push('  Avg economy stats at failure (sampled):');
        for (const line of avgLines) lines.push(line);
      }
    }
  }

  /* ---- behaviour mix (mild political fuzzer) ---- */
  const behaviourCounts = data && data.behaviourCounts;
  if (behaviourCounts && typeof behaviourCounts === 'object') {
    const entries = Object.entries(behaviourCounts) as [string, number][];
    let totalActions = 0;
    for (const entry of entries) {
      if (typeof entry[1] === 'number') totalActions += entry[1];
    }
    if (totalActions > 0) {
      lines.push('  Behaviour mix (' + withCommas(totalActions) + ' actions):');
      for (const entry of entries) {
        lines.push('      ' + padEnd('- ' + entry[0], 32) + padStart(withCommas(entry[1]), 6) + '  (' + pct(entry[1], totalActions) + ')');
      }
    }
  }

  /* ---- generic fallback for any unrecognised top-level scalars ---- */
  if (kind === 'generic') {
    for (const entry of Object.entries(data || {})) {
      const value = entry[1];
      if (value === null || typeof value === 'object') continue;
      push(entry[0], typeof value === 'number' ? fmtNumber(value) : String(value));
    }
  }

  if (lines.length <= 3) {
    lines.push('  (no summary fields recognised in this file)');
  }

  return lines;
}

/* ----------------------------------------------------------------------- */
/* main                                                                     */
/* ----------------------------------------------------------------------- */

function main(): void {
  const root = findProjectRoot();
  const files = discoverResultFiles(root);

  console.log(rule('='));
  console.log('  FUZZER RESULTS SUMMARY');
  console.log(rule('='));
  console.log('  Project root : ' + root);
  console.log('  Generated    : ' + timestamp());
  console.log('  Files found  : ' + files.length + '  (matching *' + RESULT_SUFFIX + ')');
  console.log(rule('='));

  if (files.length === 0) {
    console.log('');
    console.log('  No *' + RESULT_SUFFIX + ' files found in the project root.');
    console.log('  Run the fuzzers first, e.g.:  npm run test:fuzzers');
    console.log('');
    return;
  }

  const parsed: { file: string; data: any }[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log('');
    let data: any;
    try {
      const raw = fs.readFileSync(path.join(root, file), 'utf8');
      data = JSON.parse(raw);
    } catch (err: any) {
      console.log('[' + (i + 1) + '/' + files.length + '] ' + file);
      console.log(rule('-'));
      console.log(metric('Error', 'could not read/parse (' + (err && err.message ? err.message : String(err)) + ')'));
      continue;
    }
    const section = buildSection(file, data, i, files.length);
    for (const line of section) console.log(line);
    parsed.push({ file, data });
  }

  /* ---- at a glance ---- */
  console.log('');
  console.log(rule('='));
  console.log('  AT A GLANCE');
  console.log(rule('='));
  console.log('  ' + padEnd('FILE', 34) + padStart('SIMS', 9) + padStart('FAIL/CRASH', 12) + padStart('RATE', 10));
  console.log(rule('-'));
  for (const entry of parsed) {
    const sims = numOrUndef(entry.data && entry.data.totalSimulations);
    const count = numOrUndef(
      entry.data && (entry.data.totalOustings !== undefined ? entry.data.totalOustings : entry.data.totalFailures !== undefined ? entry.data.totalFailures : entry.data.totalCrashes),
    );
    const rate = sims !== undefined && count !== undefined ? pct(count, sims) : '-';
    console.log(
      '  ' + padEnd(entry.file, 34) +
      padStart(sims !== undefined ? withCommas(sims) : '-', 9) +
      padStart(count !== undefined ? withCommas(count) : '-', 12) +
      padStart(rate, 10),
    );
  }
  console.log(rule('='));
  console.log('');
}

main();

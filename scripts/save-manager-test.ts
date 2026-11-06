/**
 * Save manager harness.
 * Runs against the in-memory fallback used outside React Native/web, so it
 * exercises the same synchronous save/load/corruption paths without a device.
 */
import { createInitialState, reducer } from '../src/app/engine';
import {
  AUTO_SAVE_SLOT,
  SAVE_SCHEMA_VERSION,
  autoSave,
  listSaveSlots,
  loadGameState,
  saveGameState,
  saveSlotBackupKey,
  saveSlotKey,
  writeStorageString,
} from '../src/storage/saveManager';
import type { GameState } from '../src/app/types';

const assert = {
  ok(value: unknown, message?: string) {
    if (!value) throw new Error(message ?? 'expected a truthy value');
  },
  equal<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
      throw new Error(message ?? 'expected ' + String(expected) + ' but got ' + String(actual));
    }
  },
};

let checks = 0;
let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    checks += 1;
    console.log('  ok   ' + name);
  } catch (err) {
    failures += 1;
    console.error('  FAIL ' + name);
    console.error(err);
  }
}

function newGame(): GameState {
  return reducer(createInitialState(), {
    type: 'CREATE_PLAYER',
    player: {
      firstName: 'Save',
      lastName: 'Tester',
      partyId: 'reform',
      background: 'City financier',
    },
  });
}

check('saveGameState writes a synchronous slot and loadGameState reads it back', () => {
  const state = { ...newGame(), week: 42 };
  assert.equal(saveGameState('unit-basic', state), true);
  const loaded = loadGameState('unit-basic');
  assert.ok(loaded, 'expected a saved state');
  assert.equal(loaded?.week, 42);
  assert.equal(loaded?.player?.firstName, 'Save');
});

check('autoSave writes the dedicated autosave slot', () => {
  const state = { ...newGame(), week: 77 };
  autoSave(state);
  assert.equal(loadGameState(AUTO_SAVE_SLOT)?.week, 77);
});

check('listSaveSlots returns metadata for every saved slot', () => {
  const state = { ...newGame(), week: 31 };
  saveGameState('unit-metadata', state);
  const slots = listSaveSlots();
  const slot = slots.find((entry) => entry.slotId === 'unit-metadata');
  assert.ok(slot, 'slot missing from metadata');
  assert.equal(slot?.week, 31);
  assert.equal(slot?.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(slot?.playerName, 'Save Tester');
  assert.equal(slot?.partyId, 'reform');
  assert.equal(slot?.corrupt, false);
});

check('corrupt primary data is detected and recovered from the backup', () => {
  const state = { ...newGame(), week: 55 };
  saveGameState('unit-corrupt', state);
  assert.ok(
    writeStorageString(saveSlotKey('unit-corrupt'), '{"schemaVersion":'),
    'failed to corrupt the primary slot',
  );
  assert.ok(saveSlotBackupKey('unit-corrupt').length > 0);

  const recovered = loadGameState('unit-corrupt');
  assert.ok(recovered, 'backup should have rescued the slot');
  assert.equal(recovered?.week, 55);
});

check('a direct legacy GameState is migrated to the current schema', () => {
  const state = { ...newGame(), week: 64 };
  writeStorageString(saveSlotKey('unit-legacy'), JSON.stringify(state));
  const migrated = loadGameState('unit-legacy');
  assert.ok(migrated, 'legacy save should load');
  assert.equal(migrated?.week, 64);
  const slot = listSaveSlots().find((entry) => entry.slotId === 'unit-legacy');
  assert.equal(slot?.schemaVersion, SAVE_SCHEMA_VERSION);
});

check('a save from a newer schema is refused rather than corrupted', () => {
  const state = { ...newGame(), week: 12 };
  writeStorageString(
    saveSlotKey('unit-future'),
    JSON.stringify({
      schemaVersion: SAVE_SCHEMA_VERSION + 1,
      savedAt: Date.now(),
      state,
    }),
  );
  assert.equal(loadGameState('unit-future'), null);
});

check('a missing slot returns null', () => {
  assert.equal(loadGameState('unit-does-not-exist'), null);
});

console.log('');
console.log(`save manager tests: ${checks - failures}/${checks} checks passed.`);
if (failures > 0) process.exit(1);

import type { GameState } from '../app/types';
import { migrateState } from '../app/engine';

/**
 * Synchronous save storage.
 *
 * Native builds use react-native-mmkv. Web builds use localStorage (which is
 * also synchronous), and non-browser test/SSR environments use an in-memory
 * map. Keeping the adapter behind this file means the rest of the app never
 * performs an async storage read or write.
 */

export const SAVE_SCHEMA_VERSION = 8;
export const AUTO_SAVE_SLOT = 'autosave';

const SLOT_PREFIX = 'pm-sim:slot:';
const BACKUP_SUFFIX = ':backup';

interface SyncKeyValueStore {
  getString(key: string): string | null;
  setString(key: string, value: string): boolean;
  delete(key: string): boolean;
  getAllKeys(): string[];
}

interface SaveEnvelope {
  schemaVersion: number;
  savedAt: number;
  state: GameState;
}

interface DecodedSave {
  state: Partial<GameState>;
  schemaVersion: number;
  savedAt: number;
  legacy: boolean;
}

export interface SaveMetadata {
  slotId: string;
  schemaVersion: number;
  savedAt: number;
  week: number;
  playerName: string | null;
  partyId: string | null;
  corrupt: boolean;
  recoveredFromBackup: boolean;
}

const memory = new Map<string, string>();

const memoryStore: SyncKeyValueStore = {
  getString: (key) => memory.get(key) ?? null,
  setString: (key, value) => {
    memory.set(key, value);
    return true;
  },
  delete: (key) => memory.delete(key),
  getAllKeys: () => Array.from(memory.keys()),
};

let nativeStore: SyncKeyValueStore | null = null;
let nativeResolved = false;

function isReactNativeRuntime(): boolean {
  const navigatorLike = (globalThis as { navigator?: { product?: string } }).navigator;
  return navigatorLike?.product === 'ReactNative';
}

function getNativeStore(): SyncKeyValueStore | null {
  if (nativeResolved) return nativeStore;
  nativeResolved = true;
  if (!isReactNativeRuntime()) return null;

  try {
    // Required lazily so web/test bundles never initialise the native module.
    const mmkv = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const instance = mmkv.createMMKV({ id: 'the-red-box' });
    nativeStore = {
      getString: (key) => instance.getString(key) ?? null,
      setString: (key, value) => {
        instance.set(key, value);
        return true;
      },
      delete: (key) => instance.remove(key),
      getAllKeys: () => instance.getAllKeys(),
    };
  } catch (error) {
    console.warn('MMKV unavailable; falling back to web/memory storage.', error);
    nativeStore = null;
  }
  return nativeStore;
}

function getWebStore(): SyncKeyValueStore | null {
  const candidate = (
    globalThis as {
      localStorage?: {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
        removeItem(key: string): void;
        key(index: number): string | null;
        readonly length: number;
      };
    }
  ).localStorage;
  if (!candidate) return null;

  return {
    getString: (key) => candidate.getItem(key),
    setString: (key, value) => {
      candidate.setItem(key, value);
      return true;
    },
    delete: (key) => {
      candidate.removeItem(key);
      return true;
    },
    getAllKeys: () => {
      const keys: string[] = [];
      for (let i = 0; i < candidate.length; i += 1) {
        const key = candidate.key(i);
        if (key !== null) keys.push(key);
      }
      return keys;
    },
  };
}

function store(): SyncKeyValueStore {
  return getNativeStore() ?? getWebStore() ?? memoryStore;
}

export function saveSlotKey(slotId: string): string {
  return `${SLOT_PREFIX}${slotId}`;
}

export function saveSlotBackupKey(slotId: string): string {
  return `${saveSlotKey(slotId)}${BACKUP_SUFFIX}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGameStateShaped(value: unknown): value is Partial<GameState> {
  if (!isRecord(value)) return false;
  return (
    typeof value.phase === 'string' &&
    typeof value.week === 'number' &&
    Number.isFinite(value.week) &&
    Array.isArray(value.parties) &&
    isRecord(value.metrics) &&
    isRecord(value.stats)
  );
}

function decodeSave(raw: string | null): DecodedSave | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed) && 'state' in parsed) {
      const version =
        typeof parsed.schemaVersion === 'number' && Number.isFinite(parsed.schemaVersion)
          ? parsed.schemaVersion
          : -1;
      if (version < 0 || !isGameStateShaped(parsed.state)) return null;
      return {
        state: parsed.state,
        schemaVersion: version,
        savedAt:
          typeof parsed.savedAt === 'number' && Number.isFinite(parsed.savedAt)
            ? parsed.savedAt
            : 0,
        legacy: false,
      };
    }
    // Saves written before the envelope existed stored the GameState directly.
    if (isGameStateShaped(parsed)) {
      return { state: parsed, schemaVersion: 0, savedAt: 0, legacy: true };
    }
    return null;
  } catch {
    return null;
  }
}

function encodeSave(state: GameState): string {
  const envelope: SaveEnvelope = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: Date.now(),
    state: migrateState(state),
  };
  return JSON.stringify(envelope);
}

function writePrimary(slotId: string, raw: string): void {
  store().setString(saveSlotKey(slotId), raw);
  if (store().getString(saveSlotBackupKey(slotId)) === null) {
    store().setString(saveSlotBackupKey(slotId), raw);
  }
}

function hydrate(
  decoded: DecodedSave,
  slotId: string,
  fromBackup: boolean,
): GameState | null {
  if (decoded.schemaVersion > SAVE_SCHEMA_VERSION) {
    console.warn(
      `Save slot "${slotId}" was written by a newer schema (${decoded.schemaVersion}); refusing to downgrade it.`,
    );
    return null;
  }

  try {
    const migrated = migrateState(decoded.state);
    if (fromBackup || decoded.legacy || decoded.schemaVersion !== SAVE_SCHEMA_VERSION) {
      writePrimary(slotId, encodeSave(migrated));
    }
    return migrated;
  } catch (error) {
    console.warn(`Failed to migrate save slot "${slotId}".`, error);
    return null;
  }
}

export function saveGameState(slotId: string, state: GameState): boolean {
  try {
    const key = saveSlotKey(slotId);
    const previousRaw = store().getString(key);
    const previous = decodeSave(previousRaw);
    if (previous) {
      store().setString(saveSlotBackupKey(slotId), previousRaw as string);
    }

    const raw = encodeSave(state);
    store().setString(key, raw);
    if (store().getString(saveSlotBackupKey(slotId)) === null) {
      store().setString(saveSlotBackupKey(slotId), raw);
    }
    return true;
  } catch (error) {
    console.warn(`Failed to save slot "${slotId}".`, error);
    return false;
  }
}

export function loadGameState(slotId: string): GameState | null {
  const primaryRaw = store().getString(saveSlotKey(slotId));
  const primary = decodeSave(primaryRaw);
  if (primaryRaw !== null && !primary) {
    console.warn(`Save slot "${slotId}" is corrupt; attempting backup recovery.`);
  }

  if (primary) {
    const hydrated = hydrate(primary, slotId, false);
    if (hydrated) return hydrated;
  }

  const backupRaw = store().getString(saveSlotBackupKey(slotId));
  const backup = decodeSave(backupRaw);
  if (!backup) return null;

  const recovered = hydrate(backup, slotId, true);
  if (recovered) {
    console.warn(`Recovered save slot "${slotId}" from its backup.`);
  }
  return recovered;
}

export function autoSave(state: GameState): void {
  saveGameState(AUTO_SAVE_SLOT, state);
}

function metadataFrom(
  slotId: string,
  decoded: DecodedSave | null,
  corrupt: boolean,
  recoveredFromBackup: boolean,
): SaveMetadata {
  const state = decoded?.state;
  const player = isRecord(state?.player) ? state.player : null;
  const firstName = typeof player?.firstName === 'string' ? player.firstName : '';
  const lastName = typeof player?.lastName === 'string' ? player.lastName : '';
  const playerName = `${firstName} ${lastName}`.trim() || null;
  const partyId = typeof player?.partyId === 'string' ? player.partyId : null;

  return {
    slotId,
    schemaVersion: decoded?.schemaVersion ?? 0,
    savedAt: decoded?.savedAt ?? 0,
    week: typeof state?.week === 'number' && Number.isFinite(state.week) ? state.week : 0,
    playerName,
    partyId,
    corrupt,
    recoveredFromBackup,
  };
}

export function listSaveSlots(): SaveMetadata[] {
  const slots = store()
    .getAllKeys()
    .filter((key) => key.startsWith(SLOT_PREFIX) && !key.endsWith(BACKUP_SUFFIX))
    .map((key) => {
      const slotId = key.slice(SLOT_PREFIX.length);
      const decoded = decodeSave(store().getString(key));
      if (decoded && decoded.schemaVersion <= SAVE_SCHEMA_VERSION) {
        return metadataFrom(slotId, decoded, false, false);
      }
      const backup = decodeSave(store().getString(saveSlotBackupKey(slotId)));
      if (backup && backup.schemaVersion <= SAVE_SCHEMA_VERSION) {
        return metadataFrom(slotId, backup, true, true);
      }
      return metadataFrom(slotId, null, true, false);
    });

  return slots.sort((a, b) => b.savedAt - a.savedAt);
}

/** Synchronous helpers for non-save key/value flags (e.g. UI hints). */
export function readStorageString(key: string): string | null {
  return store().getString(key);
}

export function writeStorageString(key: string, value: string): boolean {
  try {
    return store().setString(key, value);
  } catch (error) {
    console.warn(`Failed to write storage key "${key}".`, error);
    return false;
  }
}

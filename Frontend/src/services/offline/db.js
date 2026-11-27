import { openDB } from 'idb';

export const OFFLINE_DATABASE_NAME = 'talkready-offline-store';
export const OFFLINE_DATABASE_VERSION = 2;

const STORES = {
  questions: 'questions',
  meta: 'meta',
  interviews: 'interviews',
  answers: 'answers',
  reports: 'reports',
  notes: 'notes',
  resumes: 'resumes',
  syncQueue: 'syncQueue',
  settings: 'settings',
  guest: 'guest',
};

const legacyDatabases = [
  { name: 'talkready-question-cache', stores: ['questions', 'questionMeta'], mapping: { questionMeta: 'meta' } },
  { name: 'talkready-interview-store', stores: ['interviews', 'answers', 'answerSyncQueue'], mapping: { answerSyncQueue: 'syncQueue' } },
];
const scopedStores = new Set(['interviews', 'answers', 'reports', 'notes', 'resumes', 'syncQueue', 'settings', 'guest']);

const memoryStores = new Map(Object.values(STORES).map((name) => [name, new Map()]));
let databasePromise;
let migrationPromise;
let memoryMode = false;
let storageWarning = null;

function currentScope() {
  const guestMode = typeof localStorage !== 'undefined' && localStorage.getItem('talkready_guest_mode') === 'true';
  if (guestMode) return 'guest';
  if (typeof localStorage !== 'undefined') {
    try {
      const user = JSON.parse(localStorage.getItem('talkready_user') || 'null');
      if (user?.id) return `user:${user.id}`;
      if (user?.email) {
        let hash = 2166136261;
        for (const character of user.email.toLocaleLowerCase()) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
        return `user:${(hash >>> 0).toString(16)}`;
      }
      if (localStorage.getItem('talkready_token')) return 'authenticated';
    } catch {
      if (localStorage.getItem('talkready_token')) return 'authenticated';
    }
  }
  return 'anonymous';
}

function storageError(error) {
  return error?.code === 'OFFLINE_STORAGE_UNAVAILABLE'
    || ['AbortError', 'InvalidStateError', 'QuotaExceededError', 'SecurityError', 'UnknownError'].includes(error?.name);
}

async function enableMemoryFallback(error) {
  if (memoryMode) return;
  try {
    const database = await openOfflineDatabase();
    for (const storeName of Object.values(STORES)) {
      const records = await database.getAll(storeName);
      const memory = memoryStores.get(storeName);
      for (const record of records) {
        const key = record.id ?? record.key;
        if (key !== undefined) memory.set(key, record);
      }
    }
  } catch {
    storageWarning = error?.message || 'Persistent storage is unavailable. Changes will last for this session only.';
  }
  memoryMode = true;
  if (!storageWarning) storageWarning = error?.message || 'Persistent storage is unavailable. Changes will last for this session only.';
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('talkready:storage-warning', { detail: { message: storageWarning } }));
  }
}

async function openOfflineDatabase() {
  if (!globalThis.indexedDB) {
    const error = new Error('Persistent offline storage is unavailable in this browser.');
    error.code = 'OFFLINE_STORAGE_UNAVAILABLE';
    throw error;
  }
  if (!databasePromise) {
    databasePromise = openDB(OFFLINE_DATABASE_NAME, OFFLINE_DATABASE_VERSION, {
      upgrade(database) {
        for (const [store, keyPath] of Object.entries({
          questions: 'id',
          meta: 'key',
          interviews: 'id',
          answers: 'id',
          reports: 'id',
          notes: 'id',
          resumes: 'id',
          syncQueue: 'id',
          settings: 'key',
          guest: 'key',
        })) {
          if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath });
        }
      },
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function migrateLegacyData(database) {
  const marker = await database.get(STORES.meta, 'legacyMigrationVersion');
  if (marker?.value === 1) return;

  if (!migrationPromise) {
    migrationPromise = (async () => {
      for (const legacy of legacyDatabases) {
        if (typeof globalThis.indexedDB.databases === 'function') {
          const knownDatabases = await globalThis.indexedDB.databases();
          if (!knownDatabases.some((item) => item.name === legacy.name)) continue;
        }
        const oldDatabase = await openDB(legacy.name, 1);
        try {
          for (const oldStoreName of legacy.stores) {
            if (!oldDatabase.objectStoreNames.contains(oldStoreName)) continue;
            const targetStore = legacy.mapping[oldStoreName] || oldStoreName;
            const records = await oldDatabase.getAll(oldStoreName);
            for (const record of records) {
              let normalized = targetStore === 'meta' && !record.key
                ? { ...record, key: record.id }
                : record;
              if (oldStoreName === 'answerSyncQueue') {
                normalized = {
                  ...record,
                  type: 'answers.submit',
                  localId: record.interviewId,
                  payload: { localId: record.interviewId, answers: [record] },
                  createdAt: record.queuedAt || new Date().toISOString(),
                  attempts: 0,
                  status: 'pending',
                };
              }
              if (scopedStores.has(targetStore)) normalized = { ...normalized, scope: currentScope() };
              if (normalized?.id || normalized?.key) await database.put(targetStore, normalized);
            }
          }
        } finally {
          oldDatabase.close();
        }
      }
      await database.put(STORES.meta, { key: 'legacyMigrationVersion', value: 1 });
    })().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  await migrationPromise;
}

async function getDatabase() {
  const database = await openOfflineDatabase();
  await migrateLegacyData(database);
  return database;
}

async function run(storeName, operation) {
  if (memoryMode) return operation(memoryStores.get(storeName));
  try {
    const database = await getDatabase();
    return await operation(database, storeName);
  } catch (error) {
    if (!storageError(error)) throw error;
    await enableMemoryFallback(error);
    return operation(memoryStores.get(storeName));
  }
}

export function getStorageStatus() {
  return { persistent: !memoryMode, warning: storageWarning };
}

export async function getRecord(storeName, key) {
  return run(storeName, async (database, selectedStore) => {
    const record = database instanceof Map ? database.get(key) : await database.get(selectedStore, key);
    return scopedStores.has(storeName) && record && record.scope !== currentScope() ? undefined : record;
  });
}

export async function getAllRecords(storeName) {
  return run(storeName, async (database, selectedStore) => {
    const records = database instanceof Map ? [...database.values()] : await database.getAll(selectedStore);
    return scopedStores.has(storeName)
      ? records.filter((record) => record.scope === currentScope())
      : records;
  });
}

export async function putRecord(storeName, record) {
  return run(storeName, async (database, selectedStore) => {
    const scopedRecord = scopedStores.has(storeName) ? { ...record, scope: currentScope() } : record;
    if (database instanceof Map) {
      const key = scopedRecord.id ?? scopedRecord.key;
      if (key === undefined) throw new Error(`A key is required to save a record in ${storeName}.`);
      database.set(key, scopedRecord);
      return scopedRecord;
    }
    await database.put(selectedStore, scopedRecord);
    return scopedRecord;
  });
}

export async function deleteRecord(storeName, key) {
  return run(storeName, async (database, selectedStore) => {
    if (database instanceof Map) {
      const record = database.get(key);
      if (scopedStores.has(storeName) && record?.scope !== currentScope()) return false;
      return database.delete(key);
    }
    if (scopedStores.has(storeName)) {
      const record = await database.get(selectedStore, key);
      if (record && record.scope !== currentScope()) return false;
    }
    return database.delete(selectedStore, key);
  });
}

export async function clearStore(storeName) {
  return run(storeName, async (database, selectedStore) => {
    if (database instanceof Map) return database.clear();
    return database.clear(selectedStore);
  });
}

export const offlineStores = STORES;

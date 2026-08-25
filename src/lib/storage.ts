'use client';

import { isStored, type StoredProject } from './persist.ts';

/**
 * Stockage local, dans IndexedDB.
 *
 * `localStorage` ne convient pas : il ne conserve que du texte et plafonne à
 * quelques mégaoctets, quand un seul rush en pèse souvent plusieurs dizaines.
 * IndexedDB stocke des blobs tels quels, sans réencodage en base64.
 *
 * Rien ici ne remonte jamais d'erreur à l'appelant. Une navigation privée, un
 * quota atteint ou un stockage refusé rendent la sauvegarde impossible, pas le
 * montage : perdre la reprise est ennuyeux, perdre la séance de travail en
 * cours parce que le studio a cessé de répondre le serait bien davantage.
 */

const DB_NAME = 'amorce';
const DB_VERSION = 1;
const FILES = 'files';
const PROJECT = 'project';
const PROJECT_KEY = 'current';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
      if (!db.objectStoreNames.contains(PROJECT)) db.createObjectStore(PROJECT);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Une autre fenêtre garde la base ouverte sur une version antérieure : on
    // renonce plutôt que d'attendre indéfiniment sa fermeture.
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

/** Exécute une transaction et renvoie `fallback` si quoi que ce soit échoue. */
async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest,
  fallback: T,
): Promise<T> {
  const db = await openDb();
  if (!db) return fallback;

  return new Promise<T>((resolve) => {
    try {
      const transaction = db.transaction(store, mode);
      const request = action(transaction.objectStore(store));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => resolve(fallback);
      transaction.onabort = () => resolve(fallback);
    } catch {
      resolve(fallback);
    }
  });
}

/** Conserve le fichier d'un média, sous l'identifiant de ce média. */
export async function saveFile(id: string, blob: Blob): Promise<void> {
  await run(FILES, 'readwrite', (s) => s.put(blob, id), undefined);
}

export async function deleteFile(id: string): Promise<void> {
  await run(FILES, 'readwrite', (s) => s.delete(id), undefined);
}

/** Retrouve les fichiers demandés. Ceux qui manquent sont simplement absents. */
export async function loadFiles(ids: string[]): Promise<Map<string, Blob>> {
  const found = new Map<string, Blob>();
  const blobs = await Promise.all(
    ids.map((id) => run<Blob | undefined>(FILES, 'readonly', (s) => s.get(id), undefined)),
  );

  ids.forEach((id, index) => {
    const blob = blobs[index];
    if (blob instanceof Blob) found.set(id, blob);
  });
  return found;
}

/** Écarte les fichiers dont plus aucun média ne se réclame. */
export async function pruneFiles(keep: string[]): Promise<void> {
  const ids = await run<IDBValidKey[]>(FILES, 'readonly', (s) => s.getAllKeys(), []);
  const wanted = new Set(keep);
  await Promise.all(
    ids.filter((id) => typeof id === 'string' && !wanted.has(id)).map((id) => deleteFile(id as string)),
  );
}

export async function saveProject(stored: StoredProject): Promise<void> {
  await run(PROJECT, 'readwrite', (s) => s.put(stored, PROJECT_KEY), undefined);
}

/** Relit le projet conservé, ou `null` s'il n'y en a pas d'exploitable. */
export async function loadProject(): Promise<StoredProject | null> {
  const value = await run<unknown>(PROJECT, 'readonly', (s) => s.get(PROJECT_KEY), null);
  return isStored(value) ? value : null;
}

/** Efface tout : projet et fichiers. */
export async function clearAll(): Promise<void> {
  await run(PROJECT, 'readwrite', (s) => s.clear(), undefined);
  await run(FILES, 'readwrite', (s) => s.clear(), undefined);
}

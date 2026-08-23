import type { MediaAsset } from '../types'

/**
 * Persistance locale du MVP : les vidéos et le projet restent dans le
 * navigateur (IndexedDB). Aucun compte utilisateur, aucun envoi serveur.
 */
const DB_NAME = 'amorce'
const DB_VERSION = 1
const ASSETS = 'assets'
const PROJECT = 'project'
const PROJECT_KEY = 'current'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PROJECT)) db.createObjectStore(PROJECT)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode)
        const request = run(transaction.objectStore(store))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

export async function saveAsset(asset: MediaAsset): Promise<void> {
  await tx(ASSETS, 'readwrite', (s) => s.put(asset))
}

export async function loadAssets(): Promise<MediaAsset[]> {
  try {
    return await tx<MediaAsset[]>(ASSETS, 'readonly', (s) => s.getAll())
  } catch {
    return []
  }
}

export async function deleteAsset(id: string): Promise<void> {
  await tx(ASSETS, 'readwrite', (s) => s.delete(id))
}

export async function saveProject<T>(data: T): Promise<void> {
  await tx(PROJECT, 'readwrite', (s) => s.put(data, PROJECT_KEY))
}

export async function loadProject<T>(): Promise<T | null> {
  try {
    const value = await tx<T | undefined>(PROJECT, 'readonly', (s) => s.get(PROJECT_KEY))
    return value ?? null
  } catch {
    return null
  }
}

export async function clearAll(): Promise<void> {
  await tx(ASSETS, 'readwrite', (s) => s.clear())
  await tx(PROJECT, 'readwrite', (s) => s.clear())
}

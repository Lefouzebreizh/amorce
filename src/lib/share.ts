'use client';

/**
 * Fichiers reçus par le bouton « Partager » d'Android.
 *
 * Le sélecteur de fichiers rend un fichier de zéro octet quand l'entrée choisie
 * vient d'un espace de stockage en ligne — c'est ce qui a rendu l'import d'une
 * voix off impossible pendant toute une soirée. Le partage, lui, transmet les
 * octets réels.
 *
 * Le service worker (`public/sw.js`) dépose ce qu'il reçoit dans une base à
 * part ; ce module la vide côté application. Les deux ne partagent qu'un nom de
 * base et un nom de magasin, volontairement définis en double plutôt que par un
 * import : un worker statique ne peut rien importer d'assemblé.
 */

const DB_NAME = 'amorce-partage';
const STORE = 'recus';

export type SharedFile = { name: string; type: string; blob: Blob };

/**
 * Nombre de fichiers annoncés par la redirection du worker.
 *
 * Le compte sert à savoir s'il faut seulement aller voir : ouvrir la base à
 * chaque démarrage pour la trouver vide coûterait un aller-retour inutile sur
 * un téléphone.
 */
export function sharedCount(search: string): number {
  const value = new URLSearchParams(search).get('partage');
  if (value === null) return 0;

  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

/**
 * Un fichier partagé est-il une vidéo.
 *
 * Le type déclaré prime, mais Android le laisse parfois vide : l'extension
 * tranche alors, faute de quoi un rush arriverait dans la voix off.
 */
export function isVideo(file: { type: string; name: string }): boolean {
  if (file.type.startsWith('video/')) return true;
  if (file.type.startsWith('audio/')) return false;
  return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(file.name);
}

/** Rend un fichier partagé exploitable par les fonctions d'import. */
export function toFile(shared: SharedFile): File {
  return new File([shared.blob], shared.name, { type: shared.type || shared.blob.type });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Stockage local indisponible.'));
  });
}

function promise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Lecture impossible.'));
  });
}

/**
 * Sort les fichiers reçus et vide la réserve.
 *
 * Le vidage est immédiat, dans la même opération que la lecture : un partage
 * relu deux fois importerait le même fichier en double, et l'utilisateur ne
 * comprendrait pas d'où vient le doublon.
 */
export async function drainShared(): Promise<SharedFile[]> {
  const db = await openDb();

  try {
    const read = db.transaction(STORE, 'readonly');
    const received = await promise(read.objectStore(STORE).getAll() as IDBRequest<SharedFile[]>);

    const clear = db.transaction(STORE, 'readwrite');
    await promise(clear.objectStore(STORE).clear());

    return received.filter((file) => file?.blob instanceof Blob && file.blob.size > 0);
  } finally {
    db.close();
  }
}

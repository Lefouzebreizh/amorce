'use client';

import type { Project } from './types.ts';

/**
 * Reprise du travail en cours.
 *
 * Rien n'étant envoyé sur un serveur, un rechargement de page effaçait tout —
 * et sur téléphone, changer d'application suffit : le navigateur libère
 * l'onglet en arrière-plan, et revenir ne reprend pas la page, ça la recharge.
 * On perdait une heure de montage pour avoir répondu à un message.
 *
 * Le montage lui-même n'est que du texte, et se range sans difficulté. Les
 * rushes, eux, tiennent dans IndexedDB, qui sait stocker des fichiers entiers.
 * C'est ce qui distingue cette reprise d'une simple sauvegarde de réglages :
 * sans les fichiers, on rouvrirait un montage dont tous les plans renvoient
 * dans le vide.
 *
 * Deux choses sont volontairement laissées de côté. L'historique d'annulation,
 * dont la conservation coûterait autant que soixante projets pour un service
 * que personne n'attend après un rechargement. Et la garantie : un navigateur
 * fait de la place quand il en manque, et peut effacer ce qu'on lui a confié.
 * La reprise est donc un confort très fiable, jamais une sauvegarde.
 */

const DB_NAME = 'amorce';
const DB_VERSION = 1;
const STORE_PROJET = 'projet';
const STORE_FICHIERS = 'fichiers';

/** Clé unique du projet en cours. Un seul montage à la fois, comme dans l'écran. */
const PROJET_KEY = 'courant';

/**
 * Version du format enregistré.
 *
 * Un projet écrit par une version antérieure du studio peut manquer de champs
 * que le reste du code tient pour acquis. Plutôt que de deviner, on repart d'un
 * projet vierge : perdre une reprise vaut mieux qu'ouvrir un montage à moitié
 * formé dont les défauts n'apparaîtraient qu'à l'export.
 */
const FORMAT = 1;

/** Ce qu'on range : le projet sans ses liens temporaires, plus le format. */
export type SavedProject = { format: number; project: Project };

/**
 * Clé de rangement du fichier d'un élément.
 *
 * Préfixée par nature : les identifiants sont uniques dans leur famille, pas
 * entre familles, et une réplique de voix et un rush pourraient se recouvrir.
 */
export function fileKey(kind: 'asset' | 'voix' | 'bruitage' | 'musique', id: string): string {
  return kind === 'musique' ? 'musique' : `${kind}:${id}`;
}

/** Tous les fichiers auxquels un projet renvoie, avec leur clé de rangement. */
export function fileRefs(project: Project): { key: string; url: string }[] {
  const refs = [
    ...project.assets.map((a) => ({ key: fileKey('asset', a.id), url: a.url })),
    ...project.voices.map((v) => ({ key: fileKey('voix', v.id), url: v.url })),
    ...project.samples.map((s) => ({ key: fileKey('bruitage', s.id), url: s.url })),
  ];
  if (project.music) refs.push({ key: fileKey('musique', ''), url: project.music.url });
  return refs;
}

/**
 * Prépare le projet au rangement.
 *
 * Les liens objets sont vidés : ils ne valent que pour la page qui les a créés,
 * et les conserver ferait rouvrir un montage dont chaque plan pointe vers une
 * adresse morte — l'échec serait silencieux, une image noire sans explication.
 */
export function serializeProject(project: Project): SavedProject {
  return {
    format: FORMAT,
    project: {
      ...project,
      assets: project.assets.map((a) => ({ ...a, url: '' })),
      voices: project.voices.map((v) => ({ ...v, url: '' })),
      samples: project.samples.map((s) => ({ ...s, url: '' })),
      music: project.music ? { ...project.music, url: '' } : null,
    },
  };
}

/**
 * Rebranche un projet rangé sur les fichiers retrouvés.
 *
 * Ce qui n'a pas de fichier disparaît, et avec lui ce qui en dépendait. Un
 * navigateur qui a fait de la place a pu n'effacer qu'une partie de ce qu'on
 * lui avait confié : laisser un plan sans son rush produirait un montage qui
 * s'ouvre normalement et se révèle vide à la lecture.
 */
export function restoreProject(saved: SavedProject, urls: Map<string, string>): Project | null {
  if (saved.format !== FORMAT) return null;

  const project = saved.project;
  const assets = project.assets
    .map((a) => ({ ...a, url: urls.get(fileKey('asset', a.id)) ?? '' }))
    .filter((a) => a.url !== '');
  const keptAssets = new Set(assets.map((a) => a.id));

  const voices = project.voices
    .map((v) => ({ ...v, url: urls.get(fileKey('voix', v.id)) ?? '' }))
    .filter((v) => v.url !== '');
  const samples = project.samples
    .map((s) => ({ ...s, url: urls.get(fileKey('bruitage', s.id)) ?? '' }))
    .filter((s) => s.url !== '');

  const musicUrl = project.music ? urls.get(fileKey('musique', '')) : undefined;
  const keptVoices = new Set(voices.map((v) => v.id));

  return {
    ...project,
    assets,
    clips: project.clips.filter((c) => keptAssets.has(c.assetId)),
    // Un sous-titre issu d'une réplique disparue n'a plus rien qui le prononce.
    captions: project.captions.filter((c) => c.voiceId === undefined || keptVoices.has(c.voiceId)),
    voices,
    samples,
    music: project.music && musicUrl ? { ...project.music, url: musicUrl } : null,
  };
}

/** Vrai si le projet mérite d'être rangé — un montage vierge n'a rien à reprendre. */
export function worthSaving(project: Project): boolean {
  return project.assets.length > 0;
}

// -- Accès au stockage --------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROJET)) db.createObjectStore(STORE_PROJET);
      if (!db.objectStoreNames.contains(STORE_FICHIERS)) db.createObjectStore(STORE_FICHIERS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Stockage local indisponible.'));
  });
}

function promise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Écriture impossible.'));
  });
}

/**
 * Range le projet et les fichiers qui manquent encore.
 *
 * Les fichiers déjà présents ne sont pas réécrits : ce sont des dizaines de
 * mégaoctets, et le projet, lui, est réenregistré à chaque modification.
 */
export async function save(project: Project): Promise<void> {
  const db = await openDb();

  try {
    const known = new Set(
      await promise((db.transaction(STORE_FICHIERS, 'readonly').objectStore(STORE_FICHIERS).getAllKeys() as IDBRequest<IDBValidKey[]>)),
    );

    for (const ref of fileRefs(project)) {
      if (known.has(ref.key) || ref.url === '') continue;
      // Le lien objet désigne un fichier déjà en mémoire : `fetch` ne fait que
      // le relire, rien ne part sur le réseau.
      const blob = await (await fetch(ref.url)).blob();
      const tx = db.transaction(STORE_FICHIERS, 'readwrite');
      await promise(tx.objectStore(STORE_FICHIERS).put(blob, ref.key));
    }

    const wanted = new Set(fileRefs(project).map((r) => r.key));
    for (const key of known) {
      if (wanted.has(key as string)) continue;
      const tx = db.transaction(STORE_FICHIERS, 'readwrite');
      await promise(tx.objectStore(STORE_FICHIERS).delete(key));
    }

    const tx = db.transaction(STORE_PROJET, 'readwrite');
    await promise(tx.objectStore(STORE_PROJET).put(serializeProject(project), PROJET_KEY));
  } finally {
    db.close();
  }
}

/** Relit le dernier projet rangé, ou null s'il n'y en a pas d'exploitable. */
export async function load(): Promise<Project | null> {
  const db = await openDb();

  try {
    const saved = await promise<SavedProject | undefined>(
      db.transaction(STORE_PROJET, 'readonly').objectStore(STORE_PROJET).get(PROJET_KEY),
    );
    if (!saved) return null;

    const store = db.transaction(STORE_FICHIERS, 'readonly').objectStore(STORE_FICHIERS);
    const keys = await promise(store.getAllKeys() as IDBRequest<IDBValidKey[]>);
    const blobs = await promise(store.getAll() as IDBRequest<Blob[]>);

    const urls = new Map<string, string>();
    keys.forEach((key, index) => {
      const blob = blobs[index];
      if (blob) urls.set(String(key), URL.createObjectURL(blob));
    });

    const project = restoreProject(saved, urls);

    // Les liens créés pour des fichiers dont plus rien ne veut sont relâchés
    // tout de suite : les garder retiendrait les fichiers en mémoire.
    if (project) {
      const kept = new Set(fileRefs(project).map((r) => r.url));
      for (const url of urls.values()) if (!kept.has(url)) URL.revokeObjectURL(url);
    } else {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    }

    return project && project.assets.length > 0 ? project : null;
  } finally {
    db.close();
  }
}

/** Efface la reprise. Appelé quand l'utilisateur repart de zéro. */
export async function clear(): Promise<void> {
  const db = await openDb();
  try {
    for (const store of [STORE_PROJET, STORE_FICHIERS]) {
      const tx = db.transaction(store, 'readwrite');
      await promise(tx.objectStore(store).clear());
    }
  } finally {
    db.close();
  }
}

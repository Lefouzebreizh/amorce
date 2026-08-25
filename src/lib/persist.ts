import type { MediaAsset, MusicTrack, Project } from './types.ts';

/**
 * Ce qu'on garde d'un projet entre deux visites.
 *
 * Un montage se perd aujourd'hui au moindre rechargement : les rushes sont
 * réimportés un par un, les coupes refaites, l'accroche réécrite. Comme rien ne
 * part sur un serveur, la sauvegarde tient forcément dans le navigateur.
 *
 * Le partage est net : les **fichiers** vont dans IndexedDB, qui sait stocker un
 * blob de plusieurs dizaines de mégaoctets ; le **projet** est du JSON ordinaire
 * à côté. Ce module ne connaît que le second, ce qui le rend vérifiable hors
 * navigateur — `storage.ts` s'occupe du stockage lui-même.
 *
 * Une URL objet n'est jamais écrite. Elle ne vaut que pour l'onglet qui l'a
 * créée : la conserver produirait au rechargement un média d'apparence intacte
 * dont l'image resterait noire, panne bien plus difficile à comprendre qu'un
 * média manifestement absent.
 */

/** Version du format écrit. L'incrémenter rend caduc tout ce qui précède. */
export const PERSIST_VERSION = 1;

/** Clé réservée à la musique, qui n'a pas d'identifiant propre. */
export const MUSIC_KEY = 'music';

/** Un média tel qu'il est conservé : tout, sauf son URL. */
type StoredAsset = Omit<MediaAsset, 'url'>;
type StoredMusic = Omit<MusicTrack, 'url'>;

export type StoredProject = {
  version: number;
  project: Omit<Project, 'assets' | 'music'> & {
    assets: StoredAsset[];
    music: StoredMusic | null;
  };
};

/** Recopie sans l'URL objet, qui n'aurait aucun sens à la visite suivante. */
function withoutUrl<T extends { url: string }>(value: T): Omit<T, 'url'> {
  // `url` doit devenir facultative pour pouvoir être retirée : le type de départ
  // la déclare obligatoire, et `delete` n'accepte que l'inverse.
  const copy: Omit<T, 'url'> & { url?: string } = { ...value };
  delete copy.url;
  return copy;
}

/** Prépare un projet pour l'écriture, URL objets retirées. */
export function toStored(project: Project): StoredProject {
  const { music, assets, ...rest } = project;
  return {
    version: PERSIST_VERSION,
    project: {
      ...rest,
      assets: assets.map(withoutUrl),
      music: music ? withoutUrl(music) : null,
    },
  };
}

/** Écarte tout ce qui n'a pas la forme attendue, y compris d'une version passée. */
export function isStored(value: unknown): value is StoredProject {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StoredProject>;
  if (candidate.version !== PERSIST_VERSION) return false;
  const project = candidate.project;
  return (
    typeof project === 'object' &&
    project !== null &&
    Array.isArray(project.assets) &&
    Array.isArray(project.clips) &&
    Array.isArray(project.captions) &&
    Array.isArray(project.cues)
  );
}

/**
 * Reconstruit un projet à partir de ce qui a été conservé et des fichiers
 * effectivement retrouvés.
 *
 * Un média dont le fichier manque disparaît, et ses clips avec lui — même règle
 * que `removeAsset` : un clip ne peut pas survivre à la disparition de sa
 * source. Sous-titres et bruitages, eux, ne dépendent d'aucun média et
 * traversent l'opération intacts.
 */
export function fromStored(stored: StoredProject, urls: Map<string, string>): Project {
  const assets: MediaAsset[] = [];
  for (const asset of stored.project.assets) {
    const url = urls.get(asset.id);
    if (url) assets.push({ ...asset, url });
  }

  const kept = new Set(assets.map((a) => a.id));
  const musicUrl = urls.get(MUSIC_KEY);
  const { music, ...rest } = stored.project;

  return {
    ...rest,
    assets,
    clips: stored.project.clips.filter((clip) => kept.has(clip.assetId)),
    music: music && musicUrl ? { ...music, url: musicUrl } : null,
  };
}

/** Identifiants des fichiers qu'un projet a besoin de retrouver. */
export function requiredFiles(stored: StoredProject): string[] {
  const ids = stored.project.assets.map((a) => a.id);
  return stored.project.music ? [...ids, MUSIC_KEY] : ids;
}

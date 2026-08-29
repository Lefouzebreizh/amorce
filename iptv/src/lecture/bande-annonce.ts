// La bande-annonce d'un film, et pourquoi elle n'est pas au même endroit que lui.
//
// **Elle n'existe que pour une source Xtream.** Une liste M3U ne porte qu'un
// titre, une URL et un logo — aucun champ de bande-annonce n'y est prévu, et
// aucun fournisseur n'en invente un. Le panneau Xtream, lui, en déclare une sur
// la fiche du film, sous forme d'identifiant YouTube.
//
// **Et elle se demande à l'ouverture d'une fiche, jamais à l'import.** C'est la
// même décision que pour les épisodes d'une série : `get_vod_info` est un appel
// **par film**, et un catalogue de quarante mille films demanderait quarante
// mille requêtes à un panneau qui en accepte quelques dizaines par minute.
//
// **Le champ ment sur sa forme, et c'est le seul piège du fichier.** Il
// s'appelle `youtube_trailer` et contient selon les panneaux : un identifiant
// nu (`dQw4w9WgXcQ`), une adresse complète, une adresse courte `youtu.be`, une
// adresse d'intégration, ou la chaîne vide — qui veut dire « pas de
// bande-annonce » et non « champ absent ». Le lire sans le normaliser fabrique
// une adresse d'intégration invalide qui ne montre rien, sans erreur.

import type { BrutXtream } from '../ingestion/xtream.ts'
import { texte } from '../domaine/valeurs.ts'

/** Un identifiant YouTube : onze caractères, alphabet des URL. */
const IDENTIFIANT = /^[\w-]{11}$/

/** Les formes d'adresse rencontrées, toutes ramenées à l'identifiant. */
const ADRESSES = [
  /[?&]v=([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
  /youtube\.com\/v\/([\w-]{11})/,
]

/**
 * L'identifiant YouTube d'une bande-annonce, ou `undefined`.
 *
 * Rend l'identifiant et non une adresse : c'est l'interface qui décide comment
 * l'intégrer, et elle est seule à savoir qu'elle doit le faire sur un geste.
 */
export function identifiantBandeAnnonce(brut: BrutXtream): string | undefined {
  // Les panneaux le posent tantôt à la racine, tantôt dans `info` — la même
  // hésitation que pour tous les autres champs de ce protocole sans spec.
  const infos = (
    typeof brut['info'] === 'object' && brut['info'] !== null ? brut['info'] : {}
  ) as BrutXtream

  for (const source of [infos, brut]) {
    const valeur = texte(source['youtube_trailer']) ?? texte(source['trailer'])
    if (valeur === undefined) continue
    const nette = valeur.trim()
    if (nette === '') continue
    if (IDENTIFIANT.test(nette)) return nette
    for (const motif of ADRESSES) {
      const trouve = motif.exec(nette)
      if (trouve?.[1] !== undefined) return trouve[1]
    }
  }
  return undefined
}

/**
 * L'adresse d'intégration, sans les mouchards que YouTube pose par défaut.
 *
 * `youtube-nocookie.com` est le domaine que YouTube publie précisément pour
 * cela : il n'écrit rien tant que la vidéo n'est pas lancée. Ce n'est pas de
 * l'anonymat — c'est le minimum qu'on doit à quelqu'un qui n'a demandé qu'à
 * voir une bande-annonce.
 */
export function adresseIntegration(identifiant: string): string {
  return `https://www.youtube-nocookie.com/embed/${identifiant}?rel=0&modestbranding=1`
}

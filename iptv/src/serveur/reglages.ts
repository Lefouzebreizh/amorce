// Les identifiants, lus une fois et jamais écrits ailleurs.
//
// Ils vivent dans `.env`, qui n'est pas versionné, et ne descendent **jamais**
// en base — c'est la décision posée dans `cache/schema.ts`, et c'est ici
// qu'elle tient : le cache garde l'adresse masquée d'une source, et un réimport
// reçoit les vrais identifiants en argument, depuis ce fichier.
//
// Next charge `.env` tout seul dans l'application. La ligne de commande, non :
// Node ne lit aucun `.env` sans qu'on le lui demande. D'où ce petit lecteur —
// quinze lignes plutôt qu'une dépendance, et qui **n'écrase jamais** une
// variable déjà posée dans l'environnement, sinon un réglage passé à la main
// pour un essai serait silencieusement ignoré.

import { existsSync, readFileSync } from 'node:fs'

import type { IdentifiantsXtream } from '../ingestion/xtream.ts'

export function chargerEnv(chemin = '.env'): void {
  if (!existsSync(chemin)) return
  for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
    const nette = ligne.trim()
    if (nette === '' || nette.startsWith('#')) continue
    const separateur = nette.indexOf('=')
    if (separateur === -1) continue
    const cle = nette.slice(0, separateur).trim()
    if (cle === '' || process.env[cle] !== undefined) continue
    // Les guillemets qui entourent une valeur sont une convention d'écriture,
    // pas une partie du secret : un mot de passe entre guillemets refusé par le
    // serveur est une demi-heure perdue à chercher ailleurs.
    process.env[cle] = nette
      .slice(separateur + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2')
  }
}

/** Rend `undefined` dès qu'un des trois manque : un panneau à moitié réglé n'existe pas. */
export function identifiantsXtream(): IdentifiantsXtream | undefined {
  const serveur = process.env['IPTV_XTREAM_SERVEUR']?.trim()
  const utilisateur = process.env['IPTV_XTREAM_UTILISATEUR']?.trim()
  const motDePasse = process.env['IPTV_XTREAM_MOT_DE_PASSE']?.trim()
  if (
    serveur === undefined || serveur === '' ||
    utilisateur === undefined || utilisateur === '' ||
    motDePasse === undefined || motDePasse === ''
  ) {
    return undefined
  }
  return { serveur, utilisateur, motDePasse }
}

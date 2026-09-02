// Le remuxage : pourquoi un fichier direct ne suffit pas toujours.
//
// **Mesuré le 02/09/2026.** Un film ou un épisode Xtream est presque toujours
// un `.mkv` — et aucun navigateur ne sait ouvrir ce conteneur nativement,
// quel que soit le codec qu'il porte à l'intérieur. Chrome refuse même un
// `.mkv` en H.264 pur, le même flux vidéo qu'il décode sans effort sur
// YouTube : ce n'est pas le codec qui bloque, c'est la boîte Matroska autour.
// Un `.mp4` passe tel quel ; tout le reste doit être reconditionné.
//
// **Reconditionné, pas ré-encodé.** La vidéo se recopie sans y toucher
// (`-c:v copy`) : aucun calcul, aucune perte, et le serveur n'a pas de GPU
// dédié pour ce travail. Seul l'audio est retranscodé, et seulement s'il ne
// l'était pas déjà en AAC/MP3/Opus — l'AC-3 et le MP2, très courants sur ces
// sources, ne se lisent nulle part dans un navigateur.
//
// **Sur fichier, pas en flux — deuxième mesure, le 02/09/2026.** La première
// version diffusait le remuxage au fil de l'eau, sans longueur ni plage
// connues. Deux symptômes, une seule cause : le curseur refusait d'avancer
// au-delà de ce qui avait déjà transité (impossible de se déplacer plus loin
// que quelques secondes), et la durée affichée n'était que ce qui avait été
// reçu jusque-là — quelques dizaines de secondes sur un film d'une heure et
// demie. Un navigateur ne sait faire ni l'un ni l'autre sans connaître la
// taille totale à l'avance. Le fichier complet s'écrit donc d'abord sur
// disque (`donnees/remux/`, jamais versionné), puis se sert avec une vraie
// longueur et un vrai support de `Range` — la lecture native retrouve alors
// son curseur et sa durée exacte. Le prix : la première ouverture d'un titre
// attend que le reconditionnement soit fini avant de démarrer, puisque
// `-c:v copy` ne fait que recopier, ce temps reste proche de celui du
// téléchargement seul. Une deuxième lecture du même titre, elle, démarre
// aussitôt : le fichier est déjà là.
//
// **Un seul à la fois — mesuré à la dure, le 02/09/2026.** Trois titres
// remuxés en même temps (deux films, un épisode) ont fait tomber le serveur
// de développement : chaque remuxage télécharge un film entier au débit
// maximal, et les cumuler sature la machine bien avant que le disque ou le
// réseau ne s'en plaignent poliment. Un second appel pendant qu'un premier
// tourne attend maintenant son tour au lieu de démarrer son propre `ffmpeg`
// — la file vaut aussi pour l'abonnement lui-même, qui limite déjà ses
// connexions simultanées à une ou deux.

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'

const EXTENSION_MP4 = /\.mp4($|\?)/i

/** Faux pour un `.mkv`, un `.avi`, ou tout ce qu'un navigateur ne sait pas ouvrir seul. */
export function necessiteRemuxage(url: string): boolean {
  return !EXTENSION_MP4.test(url)
}

/** Le dossier de cache. Modifiable comme `IPTV_BASE`, pour les mêmes raisons. */
function dossierCache(): string {
  return process.env['IPTV_REMUX'] ?? 'donnees/remux'
}

function cheminCache(id: string): string {
  return join(dossierCache(), `${id}.mp4`)
}

function enTetesFfmpeg(entetes: Record<string, string>): string {
  return Object.entries(entetes)
    .map(([cle, valeur]) => `${cle}: ${valeur}\r\n`)
    .join('')
}

/**
 * Les remuxages en cours, partagés entre requêtes concurrentes du même
 * titre — sans quoi deux onglets ouverts sur le même film lanceraient deux
 * `ffmpeg`. Vit sur `globalThis` : Next recharge ce module à chaque
 * sauvegarde en développement, et une carte de module perdrait le suivi d'un
 * remuxage déjà lancé sans jamais le remplacer.
 */
function enCours(): Map<string, Promise<string>> {
  const cle = Symbol.for('iptv.remux.enCours')
  const portee = globalThis as unknown as Record<symbol, Map<string, Promise<string>> | undefined>
  let carte = portee[cle]
  if (carte === undefined) {
    carte = new Map()
    portee[cle] = carte
  }
  return carte
}

/**
 * La file d'attente d'un seul jeton : tant que personne ne le rend, le
 * suivant patiente. Sur `globalThis` pour la même raison que `enCours`.
 */
function file(): { attente: (() => void)[]; occupe: boolean } {
  const cle = Symbol.for('iptv.remux.file')
  const portee = globalThis as unknown as Record<symbol, { attente: (() => void)[]; occupe: boolean } | undefined>
  let etat = portee[cle]
  if (etat === undefined) {
    etat = { attente: [], occupe: false }
    portee[cle] = etat
  }
  return etat
}

async function jeton(): Promise<() => void> {
  const etat = file()
  if (etat.occupe) {
    await new Promise<void>((resolve) => etat.attente.push(resolve))
  }
  etat.occupe = true
  return () => {
    const suivant = etat.attente.shift()
    if (suivant === undefined) etat.occupe = false
    else suivant()
  }
}

/**
 * Reconditionne une source distante en MP4, une fois, et rend le chemin du
 * fichier en cache. Un appel pendant qu'un premier est déjà en cours attend
 * le même résultat plutôt que d'en lancer un second ; un appel sur un titre
 * différent attend son tour derrière celui qui tourne déjà.
 */
export async function remuxerVersFichier(
  id: string,
  url: string,
  entetes: Record<string, string>,
): Promise<string> {
  const chemin = cheminCache(id)
  if (existsSync(chemin)) return chemin

  const carte = enCours()
  const dejaLance = carte.get(id)
  if (dejaLance !== undefined) return dejaLance

  const tache = (async (): Promise<string> => {
    const liberer = await jeton()
    try {
      return await remuxerMaintenant(url, entetes, chemin)
    } finally {
      liberer()
    }
  })()

  carte.set(id, tache)
  try {
    return await tache
  } finally {
    carte.delete(id)
  }
}

async function remuxerMaintenant(
  url: string,
  entetes: Record<string, string>,
  chemin: string,
): Promise<string> {
  // Un titre déjà mis en cache pendant l'attente en file n'a plus besoin
  // d'être refait — deux onglets ouverts coup sur coup sur le même titre
  // tombent ici l'un après l'autre.
  if (existsSync(chemin)) return chemin

  mkdirSync(dossierCache(), { recursive: true })
  const partiel = `${chemin}.partiel`

  const arguments_ = [
    '-loglevel', 'error',
    ...(Object.keys(entetes).length > 0 ? ['-headers', enTetesFfmpeg(entetes)] : []),
    '-i', url,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ac', '2',
    '-movflags', 'faststart',
    '-f', 'mp4',
    '-y',
    partiel,
  ]

  try {
    await new Promise<void>((resolve, reject) => {
      const processus: ChildProcessWithoutNullStreams = spawn('ffmpeg', arguments_, {
        windowsHide: true,
      })
      let erreur = ''
      processus.stderr.on('data', (bloc: Buffer) => {
        // Gardé en mémoire seulement, jamais journalisé : l'adresse source y
        // apparaît en cas d'échec, et elle porte les identifiants de
        // l'abonnement.
        erreur += bloc.toString('utf8')
      })
      processus.on('error', reject)
      processus.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg a rendu le code ${String(code)}${erreur === '' ? '' : ' (détail retenu, non journalisé)'}`))
      })
    })
  } catch (cause) {
    try {
      unlinkSync(partiel)
    } catch {
      // Rien à nettoyer si le fichier partiel n'a jamais existé.
    }
    throw cause
  }

  renameSync(partiel, chemin)
  return chemin
}

/**
 * Sert un fichier déjà en cache, avec un vrai support de `Range` — c'est ce
 * qui rend le curseur de lecture et la durée fiables, contrairement au flux
 * direct.
 */
export function servirFichierCache(chemin: string, plageDemandee: string | null): Response {
  const taille = statSync(chemin).size

  if (plageDemandee === null) {
    const flux = Readable.toWeb(createReadStream(chemin)) as ReadableStream<Uint8Array>
    return new Response(flux, {
      status: 200,
      headers: {
        'content-type': 'video/mp4',
        'content-length': String(taille),
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      },
    })
  }

  const correspondance = /^bytes=(\d*)-(\d*)$/.exec(plageDemandee)
  const debut = correspondance?.[1] === undefined || correspondance[1] === '' ? 0 : Number.parseInt(correspondance[1], 10)
  const fin =
    correspondance?.[2] === undefined || correspondance[2] === ''
      ? taille - 1
      : Number.parseInt(correspondance[2], 10)

  if (correspondance === null || debut > fin || fin >= taille) {
    return new Response('Plage refusée', {
      status: 416,
      headers: { 'content-range': `bytes */${taille}` },
    })
  }

  const flux = Readable.toWeb(createReadStream(chemin, { start: debut, end: fin })) as ReadableStream<Uint8Array>
  return new Response(flux, {
    status: 206,
    headers: {
      'content-type': 'video/mp4',
      'content-length': String(fin - debut + 1),
      'content-range': `bytes ${debut}-${fin}/${taille}`,
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
    },
  })
}

// Le mandataire de flux : pourquoi il existe, et pourquoi il est signé.
//
// **Pourquoi.** Un flux IPTV est servi par le serveur du fournisseur, qui
// n'envoie presque jamais d'en-tête `Access-Control-Allow-Origin`. Le
// navigateur refuse donc de le lire depuis la page, et la lecture échoue sans
// message utile. Le serveur, lui, n'est pas soumis à cette règle : il relaie.
//
// **Pourquoi signé, et c'est le point important.** Un mandataire qui accepte
// une URL en paramètre est un *proxy ouvert* : n'importe qui peut s'en servir
// pour atteindre, depuis cette machine, un service qu'il ne devrait pas voir —
// le réseau local, les métadonnées d'un hébergeur. C'est une faille classique,
// et elle s'ouvre en une ligne d'inattention.
//
// Deux entrées seulement, donc :
//
// - par **identifiant d'élément**, résolu dans notre propre base : l'appelant
//   ne choisit pas l'adresse, il choisit une entrée du catalogue ;
// - par **URL signée**, que seules les réécritures de manifeste produisent. La
//   signature vient d'un secret propre à l'installation, gardé en base pour
//   survivre à un redémarrage — sinon toute lecture en cours tomberait en 403.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import type { Element } from '../domaine/types.ts'
import { depot } from './depot-partage.ts'

const CLE_SECRET = 'secret_mandataire'

function secret(): string {
  const cache = depot()
  const existant = cache.reglage(CLE_SECRET)
  if (existant !== undefined) return existant
  const neuf = randomBytes(32).toString('base64url')
  cache.poserReglage(CLE_SECRET, neuf)
  return neuf
}

export function signer(url: string): string {
  return createHmac('sha256', secret()).update(url).digest('base64url')
}

export function signatureValide(url: string, signature: string): boolean {
  const attendue = Buffer.from(signer(url))
  const fournie = Buffer.from(signature)
  // Comparaison à temps constant : comparer avec `===` laisse fuiter, par la
  // durée, le nombre de caractères justes. C'est ténu, et c'est gratuit à éviter.
  return attendue.length === fournie.length && timingSafeEqual(attendue, fournie)
}

/** L'adresse que le lecteur demande pour un élément du catalogue. */
export function adresseLecture(element: Pick<Element, 'id'>): string {
  return `/api/flux?e=${encodeURIComponent(element.id)}`
}

function adresseRelayee(url: string): string {
  return `/api/flux?u=${encodeURIComponent(url)}&s=${signer(url)}`
}

/**
 * En-têtes réclamés par la liste elle-même.
 *
 * Certaines listes ne se lisent qu'avec un agent utilisateur précis, et le
 * déclarent par `#EXTVLCOPT:http-user-agent=…`. Les ignorer donne un 403 que
 * rien n'explique — c'est pour cela que l'ingestion conserve ces lignes.
 */
export function entetesDepuisOptions(options: readonly string[]): Record<string, string> {
  const entetes: Record<string, string> = {}
  for (const option of options) {
    const trouve = /^#(?:EXTVLCOPT|EXTHTTP|KODIPROP):\s*(?:http-)?([\w-]+)=(.*)$/i.exec(option)
    const cle = trouve?.[1]?.toLowerCase()
    const valeur = trouve?.[2]
    if (cle === undefined || valeur === undefined) continue
    if (cle === 'user-agent' || cle === 'useragent') entetes['user-agent'] = valeur
    if (cle === 'referrer' || cle === 'referer') entetes['referer'] = valeur
  }
  return entetes
}

/*
 * Le filtre d'adresse : ce que la signature ne dit pas.
 *
 * La signature prouve que l'adresse vient de nous. Elle ne dit **rien** de sa
 * destination — et les adresses du catalogue viennent d'une liste M3U fournie
 * par un tiers. Une entrée pointant sur `http://127.0.0.1:…` ou sur un service
 * du réseau local devenait donc une requête émise par le serveur, dont la
 * réponse repartait au client. Le chemin `?e=<id>` n'exige même pas de
 * signature : il suffit d'un identifiant du catalogue.
 *
 * Ce qui est couvert : le schéma, les adresses littérales privées, locales et
 * de lien-local, en IPv4 comme en IPv6.
 *
 * Ce qui ne l'est pas, et il faut le savoir : un **nom** qui résout vers une
 * adresse privée. Le fermer demanderait une résolution DNS par requête, sur un
 * chemin qui sert chaque segment vidéo — le coût tomberait sur la lecture. Le
 * cas réaliste ici est une liste M3U portant une adresse littérale, et c'est
 * celui-là qui est fermé.
 */
const SCHEMAS = new Set(['http:', 'https:'])

function hoteInterdit(hote: string): boolean {
  const h = hote.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true
  if (h === '::1' || h === '::' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (v4 === null) return false
  const [a, b] = [Number(v4[1]), Number(v4[2])]
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true // lien-local, dont les métadonnées d'hébergeur
  if (a === 100 && b >= 64 && b <= 127) return true // partage d'opérateur
  return false
}

export function adresseRelayable(url: string): boolean {
  let analysee: URL
  try {
    analysee = new URL(url)
  } catch {
    return false
  }
  if (!SCHEMAS.has(analysee.protocol)) return false
  // La seule porte, et elle est réservée aux tests : ceux du délai amont
  // servent une origine sur `127.0.0.1`, qu'il n'y a pas d'autre façon de
  // joindre. Absente de l'environnement, elle laisse le filtre entier — donc
  // rien à faire pour être protégé, et un geste délibéré pour ne plus l'être.
  // Ne jamais la poser en production : elle rouvre exactement le défaut que
  // cette fonction ferme.
  if (process.env['IPTV_RELAI_AUTORISE_LOCAL'] === '1') return true
  return !hoteInterdit(analysee.hostname)
}

const EXTENSION_MANIFESTE = /\.m3u8?($|\?)/i

export function estManifeste(url: string, typeContenu: string | null): boolean {
  if (typeContenu !== null && /mpegurl|x-mpegURL/i.test(typeContenu)) return true
  return EXTENSION_MANIFESTE.test(url)
}

/**
 * Le lecteur en a besoin **avant** toute requête, pour choisir entre hls.js et
 * la lecture native : lui donner un `.mp4` ou un `.mkv` à parser comme un
 * manifeste échoue à coup sûr, image et son perdus ensemble, quel que soit le
 * navigateur. Extension seule, sans requête — le type MIME du fournisseur
 * n'est connu qu'après avoir déjà lancé la lecture.
 */
export function probableManifeste(url: string): boolean {
  return EXTENSION_MANIFESTE.test(url)
}

/**
 * Réécrit un manifeste HLS pour que tout ce qu'il désigne repasse par ici.
 *
 * Relayer le manifeste sans toucher à son contenu ne sert à rien : le lecteur
 * irait ensuite chercher les segments **en direct** chez le fournisseur, et
 * buterait sur le même refus CORS. Trois formes d'adresse y figurent, et les
 * oublier casse un cas sur trois :
 *
 * - les lignes nues, qui désignent un segment ou une variante de qualité ;
 * - les `URI="…"` de `#EXT-X-KEY`, sans quoi un flux chiffré ne démarre pas ;
 * - celles de `#EXT-X-MEDIA` et `#EXT-X-MAP`, c'est-à-dire les pistes audio
 *   séparées — précisément ce qui porte la version française.
 */
export function reecrireManifeste(manifeste: string, base: string): string {
  const absolue = (reference: string): string => {
    try {
      return new URL(reference, base).toString()
    } catch {
      return reference
    }
  }

  return manifeste
    .split('\n')
    .map((ligne) => {
      const nette = ligne.trim()
      if (nette === '') return ligne
      if (nette.startsWith('#')) {
        return ligne.replace(/URI="([^"]+)"/g, (_tout, reference: string) =>
          `URI="${adresseRelayee(absolue(reference))}"`,
        )
      }
      return adresseRelayee(absolue(nette))
    })
    .join('\n')
}

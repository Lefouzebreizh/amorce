// Découper une source en lignes sans jamais la charger entière.
//
// C'est la brique qui décide si le projet tient sa promesse : une liste M3U
// française courante pèse de 50 à 400 Mo. `await reponse.text()` puis
// `.split('\n')` demande deux à trois fois cette taille en mémoire vive — le
// texte, puis le tableau de lignes — et fait tomber le processus avant la
// première entrée analysée. Ici rien n'est retenu au-delà de la ligne en cours.
//
// Le décodage se fait en flux, et c'est ce détail qui a une conséquence
// visible : un « é » occupe deux octets, et rien n'empêche une trame réseau de
// se terminer entre les deux. `TextDecoder` avec `{ stream: true }` garde
// l'octet orphelin pour la trame suivante ; sans lui, un caractère sur
// quelques milliers devient « � » dans les titres.

/** Tout ce qu'on peut lire : une chaîne, un flux Web, un flux Node. */
export type SourceTexte =
  | string
  | AsyncIterable<string | Uint8Array>
  | ReadableStream<Uint8Array>

/**
 * Longueur au-delà de laquelle une « ligne » cesse d'en être une.
 *
 * Une liste M3U valide n'a pas de ligne d'un mégaoctet. Un fichier binaire pris
 * pour une liste, lui, n'a aucun saut de ligne : sans ce plafond, le tampon
 * grandirait jusqu'à la taille du fichier, exactement le défaut que ce module
 * existe pour éviter. Au-delà, on rend le tampon tel quel — l'analyseur le
 * rejettera comme une ligne inconnue — et on repart de zéro.
 */
const LIGNE_MAX = 1 << 20

function estFluxWeb(source: SourceTexte): source is ReadableStream<Uint8Array> {
  return (
    typeof source === 'object' &&
    source !== null &&
    typeof (source as ReadableStream<Uint8Array>).getReader === 'function'
  )
}

async function* morceaux(source: SourceTexte): AsyncGenerator<string | Uint8Array> {
  if (typeof source === 'string') {
    yield source
    return
  }
  if (estFluxWeb(source)) {
    const lecteur = source.getReader()
    try {
      for (;;) {
        const { done, value } = await lecteur.read()
        if (done) return
        if (value !== undefined) yield value
      }
    } finally {
      lecteur.releaseLock()
    }
    return
  }
  yield* source
}

/**
 * Rend les lignes une par une, sans le saut de ligne, `\r` compris.
 *
 * La marque d'ordre des octets est retirée au tout début : une liste exportée
 * depuis Windows en porte souvent une, et elle transformerait `#EXTM3U` en
 * `﻿#EXTM3U`, que l'analyseur ne reconnaîtrait pas — l'en-tête serait
 * perdu, et avec lui l'adresse du guide des programmes.
 */
export async function* lignes(source: SourceTexte): AsyncGenerator<string> {
  const decodeur = new TextDecoder('utf-8')
  let tampon = ''
  let debut = true

  const rendre = function* (brut: string): Generator<string> {
    let ligne = brut
    if (debut) {
      if (ligne.charCodeAt(0) === 0xfeff) ligne = ligne.slice(1)
      debut = false
    }
    yield ligne.endsWith('\r') ? ligne.slice(0, -1) : ligne
  }

  for await (const morceau of morceaux(source)) {
    tampon +=
      typeof morceau === 'string' ? morceau : decodeur.decode(morceau, { stream: true })

    let coupure = tampon.indexOf('\n')
    while (coupure !== -1) {
      yield* rendre(tampon.slice(0, coupure))
      tampon = tampon.slice(coupure + 1)
      coupure = tampon.indexOf('\n')
    }

    if (tampon.length > LIGNE_MAX) {
      yield* rendre(tampon)
      tampon = ''
    }
  }

  tampon += decodeur.decode()
  if (tampon.length > 0) yield* rendre(tampon)
}

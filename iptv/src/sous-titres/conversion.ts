// Amener un fichier de sous-titres jusqu'à ce qu'un navigateur sait lire.
//
// Deux conversions, et la première est celle qu'on oublie.
//
// **L'encodage.** Un `.srt` francophone sur deux n'est pas en UTF-8 : il vient
// d'un outil Windows et il est en windows-1252. Décodé en UTF-8 sans se poser
// la question, « L'été » devient « L'Ã©tÃ© », et le défaut ne se voit que sur
// les accents — donc jamais sur la première ligne, souvent un nom propre.
//
// **Le format.** Aucun navigateur ne lit le SRT. L'élément `<track>` ne connaît
// que le WebVTT, et les deux se ressemblent assez pour qu'on croie qu'un
// renommage suffit : il manque l'en-tête, et les millisecondes s'y écrivent
// avec un point, pas une virgule. Sans ces deux détails, la piste se charge
// sans erreur et n'affiche rien.

/**
 * Décode des octets en essayant l'UTF-8 d'abord, strictement.
 *
 * L'ordre compte : l'UTF-8 en mode strict **lève** sur une séquence invalide,
 * ce qui en fait un test fiable. L'inverse ne marcherait pas — windows-1252
 * accepte n'importe quel octet et ne se plaint jamais, donc il accepterait
 * aussi tout fichier UTF-8, en le massacrant.
 */
export function decoderOctets(octets: Uint8Array): string {
  let texte: string
  try {
    texte = new TextDecoder('utf-8', { fatal: true }).decode(octets)
  } catch {
    texte = new TextDecoder('windows-1252').decode(octets)
  }
  // La marque d'ordre des octets survivrait dans le premier mot affiché.
  return texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte
}

const HORODATAGE =
  /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/

function instant(heures: string, minutes: string, secondes: string, millis: string): string {
  return `${heures.padStart(2, '0')}:${minutes}:${secondes}.${millis.padEnd(3, '0')}`
}

/**
 * Convertit un SRT en WebVTT.
 *
 * Ce que la conversion retire volontairement : les balises de position du
 * style `{\an8}`, propres au SubStation Alpha et que le SRT hérite parfois.
 * Un navigateur les afficherait telles quelles, au milieu du dialogue.
 *
 * Ce qu'elle garde : `<i>`, `<b>` et `<u>`, que le WebVTT connaît.
 */
export function srtVersVtt(srt: string): string {
  const lignes = srt.replace(/\r\n?/g, '\n').split('\n')
  const sortie: string[] = ['WEBVTT', '']

  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i] ?? ''
    const trouve = HORODATAGE.exec(ligne)

    if (trouve === null) {
      // Un numéro de séquence seul : le WebVTT n'en a pas besoin, et un nombre
      // resté là deviendrait un identifiant de cue, ce qui est sans effet mais
      // sale. On le laisse tomber quand la ligne d'après est un horodatage.
      if (/^\d+$/.test(ligne.trim()) && HORODATAGE.test(lignes[i + 1] ?? '')) continue
      sortie.push(nettoyerTexte(ligne))
      continue
    }

    const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = trouve
    if (
      h1 === undefined || m1 === undefined || s1 === undefined || ms1 === undefined ||
      h2 === undefined || m2 === undefined || s2 === undefined || ms2 === undefined
    ) {
      continue
    }
    // Ce qui suit l'horodatage sur la même ligne — des réglages de position —
    // est conservé : le WebVTT en accepte la syntaxe.
    const reste = ligne.slice(trouve.index + trouve[0].length).trim()
    sortie.push(
      `${instant(h1, m1, s1, ms1)} --> ${instant(h2, m2, s2, ms2)}${reste === '' ? '' : ` ${reste}`}`,
    )
  }

  return `${sortie.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

function nettoyerTexte(ligne: string): string {
  return ligne.replace(/\{\\[^}]*\}/g, '')
}

/** Vrai si le contenu est déjà du WebVTT : inutile de le convertir. */
export function estVtt(texte: string): boolean {
  return /^﻿?WEBVTT/.test(texte)
}

/**
 * Le point d'entrée : des octets bruts vers du WebVTT prêt à servir.
 *
 * Rend `undefined` si rien d'exploitable n'en sort — un fichier vide, une page
 * d'erreur HTML servie à la place du sous-titre, une archive ZIP. Mieux vaut
 * dire « pas de sous-titre » que servir une piste qui ne s'affichera pas.
 */
export function versVtt(octets: Uint8Array): string | undefined {
  const texte = decoderOctets(octets)
  if (texte.trim() === '') return undefined
  const vtt = estVtt(texte) ? texte : srtVersVtt(texte)
  // Un WebVTT sans le moindre horodatage n'affichera jamais rien.
  return /-->/.test(vtt) ? vtt : undefined
}

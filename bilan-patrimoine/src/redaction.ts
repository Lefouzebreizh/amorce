// Le texte que la personne lit. C'est le produit.
//
// Tout le reste de ce dossier calcule ; ce fichier-ci décide de ce qui se dit,
// dans quel ordre, et de ce qui se tait. Quatre règles le gouvernent, et
// chacune vient d'une façon connue de rater un bilan.
//
// **1. On ouvre sur ce qui va bien.** Un bilan qui commence par les problèmes
// fait fermer l'onglet — la personne est venue inquiète, elle repart inquiète et
// sans rien avoir lu. Le premier chiffre est donc son patrimoine total, et le
// premier jugement est un encouragement quand il en existe un.
//
// **2. Trois recommandations au plus.** Sept constats vrais valent moins qu'un
// seul suivi. Au-delà de trois, plus personne ne fait rien, et l'outil devient
// une liste de reproches.
//
// **3. Un seul geste à la fin.** Pas trois. Celui qui coûte le moins et rapporte
// le plus, nommé, avec ce qu'il faut pour le faire.
//
// **4. Aucun jargon, aucun produit commercial.** « Arbitrage », « allocation »,
// « support en unités de compte » ne se disent pas. Et l'on renvoie vers des
// dispositifs publics — LEP, plafonds réglementés — jamais vers un contrat
// nommé, qui relèverait du conseil réglementé.

import { VERIFIE_LE, baremesPerimes, tableAVerifier } from './baremes.ts'
import { ETIQUETTES, type Constat, type Patrimoine, type Situation } from './modeles.ts'
import { constater } from './constats.ts'
import { euros, reserve, valoriser } from './valorisation.ts'

/** Au-delà, l'outil devient une liste de reproches et plus personne n'agit. */
export const CONSTATS_MONTRES_MAX = 3

export type Bilan = {
  readonly patrimoine: Patrimoine
  readonly constats: readonly Constat[]
  readonly texte: string
  /** Vrai quand les barèmes n'ont pas été relus : les montants sont alors
   *  absents du texte, et celui-ci le dit. Rien ne doit sortir en production
   *  avec ce drapeau levé. */
  readonly baremesARelire: boolean
}

function phraseTotal(patrimoine: Patrimoine): string {
  if (patrimoine.totalEur <= 0) {
    return "Nous n'avons pas encore assez d'éléments pour faire un total."
  }
  const ouverture = `**Vous avez ${euros(patrimoine.totalEur)}, et vous ne le saviez sans doute pas.**`
  const explication =
    `\n\nC'est le premier chiffre, et il surprend presque tout le monde : on additionne rarement ` +
    `son logement, ses livrets et son épargne dans la même phrase.`
  if (!patrimoine.partiel) return ouverture + explication

  const manquantes = patrimoine.pochesInconnues.map((poche) => ETIQUETTES[poche].toLowerCase()).join(', ')
  return (
    ouverture +
    explication +
    `\n\nCe total est un minimum : vous n'avez rien indiqué pour ${manquantes}. Le vrai chiffre est ` +
    `donc plus élevé, et nous préférons vous annoncer un plancher sûr qu'un total inventé.`
  )
}

function phraseComposition(patrimoine: Patrimoine): string {
  const connues = patrimoine.lignes.filter((ligne) => ligne.montantEur !== null && ligne.montantEur > 0)
  if (connues.length === 0) return ''
  const morceaux = connues.map((ligne) => {
    const detail = ligne.detail === '' ? '' : ` (${ligne.detail})`
    return `- **${ETIQUETTES[ligne.poche]}** : ${euros(ligne.montantEur ?? 0)}${detail}`
  })
  return `\n\n**Ce qui compose ce total :**\n\n${morceaux.join('\n')}`
}

function bloc(constat: Constat, rang: number | null): string {
  const numero = rang === null ? '' : `**${rang}. `
  const fin = rang === null ? '' : '**'
  const titre = rang === null ? `**${constat.titre}**` : `${numero}${constat.titre}${fin}`
  const cout =
    constat.coutAnnuelEur === null
      ? ''
      : `\n\n→ **Environ ${euros(constat.coutAnnuelEur)} par an.**`
  return `${titre}\n\n${constat.explication}${cout}`
}

/**
 * Le premier geste, et un seul.
 *
 * Le constat le plus coûteux n'est pas toujours le plus facile à traiter : le
 * LEP se règle en cinq minutes, une assurance vie se change en plusieurs
 * semaines. À montant comparable, on propose donc ce qui se fait ce week-end —
 * un premier geste réussi vaut mieux qu'un chantier reporté.
 */
function premierGeste(constats: readonly Constat[]): string {
  // L'urgence d'abord, et elle prime sur la facilité : proposer d'ouvrir un LEP
  // à quelqu'un dont le matelas couvre moins de deux mois contredit le constat
  // qu'on vient de lui afficher. Défaut trouvé en lisant un bilan complet.
  const urgent = constats.find((constat) => constat.cle === 'reserve_insuffisante')
  const facile = constats.find((constat) => constat.cle === 'lep_probable')
  const choisi = urgent ?? facile ?? constats.find((constat) => constat.ton !== 'bravo')
  if (choisi === undefined) return ''

  const gestes: Readonly<Record<string, string>> = {
    lep_probable:
      "vérifiez si vous avez droit au LEP. Prenez votre dernier avis d'imposition, regardez la ligne " +
      '« revenu fiscal de référence », et demandez à votre banque. Cinq minutes, une fois.',
    reserve_insuffisante:
      'mettez en place un virement automatique vers votre livret le jour de votre salaire, même petit. ' +
      "Ce qui part tout seul le lendemain de la paie ne manque à personne.",
    assurance_vie_taux_inconnu:
      "retrouvez le relevé annuel de votre assurance vie et notez son taux de rendement. C'est le " +
      'chiffre qui manque pour savoir si votre contrat travaille bien.',
    assurance_vie_sous_moyenne:
      "demandez à votre assureur le rendement servi ces trois dernières années, par écrit. C'est la " +
      'question qui déclenche les réponses utiles.',
    excedent_sans_emploi:
      'notez la somme dont vous êtes sûr de ne pas avoir besoin avant cinq ans. Rien à faire de plus ' +
      "aujourd'hui : c'est le chiffre à connaître avant toute décision.",
    plafond_livrets_depasse:
      'ouvrez votre application bancaire et repérez où est exactement la somme qui dépasse les ' +
      'plafonds. Souvent, elle dort sur le compte courant sans que personne ne le sache.',
    tout_sur_immobilier:
      'vérifiez que votre épargne disponible couvre bien trois mois de dépenses. Avec un patrimoine ' +
      'surtout immobilier, c’est elle qui vous évite un crédit à la consommation au premier imprévu.',
    horizon_lointain_sans_placement:
      "posez-vous une seule question : de quelle part de cette somme êtes-vous certain de ne pas avoir " +
      'besoin avant dix ans ? La réponse change tout le reste.',
  }

  const geste = gestes[choisi.cle]
  if (geste === undefined) return ''
  return `\n\n---\n\n**Si vous ne faites qu'une chose ce mois-ci :** ${geste}`
}

function avertissementBaremes(aujourdhui: Date): string {
  const perimes = baremesPerimes(aujourdhui)
  if (perimes.length === 0) return ''
  return (
    `> ⚠️ **Les taux de référence de cet outil datent du ${VERIFIE_LE} et n'ont pas été revus.** ` +
    `Les constats ci-dessous restent vrais, mais les montants en euros ne sont pas affichés : un ` +
    `taux périmé donnerait un chiffre faux avec l'aplomb d'un chiffre juste.\n\n`
  )
}

export function rediger(situation: Situation, aujourdhui: Date): Bilan {
  const patrimoine = valoriser(situation)
  const constats = constater(situation, aujourdhui)

  const bravos = constats.filter((constat) => constat.ton === 'bravo')
  const problemes = constats.filter((constat) => constat.ton !== 'bravo').slice(0, CONSTATS_MONTRES_MAX)

  const morceaux: string[] = [avertissementBaremes(aujourdhui) + phraseTotal(patrimoine) + phraseComposition(patrimoine)]

  if (bravos.length > 0) {
    morceaux.push(`## Ce qui va bien\n\n${bravos.map((constat) => bloc(constat, null)).join('\n\n')}`)
  }

  if (problemes.length > 0) {
    const titre = problemes.some((constat) => constat.coutAnnuelEur !== null)
      ? 'Ce qui vous coûte, en revanche'
      : 'Ce qui mérite un regard'
    morceaux.push(
      `## ${titre}\n\n${problemes.map((constat, rang) => bloc(constat, rang + 1)).join('\n\n')}`,
    )
  } else if (bravos.length > 0) {
    morceaux.push(
      `## Et le reste ?\n\nNous n'avons rien trouvé qui vous coûte de l'argent inutilement. C'est ` +
        `plus rare qu'on ne croit, et ça se dit.`,
    )
  }

  const geste = premierGeste(problemes)
  if (geste !== '') morceaux.push(geste.trim())

  return {
    patrimoine,
    constats,
    texte: `${morceaux.join('\n\n')}\n`,
    baremesARelire: tableAVerifier(aujourdhui) || baremesPerimes(aujourdhui).length > 0,
  }
}

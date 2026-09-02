// Les règles qui transforment une situation en constats chiffrés.
//
// Une seule idée gouverne ce fichier : **un constat qui ne se chiffre pas ne
// fait rien bouger.** « Votre livret est mal rémunéré » se lit, s'approuve et
// s'oublie ; « ces 15 000 € vous coûtent 285 € par an » fait ouvrir un LEP le
// samedi suivant. Chaque règle doit donc rendre un montant annuel, ou dire
// franchement pourquoi elle ne peut pas.
//
// ─── Les trois refus, hérités du conseiller local ───
//
// **1. Un barème périmé ne se chiffre pas.** La règle sort quand même — le fait
// qualitatif reste vrai — mais sans son montant, et le rapport dit pourquoi.
// Multiplier par un taux de l'an dernier donnerait un manque à gagner faux avec
// l'aplomb d'un chiffre juste, et c'est précisément ce qu'on ne fait pas.
//
// **2. Une donnée absente éteint sa règle**, elle ne la fait pas conclure à
// zéro. Une assurance vie dont on ignore le rendement ne « performe » ni bien
// ni mal : on ne sait pas, et ne pas savoir se dit.
//
// **3. Aucun produit commercial n'est nommé.** On informe, on chiffre, on
// renvoie vers des dispositifs publics — LEP, plafonds réglementés. Recommander
// un contrat par son nom relève du conseil réglementé (statut CIF), et ce n'est
// pas ce que fait cet outil.

import {
  PLAFONDS_EUR,
  PLAFOND_LEP_UNE_PART_EUR,
  bareme,
  baremesPerimes,
} from './baremes.ts'
import type { Constat, Situation } from './modeles.ts'
import { euros, montant, partPct, pourcent, reserve, valoriser } from './valorisation.ts'

/** Au-delà, la poche pèse trop pour que le reste compte. Seuil volontairement
 *  haut : en France, être « trop » en immobilier est la situation normale d'un
 *  propriétaire qui rembourse, et le signaler à 50 % ferait crier au loup chez
 *  presque tout le monde. */
export const PART_IMMOBILIER_ELEVEE_PCT = 75

/** Sous ce montant annuel, on ne dérange pas quelqu'un avec un constat : le
 *  geste à faire coûterait plus de temps que l'économie ne rapporte. */
export const SEUIL_MONTANT_UTILE_EUR = 40

type Contexte = {
  readonly situation: Situation
  readonly perimes: ReadonlySet<string>
}

/** Le taux réellement servi sur l'épargne disponible. Faute de mieux, celui du
 *  Livret A — hypothèse assumée et écrite dans le rapport, parce que c'est là
 *  que dort l'écrasante majorité de l'épargne de précaution française. */
function tauxLivrets(contexte: Contexte): { valeur: number; suppose: boolean } {
  const saisi = contexte.situation.tauxLivretsPct
  if (saisi !== null) return { valeur: saisi, suppose: false }
  return { valeur: bareme('livret_a').valeurPct, suppose: true }
}

/** Chiffre un écart de rendement sur un capital, sauf si l'un des barèmes
 *  utilisés est périmé — auquel cas on rend `null` plutôt qu'un montant faux. */
function coutAnnuel(contexte: Contexte, capital: number, ecartPct: number, cles: readonly string[]): number | null {
  if (cles.some((cle) => contexte.perimes.has(cle))) return null
  return (capital * ecartPct) / 100
}

// ───────────────────────────────────────────────────────────────────────────
// Les règles
// ───────────────────────────────────────────────────────────────────────────

function reserveInsuffisante(contexte: Contexte): Constat | null {
  const etat = reserve(contexte.situation)
  if (etat === null || etat.etat !== 'insuffisante') return null
  const manque = etat.planchereur - etat.disponibleEur
  return {
    cle: 'reserve_insuffisante',
    ton: 'attention',
    titre: 'Votre matelas de sécurité est un peu court',
    explication:
      `Vous avez ${euros(etat.disponibleEur)} disponibles tout de suite, soit environ ` +
      `${etat.moisCouverts.toFixed(1).replace('.', ',')} mois de revenus. La règle qui fait consensus, ` +
      `c'est trois mois — de quoi encaisser une chaudière qui lâche ou un mois sans salaire sans ` +
      `toucher au reste. Il vous manque ${euros(manque)} pour y être.\n\n` +
      `Ce n'est pas une erreur, et surtout pas une urgence : c'est le premier objectif à viser avant ` +
      `de penser à placer quoi que ce soit ailleurs.`,
    // Un risque, pas un coût. Le chiffrer en euros par an serait inventer.
    coutAnnuelEur: null,
    appuiSur: [],
  }
}

function reserveSaine(contexte: Contexte): Constat | null {
  const etat = reserve(contexte.situation)
  if (etat === null || etat.etat !== 'juste') return null
  return {
    cle: 'reserve_saine',
    ton: 'bravo',
    titre: 'Votre matelas de sécurité est au bon niveau',
    explication:
      `Vous avez ${etat.moisCouverts.toFixed(1).replace('.', ',')} mois de revenus disponibles ` +
      `immédiatement. C'est exactement la bonne zone : assez pour absorber un imprévu sans rien ` +
      `casser, pas au point que trop d'argent dorme pour rien. Beaucoup de gens n'y sont pas — ` +
      `ni d'un côté ni de l'autre.`,
    coutAnnuelEur: null,
    appuiSur: [],
  }
}

function epargneQuiDort(contexte: Contexte): Constat | null {
  const etat = reserve(contexte.situation)
  if (etat === null || etat.excedentEur <= 0) return null

  const taux = tauxLivrets(contexte)
  const inflation = bareme('inflation')
  const ecart = inflation.valeurPct - taux.valeur
  if (ecart <= 0) return null

  const cout = coutAnnuel(contexte, etat.excedentEur, ecart, ['inflation', ...(taux.suppose ? ['livret_a'] : [])])
  const hypothese = taux.suppose
    ? ` (nous partons du taux du Livret A, ${pourcent(taux.valeur)}, faute de connaître le vôtre)`
    : ''

  return {
    cle: 'epargne_qui_dort',
    ton: 'coute',
    titre: `${euros(etat.excedentEur)} qui attendent sans raison`,
    explication:
      `Au-delà de vos six mois de sécurité, il vous reste ${euros(etat.excedentEur)} sur des livrets ` +
      `rémunérés ${pourcent(taux.valeur)}${hypothese}. Avec une inflation à ${pourcent(inflation.valeurPct)}, ` +
      `cet argent perd un peu de ce qu'il peut acheter, chaque année.\n\n` +
      `Ce n'est pas dramatique et rien ne brûle. Mais c'est de l'argent qui ne travaille pas pendant ` +
      `que vous, si.`,
    coutAnnuelEur: cout,
    appuiSur: ['inflation', ...(taux.suppose ? ['livret_a'] : [])],
  }
}

function lepProbable(contexte: Contexte): Constat | null {
  const livrets = contexte.situation.livretsEur
  if (livrets === null || livrets <= 0) return null

  // Le formulaire ne demande pas le revenu fiscal de référence — trop
  // intrusif, et personne ne le connaît de tête. On approche par le revenu net
  // annuel, et le constat dit « vérifiez », jamais « vous y avez droit ».
  const revenuAnnuel = contexte.situation.revenuMensuelNetEur * 12
  const parts = contexte.situation.foyer.adultes + contexte.situation.foyer.enfants * 0.5
  if (revenuAnnuel > PLAFOND_LEP_UNE_PART_EUR * parts) return null

  const taux = tauxLivrets(contexte)
  const lep = bareme('lep')
  const ecart = lep.valeurPct - taux.valeur
  if (ecart <= 0) return null

  const capital = Math.min(livrets, PLAFONDS_EUR.lep)
  const cout = coutAnnuel(contexte, capital, ecart, ['lep', ...(taux.suppose ? ['livret_a'] : [])])

  return {
    cle: 'lep_probable',
    ton: 'coute',
    titre: 'Vous avez probablement droit au LEP',
    explication:
      `Le livret d'épargne populaire est réservé aux revenus modestes et rapporte ` +
      `${pourcent(lep.valeurPct)}, contre ${pourcent(taux.valeur)} pour un livret ordinaire. ` +
      `D'après ce que vous avez indiqué, vos revenus sont probablement sous le plafond.\n\n` +
      `Un tiers des foyers qui y ont droit ne l'ont jamais ouvert — souvent parce que personne ne ` +
      `leur en a parlé. Ça se vérifie en cinq minutes avec votre avis d'imposition, et ça se demande ` +
      `à votre banque habituelle.`,
    coutAnnuelEur: cout,
    appuiSur: ['lep', ...(taux.suppose ? ['livret_a'] : [])],
  }
}

function plafondLivretsDepasse(contexte: Contexte): Constat | null {
  const livrets = contexte.situation.livretsEur
  if (livrets === null) return null
  const plafondCumule = PLAFONDS_EUR.livret_a + PLAFONDS_EUR.ldds
  const surplus = livrets - plafondCumule
  if (surplus <= 0) return null

  return {
    cle: 'plafond_livrets_depasse',
    ton: 'attention',
    titre: `${euros(surplus)} sont forcément ailleurs qu'en livret défiscalisé`,
    explication:
      `Le Livret A et le LDDS sont plafonnés à ${euros(plafondCumule)} à eux deux. Vous êtes au-dessus, ` +
      `donc une partie de votre épargne dort sur autre chose — souvent un compte courant, qui ne ` +
      `rapporte rien du tout, ou un livret bancaire dont les intérêts sont imposés.\n\n` +
      `Ça vaut le coup de regarder où est exactement cette somme : c'est le genre de chose qu'on ` +
      `découvre en ouvrant son application bancaire deux minutes.`,
    // Impossible à chiffrer sans savoir où est réellement le surplus. Inventer
    // un taux ici donnerait un montant sérieux et entièrement fabriqué.
    coutAnnuelEur: null,
    appuiSur: [],
  }
}

function assuranceVieSousMoyenne(contexte: Contexte): Constat | null {
  const capital = contexte.situation.assuranceVieEur
  const taux = contexte.situation.tauxAssuranceViePct
  if (capital === null || capital <= 0 || taux === null) return null

  const moyenne = bareme('fonds_euros')
  const ecart = moyenne.valeurPct - taux
  if (ecart <= 0) return null

  return {
    cle: 'assurance_vie_sous_moyenne',
    ton: 'coute',
    titre: 'Votre assurance vie est en dessous de la moyenne',
    explication:
      `Votre contrat a servi ${pourcent(taux)} l'an dernier, quand la moyenne des fonds euros du ` +
      `marché était à ${pourcent(moyenne.valeurPct)}. Sur ${euros(capital)}, l'écart se voit.\n\n` +
      `Un contrat qui décroche n'est pas rattrapable en le laissant faire : les frais et la ` +
      `politique de gestion ne changent pas tout seuls. En revanche, l'ancienneté fiscale d'un ` +
      `contrat se garde — c'est un point à connaître avant de bouger quoi que ce soit.`,
    coutAnnuelEur: coutAnnuel(contexte, capital, ecart, ['fonds_euros']),
    appuiSur: ['fonds_euros'],
  }
}

function assuranceVieTauxInconnu(contexte: Contexte): Constat | null {
  const capital = contexte.situation.assuranceVieEur
  if (capital === null || capital <= 0 || contexte.situation.tauxAssuranceViePct !== null) return null

  const moyenne = bareme('fonds_euros')
  return {
    cle: 'assurance_vie_taux_inconnu',
    ton: 'attention',
    titre: 'Impossible de dire si votre assurance vie tient la route',
    explication:
      `Vous avez ${euros(capital)} en assurance vie, et nous ne savons pas ce qu'elle vous rapporte. ` +
      `C'est le chiffre le plus utile de tout votre patrimoine, et le plus souvent ignoré : la ` +
      `moyenne du marché tourne autour de ${pourcent(moyenne.valeurPct)}, et l'écart entre un bon et ` +
      `un mauvais contrat se compte en centaines d'euros par an.\n\n` +
      `Il est écrit sur votre relevé annuel, celui que l'assureur envoie en début d'année. ` +
      `Cherchez « taux de rendement » ou « performance du fonds en euros ».`,
    coutAnnuelEur: null,
    appuiSur: ['fonds_euros'],
  }
}

function toutSurImmobilier(contexte: Contexte): Constat | null {
  const patrimoine = valoriser(contexte.situation)
  const part = partPct(patrimoine, 'immobilier')
  if (part === null || part < PART_IMMOBILIER_ELEVEE_PCT) return null
  const net = montant(patrimoine, 'immobilier') ?? 0

  return {
    cle: 'tout_sur_immobilier',
    ton: 'attention',
    titre: 'Presque tout votre patrimoine est dans les murs',
    explication:
      `Votre logement représente ${pourcent(part, 0)} de ce que vous possédez, une fois le crédit ` +
      `déduit — soit ${euros(net)}. C'est très courant quand on vient d'acheter, et ce n'est pas une ` +
      `faute.\n\n` +
      `Le point à connaître : un logement ne se vend pas par tranches. Si un imprévu arrive, ce ` +
      `n'est pas là-dedans que vous irez puiser. C'est ce qui rend le reste — le disponible, ` +
      `l'épargne — plus important qu'il n'en a l'air, même pour de petits montants.`,
    coutAnnuelEur: null,
    appuiSur: [],
  }
}

function horizonLointainSansPlacement(contexte: Contexte): Constat | null {
  if (contexte.situation.horizon !== 'retraite') return null
  const patrimoine = valoriser(contexte.situation)
  const place = (montant(patrimoine, 'bourse') ?? 0) + (montant(patrimoine, 'assuranceVie') ?? 0)
  const liquide = montant(patrimoine, 'liquidites') ?? 0
  if (liquide <= 0 || place > liquide * 0.25) return null

  return {
    cle: 'horizon_lointain_sans_placement',
    ton: 'attention',
    titre: 'Vous visez la retraite, et tout votre argent est à court terme',
    explication:
      `Vous avez indiqué que cet argent sert à préparer la retraite. Or il est presque entièrement ` +
      `sur des livrets, c'est-à-dire disponible demain matin — une qualité qui ne sert à rien sur un ` +
      `horizon aussi long, et qui se paie en rendement.\n\n` +
      `Nous ne vous dirons pas quoi acheter : ce n'est pas notre rôle et cela demande un conseiller ` +
      `agréé. Mais le décalage entre « dans vingt ans » et « disponible demain » vaut d'être vu.`,
    // Aucun montant : chiffrer supposerait promettre un rendement futur.
    coutAnnuelEur: null,
    appuiSur: [],
  }
}

/**
 * L'excédent qui n'a pas d'emploi — la règle qu'il a fallu ajouter après coup.
 *
 * `epargneQuiDort` ne se déclenche que si l'inflation dépasse le taux servi,
 * c'est-à-dire quand l'argent **perd** de la valeur. Éprouvée sur un cas réel,
 * elle est restée muette : à 1,7 % contre 1,0 % d'inflation, un Livret A ne
 * grignote rien du tout — et lui faire dire le contraire aurait été faux.
 *
 * Sauf que quatorze mille euros disponibles demain matin, pour un besoin situé
 * dans dix ans, restent un décalage qui mérite d'être vu. Ce n'est simplement
 * pas une perte : c'est une disponibilité qu'on paie sans en avoir l'usage. La
 * règle le dit ainsi, sans montant — chiffrer supposerait promettre un
 * rendement, ce que cet outil ne fait jamais.
 */
function excedentSansEmploi(contexte: Contexte): Constat | null {
  const etat = reserve(contexte.situation)
  if (etat === null || etat.excedentEur <= 0) return null
  if (contexte.situation.horizon !== '10ans' && contexte.situation.horizon !== 'retraite') return null

  const taux = tauxLivrets(contexte)
  const inflation = bareme('inflation')
  // Si l'argent s'érode vraiment, `epargneQuiDort` le dit mieux et avec un
  // montant : on lui laisse la main plutôt que d'afficher deux fois la même
  // chose sous deux angles.
  if (inflation.valeurPct > taux.valeur) return null

  // Deux formulations et non une : « un besoin dans la retraite » ne se dit
  // pas en français, et une phrase qui cloche fait douter de tout le reste.
  const aLecheance = contexte.situation.horizon === 'retraite' ? 'à la retraite' : 'dans une dizaine d’années'
  const echeance = contexte.situation.horizon === 'retraite' ? 'la retraite' : 'une dizaine d’années'
  return {
    cle: 'excedent_sans_emploi',
    ton: 'attention',
    titre: `${euros(etat.excedentEur)} disponibles demain, pour un besoin ${aLecheance}`,
    explication:
      `Bonne nouvelle d'abord : à ${pourcent(taux.valeur)} contre ${pourcent(inflation.valeurPct)} ` +
      `d'inflation, cet argent ne perd rien. Il ne se dévalue pas, contrairement à ce qu'on entend ` +
      `souvent.\n\n` +
      `Le décalage est ailleurs. Au-delà de vos six mois de sécurité, il vous reste ` +
      `${euros(etat.excedentEur)} immédiatement disponibles — une qualité très utile pour un imprévu, ` +
      `et dont vous n'avez pas l'usage pour un projet situé ${aLecheance}. Cette disponibilité se ` +
      `paie, en rendement qu'on ne va pas chercher.`,
    coutAnnuelEur: null,
    appuiSur: ['inflation', ...(taux.suppose ? ['livret_a'] : [])],
  }
}

/**
 * Vous mettez de côté, et plus qu'il n'en faut.
 *
 * Ajoutée après avoir **regardé** un bilan complet plutôt que mesuré : sur une
 * situation pourtant saine, aucun constat positif ne se déclenchait, et le
 * rapport ouvrait donc directement sur les reproches — exactement ce que sa
 * première règle de rédaction interdit.
 *
 * Une réserve excédentaire produit deux vérités, et il faut les deux : cette
 * personne épargne bien (ici), et cet argent n'a pas d'emploi
 * (`excedentSansEmploi`). Ne dire que la seconde donne un outil qui gronde.
 */
function bonneEpargnante(contexte: Contexte): Constat | null {
  const etat = reserve(contexte.situation)
  if (etat === null || etat.etat !== 'excedentaire') return null
  return {
    cle: 'bonne_epargnante',
    ton: 'bravo',
    titre: 'Vous mettez de côté, et sérieusement',
    explication:
      `Vous avez ${euros(etat.disponibleEur)} disponibles, soit ` +
      `${etat.moisCouverts.toFixed(1).replace('.', ',')} mois de revenus devant vous. C'est au-delà ` +
      `des trois à six mois recommandés, et c'est d'abord une bonne nouvelle : vous n'êtes à la merci ` +
      `d'aucun imprévu, et vous avez pris l'habitude de mettre de côté.\n\n` +
      `Ce que nous verrons plus bas ne remet pas ça en cause — il s'agit seulement de donner un ` +
      `emploi à ce qui dépasse.`,
    coutAnnuelEur: null,
    appuiSur: [],
  }
}

const REGLES = [
  reserveInsuffisante,
  reserveSaine,
  bonneEpargnante,
  epargneQuiDort,
  excedentSansEmploi,
  lepProbable,
  plafondLivretsDepasse,
  assuranceVieSousMoyenne,
  assuranceVieTauxInconnu,
  toutSurImmobilier,
  horizonLointainSansPlacement,
] as const

/**
 * Ce qui passe avant l'argent — trouvé en **lisant** un bilan, pas en le mesurant.
 *
 * Le tri par euros seul plaçait « vous avez droit au LEP, 60 € par an » devant
 * « votre matelas de sécurité couvre moins de deux mois », sur le profil d'un
 * couple qui venait d'acheter. Deux choses n'allaient pas, et aucun test ne les
 * voyait :
 *
 * - le conseil était faux dans l'ordre. Une réserve trop mince est un **risque**,
 *   et un risque passe avant une optimisation, quel que soit le montant de
 *   celle-ci ;
 * - le rapport se contredisait tout seul, puisque le constat sur la réserve dit
 *   noir sur blanc qu'il est « le premier objectif à viser avant de penser à
 *   placer quoi que ce soit ailleurs ».
 *
 * D'où ce rang, qui prime sur le montant. Il reste volontairement minuscule :
 * une seule urgence, et tout le reste se trie par ce qu'il coûte.
 */
const URGENCE: Readonly<Record<string, number>> = {
  reserve_insuffisante: 1,
}

function rang(constat: Constat): number {
  return URGENCE[constat.cle] ?? 99
}

/**
 * Tous les constats vrais pour cette situation, dans l'ordre où quelqu'un doit
 * les traiter : l'urgence d'abord, puis ce qui coûte le plus, puis le reste.
 */
export function constater(situation: Situation, aujourdhui: Date): readonly Constat[] {
  const contexte: Contexte = {
    situation,
    perimes: new Set(baremesPerimes(aujourdhui).map((bareme) => bareme.cle)),
  }

  return REGLES.map((regle) => regle(contexte))
    .filter((constat): constat is Constat => constat !== null)
    .filter((constat) => constat.coutAnnuelEur === null || constat.coutAnnuelEur >= SEUIL_MONTANT_UTILE_EUR)
    .sort((a, b) => rang(a) - rang(b) || (b.coutAnnuelEur ?? -1) - (a.coutAnnuelEur ?? -1))
}

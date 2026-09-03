// Ce qui circule d'un module à l'autre.
//
// Tout est en lecture seule (`readonly`), pour la raison qui vaut déjà dans le
// conseiller local : une situation traverse la valorisation, les constats et la
// rédaction, et un objet modifiable au passage finit toujours par être corrigé
// par l'une des trois.
//
// Une distinction porte tout le fichier, et c'est la seule à retenir :
//
//     null   →  on ne sait pas
//     0      →  on sait, et c'est zéro
//
// Les confondre est ce qui rend un bilan de patrimoine dangereux plutôt
// qu'inutile : une poche inconnue comptée pour zéro donne un total plausible,
// donc cru, donc suivi.
//
// Copié depuis bilan-patrimoine/src/modeles.ts (lot 1) pour le lot 2 — voir
// agence/src/lib/bilan/README.md pour l'origine et la marche à suivre en cas
// de mise à jour du lot 1.

/** Les tranches d'âge du formulaire. Une tranche et non une date de naissance :
 *  l'âge exact ne change aucun constat, et le demander coûte de la confiance
 *  pour rien. */
export type TrancheAge = '18-29' | '30-39' | '40-49' | '50-59' | '60+'

/** À quoi sert cet argent, et quand. C'est la seule question du formulaire qui
 *  relève vraiment du conseil : elle décide si vingt mille euros sur un livret
 *  sont une sagesse ou un gâchis. */
export type Horizon = '3ans' | '10ans' | 'retraite' | 'inconnu'

export type Foyer = {
  readonly adultes: 1 | 2
  readonly enfants: number
}

export type Logement = {
  readonly valeurEur: number
  /** Ce qu'il reste à rembourser. Le bien compte en valeur **nette** : le
   *  compter brut écrase les autres poches et rend le bilan illisible tant que
   *  le crédit court. */
  readonly capitalRestantDuEur: number
}

/**
 * Ce que le formulaire collecte, et rien de plus.
 *
 * Aucun nom de banque, aucun numéro de contrat, aucune date d'ouverture : ce
 * qu'on ne collecte pas ne fuite pas, et rien de tout cela ne change un seul
 * constat. Les taux sont **facultatifs** — la personne ne les connaît
 * généralement pas de tête, et les exiger viderait le formulaire de ses
 * répondants. Leur absence ne fait pas taire le bilan : elle éteint seulement
 * les constats qui en dépendent, et le rapport dit lesquels.
 */
export type Situation = {
  readonly age: TrancheAge
  readonly foyer: Foyer
  readonly revenuMensuelNetEur: number
  readonly horizon: Horizon

  readonly livretsEur: number | null
  /** Facultatif. Absent, on suppose le taux du Livret A — c'est là que dort
   *  l'écrasante majorité de l'épargne de précaution française, et l'hypothèse
   *  est écrite dans le rapport plutôt que cachée. */
  readonly tauxLivretsPct: number | null

  readonly assuranceVieEur: number | null
  /** Facultatif, et c'est le champ le plus intéressant du produit : sans lui,
   *  impossible de dire si le contrat décroche de la moyenne du marché. Le
   *  bilan gratuit le dit et explique où le trouver. */
  readonly tauxAssuranceViePct: number | null

  readonly bourseEur: number | null
  readonly logement: Logement | null
}

export const POCHES = ['liquidites', 'assuranceVie', 'bourse', 'immobilier'] as const
export type Poche = (typeof POCHES)[number]

export const ETIQUETTES: Readonly<Record<Poche, string>> = {
  liquidites: 'Épargne disponible',
  assuranceVie: 'Assurance vie',
  bourse: 'Bourse',
  immobilier: 'Immobilier',
}

export type LignePoche = {
  readonly poche: Poche
  /** `null` = non renseigné. Ne compte pas dans le total, ne vaut pas zéro. */
  readonly montantEur: number | null
  /** Détail affichable, déjà mis en français. Vide s'il n'y a rien à préciser. */
  readonly detail: string
}

export type Patrimoine = {
  readonly lignes: readonly LignePoche[]
  readonly totalEur: number
  /** Vrai dès qu'une poche est inconnue : le total est alors un plancher, pas
   *  une valeur, et le rapport doit le dire avant tout le reste. */
  readonly partiel: boolean
  readonly pochesInconnues: readonly Poche[]
}

/** La gravité décide de l'ordre d'affichage à égalité d'euros, et du ton. */
export type Ton = 'bravo' | 'attention' | 'coute'

/**
 * Un constat : une chose vraie sur cette situation, chiffrée quand elle peut
 * l'être.
 *
 * `coutAnnuelEur` est ce qui trie la liste, et c'est délibéré : « votre livret
 * est mal rémunéré » ne fait rien bouger, « ces 15 000 € vous coûtent 285 € par
 * an » fait ouvrir un LEP le samedi suivant. Un constat sans montant reste
 * possible — une réserve trop mince est un risque, pas un coût — mais il passe
 * après ceux qui en portent un.
 */
export type Constat = {
  readonly cle: string
  readonly ton: Ton
  readonly titre: string
  readonly explication: string
  readonly coutAnnuelEur: number | null
  /** Les barèmes utilisés, pour que chaque chiffre reste traçable jusqu'à sa
   *  source officielle. Un montant qu'on ne peut pas justifier ne se montre
   *  pas à quelqu'un qui décide de son argent. */
  readonly appuiSur: readonly string[]
}

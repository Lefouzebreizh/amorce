// Les taux de référence — les huit nombres qui permettent de dire « votre
// argent dort » au lieu de « votre argent est à 1,7 % ».
//
// ─── Pourquoi une table écrite à la main plutôt qu'une API ───
//
// Trois raisons, dans l'ordre où elles comptent.
//
// 1. **Ces nombres bougent une à deux fois par an**, pas à la seconde. Le
//    Livret A est révisé au 1er février et au 1er août ; la moyenne des fonds
//    euros sort une fois l'an. Une API pour huit nombres semestriels serait une
//    dépendance permanente au service d'un besoin qui ne l'est pas.
// 2. **Aucun hôte financier n'est joignable** depuis les sessions distantes de
//    ce dépôt — mesuré : les neuf hôtes de marché refusent le tunnel. Une table
//    versionnée fonctionne partout, y compris là où rien ne répond.
// 3. **Une table se relit en revue.** Un taux faux venu d'une API se propage
//    dans mille bilans sans que personne l'ait vu passer ; un taux faux dans ce
//    fichier saute aux yeux au premier coup d'œil sur un diff.
//
// ─── Le garde-fou, et il n'est pas décoratif ───
//
// Chaque barème porte sa **date d'entrée en vigueur** et sa **prochaine
// révision connue**. `baremesPerimes()` rend ceux dont la révision est passée,
// et la rédaction refuse alors de chiffrer ce qui en dépend — exactement comme
// le conseiller local refuse de conseiller sur un cours périmé. Un taux de 2025
// présenté comme celui d'aujourd'hui ferait calculer un manque à gagner faux,
// avec l'aplomb d'un chiffre juste.

export type Bareme = {
  readonly cle: string
  readonly libelle: string
  readonly valeurPct: number
  /** Depuis quand ce taux s'applique. ISO, et jamais approximatif. */
  readonly enVigueurDepuis: string
  /** Quand il sera revu. Passée cette date, le barème est réputé périmé même
   *  si sa valeur n'a pas changé : on ne sait plus, et ne pas savoir se dit. */
  readonly prochaineRevision: string
  /** L'organisme qui publie ce nombre. Chaque euro affiché à quelqu'un doit
   *  pouvoir remonter jusqu'ici. */
  readonly source: string
}

/**
 * La date à laquelle un humain a relu toute cette table en face des sources
 * officielles.
 *
 * **Ce n'est pas la date du dernier commit** : un fichier peut être touché pour
 * une virgule sans que ses nombres aient été vérifiés. C'est la seule date qui
 * dit « quelqu'un a regardé ».
 */
export const VERIFIE_LE = '2026-09-03'

/**
 * Relues le 3 septembre 2026 face aux quatre sources citées dans le README —
 * Banque de France, arrêté annuel, France Assureurs, INSEE. Le prochain tour
 * est dans le README (§2) : dix minutes, une à deux fois par an.
 */
export const BAREMES: readonly Bareme[] = [
  {
    cle: 'livret_a',
    libelle: 'Livret A',
    valeurPct: 1.7,
    enVigueurDepuis: '2026-08-01',
    prochaineRevision: '2027-02-01',
    source: 'Banque de France — taux réglementé',
  },
  {
    cle: 'ldds',
    libelle: 'LDDS',
    valeurPct: 1.7,
    enVigueurDepuis: '2026-08-01',
    prochaineRevision: '2027-02-01',
    source: 'Banque de France — taux réglementé, aligné sur le Livret A',
  },
  {
    cle: 'lep',
    libelle: "Livret d'épargne populaire",
    valeurPct: 2.5,
    enVigueurDepuis: '2026-08-01',
    prochaineRevision: '2027-02-01',
    source: 'Banque de France — taux réglementé',
  },
  {
    cle: 'pel',
    libelle: "Plan d'épargne logement (plans ouverts depuis 2026)",
    valeurPct: 2.0,
    enVigueurDepuis: '2026-01-01',
    prochaineRevision: '2027-01-01',
    source: 'Arrêté annuel — taux des nouveaux plans',
  },
  {
    cle: 'fonds_euros',
    libelle: 'Fonds euros en assurance vie — moyenne du marché',
    valeurPct: 2.6,
    enVigueurDepuis: '2026-03-26',
    prochaineRevision: '2027-03-01',
    source: 'France Assureurs — rendement moyen servi, net de frais de gestion',
  },
  {
    cle: 'inflation',
    libelle: 'Inflation sur douze mois',
    valeurPct: 2.1,
    enVigueurDepuis: '2026-08-01',
    prochaineRevision: '2026-11-01',
    source: 'INSEE — indice des prix à la consommation, glissement annuel',
  },
]

/** Les plafonds de versement, en euros. Ils bougent beaucoup plus rarement que
 *  les taux, mais un plafond dépassé est un constat à lui seul : au-delà,
 *  l'argent est ailleurs, souvent sur un compte courant à 0 %. */
export const PLAFONDS_EUR = {
  livret_a: 22950,
  ldds: 12000,
  lep: 10000,
} as const

// Typé par ses clés réelles et non par `Record<string, number>` : sous
// `noUncheckedIndexedAccess`, le second rendrait `number | undefined` à chaque
// lecture, et l'on prendrait l'habitude d'écrire `?? 0` — ce qui remplacerait
// un plafond manquant par zéro, donc ferait dépasser tout le monde.

/**
 * Le revenu fiscal de référence sous lequel un foyer d'une part a droit au LEP.
 *
 * Une seule part est retenue à dessein : le formulaire ne demande pas le revenu
 * fiscal de référence, seulement le revenu net mensuel. Le constat qui en
 * découle ne dit donc jamais « vous y avez droit » — il dit « vérifiez, c'est
 * probable », ce qui est vrai et suffisant pour faire agir.
 */
export const PLAFOND_LEP_UNE_PART_EUR = 22419

const index = new Map(BAREMES.map((bareme) => [bareme.cle, bareme]))

export function bareme(cle: string): Bareme {
  const trouve = index.get(cle)
  if (trouve === undefined) {
    // Lever plutôt que rendre zéro : un taux manquant traité comme 0 % ferait
    // apparaître un manque à gagner spectaculaire et entièrement inventé.
    throw new Error(`Barème inconnu : « ${cle} ». Barèmes connus : ${[...index.keys()].join(', ')}.`)
  }
  return trouve
}

/** Ceux dont la révision annoncée est passée. Leur valeur peut être encore
 *  juste — simplement, plus personne ne le sait. */
export function baremesPerimes(aujourdhui: Date): readonly Bareme[] {
  const jour = aujourdhui.toISOString().slice(0, 10)
  return BAREMES.filter((bareme) => bareme.prochaineRevision <= jour)
}

/** Depuis combien de jours la table n'a pas été relue par un humain. */
export function joursDepuisVerification(aujourdhui: Date): number {
  const verifie = Date.parse(`${VERIFIE_LE}T00:00:00Z`)
  return Math.floor((aujourdhui.getTime() - verifie) / 86_400_000)
}

/**
 * Le Livret A se révise tous les six mois. Au-delà de deux cents jours sans
 * relecture, on a forcément raté une révision — la marge de dix-huit jours
 * absorbe un retard de vérification sans crier pour rien.
 */
export const JOURS_AVANT_RELECTURE = 200

export function tableAVerifier(aujourdhui: Date): boolean {
  return joursDepuisVerification(aujourdhui) > JOURS_AVANT_RELECTURE
}

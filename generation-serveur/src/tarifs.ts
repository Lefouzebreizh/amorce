/**
 * Ce qu'une génération coûte, et le veto qui empêche d'en lancer une dont on
 * ignore le prix.
 *
 * **Une table versionnée, pas une API.** C'est la même décision que les taux de
 * `bilan-patrimoine/`, prise pour la même raison : un tarif faux venu d'un
 * appel se propage sans que personne le voie, et un plafond calculé sur un
 * tarif faux ne plafonne rien. Ici la table est en plus le seul endroit où un
 * chiffre en dollars existe, ce qui la rend relisable d'un coup d'œil.
 *
 * **Et elle est vide aujourd'hui, à dessein.** Les cinq hôtes de MiniMax
 * rendent `000` depuis une session distante (`CLAUDE.md` §4) : la grille
 * tarifaire n'a pas pu être lue à sa source. La remplir de mémoire donnerait
 * un plafond qui a l'air de tenir et qui ne tient pas — le pire des deux états.
 * Tant qu'elle est vide, `autorise` refuse tout, et le refus dit pourquoi.
 *
 * Le jour où les prix sont relevés **à leur source**, ils s'écrivent ici avec
 * leur date, et rien d'autre ne change.
 */

/** Ce qu'on demande au fournisseur, dans les termes de la facturation. */
export type Prestation = {
  /** `video` ou `image` — ce que le fournisseur facture séparément. */
  genre: 'video' | 'image';
  /** Le modèle exact, tel que le fournisseur le nomme. */
  modele: string;
  /** Secondes demandées, pour une vidéo. Une image vaut 0. */
  secondes: number;
};

/** Le prix d'une prestation, en dollars, et d'où il vient. */
export type Tarif = {
  genre: Prestation['genre'];
  modele: string;
  /** Dollars par seconde pour une vidéo, par image sinon. */
  prixUnitaire: number;
  /** L'adresse où ce prix a été lu. Jamais « la documentation ». */
  source: string;
  /** Le jour où un humain l'a lu, au format AAAA-MM-JJ. */
  releveLe: string;
};

/**
 * La grille, et son vide est une information.
 *
 * Ne rien y écrire tant qu'un prix n'a pas été lu chez le fournisseur : le
 * plafond du §5 protège de l'argent réel, et une estimation n'est pas une
 * mesure.
 */
export const TARIFS: readonly Tarif[] = [];

/** Le plafond mensuel, en dollars. Tranché par le propriétaire le 08/09/2026. */
export const PLAFOND_MENSUEL = 20;

/**
 * Ce que coûterait cette prestation, ou `null` si son prix n'est pas connu.
 *
 * `grille` n'est pas un paramètre de confort : tant que `TARIFS` est vide, la
 * branche « plafond » de `autorise` ne serait couverte par aucun test, et un
 * garde-fou d'argent qu'aucun test n'éprouve ne garde rien. Les appelants
 * n'ont aucune raison de le passer.
 */
export function cout(prestation: Prestation, grille: readonly Tarif[] = TARIFS): number | null {
  const tarif = grille.find(
    (t) => t.genre === prestation.genre && t.modele === prestation.modele,
  );
  if (!tarif) return null;
  const quantite = prestation.genre === 'video' ? prestation.secondes : 1;
  if (!(quantite > 0)) return null;
  return tarif.prixUnitaire * quantite;
}

/** Pourquoi une génération est refusée. Jamais un booléen nu : la raison se montre. */
export type Refus =
  /** Le prix de cette prestation n'est pas dans la grille. */
  | { motif: 'prix-inconnu'; explication: string }
  /** Le plafond du mois serait dépassé. */
  | { motif: 'plafond'; explication: string; dejaDepense: number; cout: number };

export type Verdict = { autorise: true; cout: number } | { autorise: false; refus: Refus };

/**
 * Le veto, et il passe **avant** tout appel au fournisseur.
 *
 * Deux refus, et le premier compte plus que le second : une prestation dont on
 * ignore le prix ne peut pas être plafonnée, donc elle ne part pas. C'est la
 * forme du bouclier de NexusCrypto — le silence n'est pas un quitus.
 */
export function autorise(
  prestation: Prestation,
  dejaDepense: number,
  grille: readonly Tarif[] = TARIFS,
): Verdict {
  const prix = cout(prestation, grille);
  if (prix === null) {
    return {
      autorise: false,
      refus: {
        motif: 'prix-inconnu',
        explication:
          `Aucun tarif relevé pour ${prestation.genre} « ${prestation.modele} ». ` +
          'Une dépense dont on ignore le montant ne peut pas être plafonnée : ' +
          'relever le prix à sa source et l’écrire dans TARIFS avant de générer.',
      },
    };
  }
  if (dejaDepense + prix > PLAFOND_MENSUEL) {
    return {
      autorise: false,
      refus: {
        motif: 'plafond',
        explication:
          `Le plafond de ${PLAFOND_MENSUEL} $ par mois serait dépassé : ` +
          `${dejaDepense.toFixed(2)} $ déjà dépensés, ${prix.toFixed(2)} $ demandés.`,
        dejaDepense,
        cout: prix,
      },
    };
  }
  return { autorise: true, cout: prix };
}

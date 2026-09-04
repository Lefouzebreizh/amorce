/**
 * Portage de `noyau/intentions.py`. **Le Python fait foi.**
 *
 * Les raisons de chaque décision — pourquoi `faim` et `sortir` ont fusionné,
 * pourquoi `INDECIS` a son propre écran, pourquoi aucun score n'est inventé —
 * sont écrites une seule fois, dans le fichier Python. Les recopier ici
 * créerait deux textes qui divergeraient au premier changement, et c'est
 * exactement ce que le §0 bis appelle un doublon.
 *
 * Ce qui est écrit ici, et seulement ça : ce que le portage ajoute ou risque.
 */

// Objets `as const` et non `enum`, et ce n'est pas un goût de style.
//
// Le dépôt exécute son TypeScript par **simple retrait des types** — la
// convention de `bilan-patrimoine/` et du cœur d'IPTV, qui évite une étape de
// compilation. Or un `enum` n'est pas un type : il produit du code à
// l'exécution, et Node le refuse en clair — `TypeScript enum is not supported
// in strip-only mode`. La forme ci-dessous rend exactement le même usage
// (`Intention.DEMANDE`, `Record<Intention, …>`) en survivant au retrait.
export const Intention = {
  DEMANDE: "demande",
  STRESS: "stress",
  CONTENTEMENT: "contentement",
  INDECIS: "indecis",
} as const;
export type Intention = (typeof Intention)[keyof typeof Intention];

export const Source = {
  MESUREE: "mesuree",
  PROVISOIRE: "provisoire",
  AUCUNE: "aucune",
} as const;
export type Source = (typeof Source)[keyof typeof Source];

export interface Habillage {
  titre: string;
  scene: string;
  sousTitre: string;
}

export const HABILLAGES: Record<Intention, Habillage> = {
  [Intention.DEMANDE]: {
    titre: "« Toi. Viens. »",
    scene:
      "assis bien droit face à l'objectif, lumière chaude de cuisine, " +
      "regard qui ne lâche pas",
    sousTitre: "Je ne dirai pas quoi. Tu vas trouver.",
  },
  [Intention.STRESS]: {
    titre: "« Recule. »",
    scene: "oreilles basses, fond qui se resserre, lumière froide",
    sousTitre: "Là, tout de suite, j'ai besoin d'espace.",
  },
  [Intention.CONTENTEMENT]: {
    titre: "« Reste. »",
    scene: "fourrure en lumière rasante, plan très serré, presque immobile",
    sousTitre: "C'est bien. Ne bouge pas.",
  },
  [Intention.INDECIS]: {
    titre: "« Je n'ai pas compris. »",
    scene: "écran calme, aucune illustration — on ne décore pas un doute",
    sousTitre: "J'ai bien entendu un chat. Mais je ne devine pas plus.",
  },
};

export function habiller(intention: Intention): Habillage {
  return HABILLAGES[intention];
}

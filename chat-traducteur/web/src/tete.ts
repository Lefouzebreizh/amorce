/**
 * Portage de `noyau/tete.py`. **Le Python fait foi**, et il porte trois choses
 * qu'aucun lecteur de ce fichier ne doit deviner : le statut du référentiel
 * (source de vulgarisation, confrontée à sa source le 04/09/2026, jamais
 * validée par une publication), la faute que le bornage aux fenêtres `Meow`
 * empêche, et la raison pour laquelle le grave ne se lit jamais en « douleur ».
 *
 * La confiance plafonnée à 0,5 n'est pas une valeur à ajuster : elle dit que
 * les deux frontières sont des hypothèses. La monter ferait passer une
 * hypothèse pour une mesure.
 */

import { Intention } from "./intentions.ts";
import { aigu, longue, type Traits } from "./traits.ts";
import { fixe0, fixe1 } from "./format.ts";

// `as const` et non `enum` : voir `intentions.ts`, le retrait de types ne
// sait pas exécuter un `enum`.
export const TypeMiaulement = {
  REQUETE: "requete",
  SALUTATION: "salutation",
  ALERTE: "alerte",
  INDETERMINE: "indetermine",
} as const;
export type TypeMiaulement = (typeof TypeMiaulement)[keyof typeof TypeMiaulement];

export interface Lecture {
  type: TypeMiaulement;
  intention: Intention;
  confiance: number;
  raison: string;
}

export const CORRESPONDANCE: Record<TypeMiaulement, Intention> = {
  [TypeMiaulement.REQUETE]: Intention.DEMANDE,       // ne dit jamais *quoi*
  [TypeMiaulement.SALUTATION]: Intention.CONTENTEMENT,
  [TypeMiaulement.ALERTE]: Intention.STRESS,
  [TypeMiaulement.INDETERMINE]: Intention.INDECIS,
};

export const MESURES_MINIMUM = 2;

export function classer(traits: Traits): TypeMiaulement {
  if (traits.hauteur === null || traits.mesuresFiables < MESURES_MINIMUM) {
    return TypeMiaulement.INDETERMINE;
  }
  if (!aigu(traits)) return TypeMiaulement.ALERTE;
  return longue(traits) ? TypeMiaulement.REQUETE : TypeMiaulement.SALUTATION;
}

export function lire(traits: Traits): Lecture {
  const type = classer(traits);
  const intention = CORRESPONDANCE[type];
  if (type === TypeMiaulement.INDETERMINE) {
    return {
      type, intention, confiance: 0,
      raison:
        `Miaulement reconnu, hauteur non mesurable ` +
        `(${traits.mesuresFiables} fenêtre(s) fiable(s)).`,
    };
  }
  const raison =
    `${fixe0(traits.hauteur as number)} Hz sur ${fixe1(traits.duree)} s ` +
    `— ${aigu(traits) ? "aigu" : "grave"}, ` +
    `${longue(traits) ? "long" : "court"} : ${type}.`;
  return { type, intention, confiance: 0.5, raison };
}

/** Fabrique la fonction que `juger` attend sur sa couture. */
export function tetePour(traits: Traits): () => [Intention, number] {
  return () => {
    const lecture = lire(traits);
    return [lecture.intention, lecture.confiance];
  };
}

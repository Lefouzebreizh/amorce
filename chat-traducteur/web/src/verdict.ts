/**
 * Portage de `noyau/verdict.py`. **Le Python fait foi.**
 *
 * Tout ce qui explique ces règles — pourquoi `Cat` ouvre la porte sans jamais
 * choisir, pourquoi `Roaring cats` y est entré le 03/09, pourquoi le repli est
 * `Meow` en dur et non un `max()`, pourquoi la porte prend le maximum sur les
 * fenêtres et jamais la moyenne — est écrit dans le fichier Python, mesures à
 * l'appui. Ne pas le recopier : deux textes divergent, et c'est le moins bon
 * qui se lit une fois sur deux.
 *
 * Ce que ce fichier doit garantir, et que sa jumelle ne peut pas garantir pour
 * lui : **rendre exactement la même chose**, phrase de journal comprise. Les
 * témoins de `tests/conformite.test.ts` en sont juges.
 */

import { Intention, Source } from "./intentions.ts";
import { fixe2 } from "./format.ts";

export const CLASSES_FELINES = [
  "Cat", "Purr", "Meow", "Hiss", "Caterwaul", "Roaring cats (lions, tigers)",
] as const;

export const CLASSES_SPECIFIQUES = ["Purr", "Meow", "Hiss", "Caterwaul"] as const;
// **Une seule depuis le 04/09/2026**, et c'est quarante vrais chats qui l'ont
// décidé — voir le bloc de `CLASSES_PORTEUSES` dans `noyau/verdict.py`, qui
// porte les quatre distributions mesurées. En deux lignes : `Hiss` vaut 0,000
// sur les quarante, et `Caterwaul` s'allume sur n'importe quel miaulement, si
// bien que l'ancienne règle rendait 30 chats sur 40 en « stress ».
export const CLASSES_PORTEUSES = ["Purr"] as const;

export const SEUIL_LECTURE = 0.10;
export const SEUIL_PORTE = 0.20;

// Aucune classe de YAMNet ne porte le stress. Il reste atteignable par la tête
// acoustique, en `PROVISOIRE` — une hypothèse annoncée comme telle.
export const LECTURE_DIRECTE: Record<string, Intention> = {
  Purr: Intention.CONTENTEMENT,
};

export type Fenetre = Record<string, number>;

export interface Verdict {
  intention: Intention;
  source: Source;
  confiance: number;
  raison: string;
  classeDominante: string;
}

export function affichable(v: Verdict): boolean {
  return v.classeDominante !== "";
}

function score(f: Fenetre, classe: string): number {
  return f[classe] ?? 0;
}

function fenetreLaPlusFeline(fenetres: Fenetre[]): [number, number] {
  if (fenetres.length === 0) return [-1, 0];
  let meilleur = 0;
  let meilleurScore = -1;
  for (let i = 0; i < fenetres.length; i++) {
    let s = 0;
    for (const c of CLASSES_FELINES) s += score(fenetres[i], c);
    // `>` strict : à égalité on garde la **première**, comme le `max()` de
    // Python. Un `>=` retiendrait la dernière et ferait diverger le portage
    // sur un enregistrement plat, sans qu'aucun verdict n'ait l'air faux.
    if (s > meilleurScore) { meilleurScore = s; meilleur = i; }
  }
  return [meilleur, meilleurScore];
}

export interface OptionsJuger {
  seuilPorte?: number;
  teteIntention?: () => [Intention, number];
}

export function juger(fenetres: Fenetre[], options: OptionsJuger = {}): Verdict {
  const seuilPorte = options.seuilPorte ?? SEUIL_PORTE;
  const [indice, scoreFelin] = fenetreLaPlusFeline(fenetres);

  // ── Étage 1 : la porte. Un veto, pas une note. ──────────────────────────
  if (indice < 0) {
    return {
      intention: Intention.INDECIS, source: Source.AUCUNE, confiance: 0,
      raison: "Aucune fenêtre analysable : l'enregistrement est trop court.",
      classeDominante: "",
    };
  }
  if (scoreFelin < seuilPorte) {
    return {
      intention: Intention.INDECIS, source: Source.AUCUNE, confiance: 0,
      raison:
        `Aucun son de chat entendu (score félin ${fixe2(scoreFelin)} ` +
        `< ${fixe2(seuilPorte)}) — trop loin du micro, ou couvert par autre chose.`,
      classeDominante: "",
    };
  }

  const fenetre = fenetres[indice];

  let porteuse: string = CLASSES_PORTEUSES[0];
  for (const c of CLASSES_PORTEUSES) {
    if (score(fenetre, c) > score(fenetre, porteuse)) porteuse = c;
  }
  // Le repli est `Meow` **en dur** : voir le Python, qui porte le cas du lion
  // et ce qu'un `max()` sur des scores tous nuls rendait.
  const dominante = score(fenetre, porteuse) >= SEUIL_LECTURE ? porteuse : "Meow";

  // ── Étage 2 : ce que le modèle nomme déjà lui-même. ─────────────────────
  if (dominante in LECTURE_DIRECTE) {
    const s = score(fenetre, dominante);
    return {
      intention: LECTURE_DIRECTE[dominante], source: Source.MESUREE, confiance: s,
      raison: `YAMNet a nommé « ${dominante} » à ${fixe2(s)}.`,
      classeDominante: dominante,
    };
  }

  // ── Étage 2 bis : le miaulement, qui demande la tête acoustique. ────────
  if (!options.teteIntention) {
    return {
      intention: Intention.INDECIS, source: Source.AUCUNE, confiance: 0,
      raison:
        "Miaulement reconnu, mais faim et envie de sortir ne se séparent " +
        "pas sans tête entraînée — voir README, « Ce qui manque ».",
      classeDominante: dominante,
    };
  }

  const [intention, confiance] = options.teteIntention();
  return {
    intention, source: Source.PROVISOIRE, confiance,
    raison: `Tête d'intention sur un « ${dominante} ».`,
    classeDominante: dominante,
  };
}

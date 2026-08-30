import type { Analysis, Criterion, CriterionId } from './analysis.ts';

/**
 * Ce qu'il faut savoir **avant** de fabriquer le fichier.
 *
 * L'analyse existe depuis longtemps, avec ses notes et ses remèdes écrits. Elle
 * vit dans un panneau, et un panneau se referme. Résultat mesuré sur un export
 * réel du 29/08/2026 : un plan d'ouverture de 4,9 s là où l'analyse pénalise
 * au-delà de 3,5 s, et zéro sous-titre là où elle en vise 55 %. **L'application
 * avait diagnostiqué les deux, avec le bon geste, et n'a rien empêché.**
 *
 * C'est le défaut de famille de ce dépôt : une règle écrite, rien qui morde au
 * moment qui compte. La parade est la même que pour le réseau d'annuaires — on
 * met le contrôle sur le chemin que tout le monde emprunte, pas dans l'outil
 * qu'on lance exprès.
 *
 * Ce module ne décide pas d'interdire. Il **nomme**, et il classe.
 */

/**
 * En dessous, un critère mérite d'être dit avant l'export.
 *
 * Même valeur que le seuil de remède du panneau d'analyse : deux seuils pour la
 * même notion, c'est celui qu'on oublie de corriger qui finit par mentir.
 */
export const SEUIL_PRE_VOL = 0.8;

export type Defaut = {
  id: CriterionId;
  label: string;
  detail: string;
  remedy: string;
  /**
   * Les points réellement perdus sur 100.
   *
   * C'est ce qui classe, et non la note brute — un critère à 0,7 qui pèse 30
   * points en coûte 9, quand un critère à 0,5 qui en pèse 5 n'en coûte que
   * 2,5. Trier par la note ferait passer le second devant, et enverrait
   * corriger ce qui ne change presque rien.
   */
  perdus: number;
};

const perdus = (c: Criterion) => Math.round(c.weight * (1 - c.score) * 10) / 10;

/**
 * Les défauts à nommer avant d'exporter, du plus coûteux au moins coûteux.
 *
 * Rendre une liste vide veut dire quelque chose de précis : rien de ce que
 * l'application sait mesurer ne cloche. Ce n'est pas « c'est beau » — elle ne
 * mesure ni le goût, ni le sujet, ni si le plan raconte quoi que ce soit.
 */
export function defautsAvantExport(analysis: Analysis): Defaut[] {
  return analysis.criteria
    .filter((c) => c.score < SEUIL_PRE_VOL)
    .map((c) => ({ id: c.id, label: c.label, detail: c.detail, remedy: c.remedy, perdus: perdus(c) }))
    .sort((a, b) => b.perdus - a.perdus);
}

/**
 * Une phrase pour l'écran, ou rien.
 *
 * Elle dit le nombre et le pire, jamais « votre montage est mauvais ». Le
 * public de ce dépôt est précisément celui que la culpabilisation atteint le
 * plus : on nomme ce qui se corrige, on ne juge pas celui qui a monté.
 */
export function resumeAvantExport(defauts: Defaut[]): string | null {
  if (defauts.length === 0) return null;
  const pire = defauts[0];
  return defauts.length === 1
    ? `Un point à regarder avant d’exporter : ${pire.label.toLowerCase()}.`
    : `${defauts.length} points à regarder avant d’exporter, à commencer par ${pire.label.toLowerCase()}.`;
}

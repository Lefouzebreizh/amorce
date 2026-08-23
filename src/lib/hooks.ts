/**
 * Modèles d'accroches.
 *
 * Les trois premières secondes décident de tout : le spectateur ne choisit pas
 * de regarder, il choisit de ne pas passer. Les formules ci-dessous fonctionnent
 * parce qu'elles ouvrent une boucle que seule la suite referme — une question
 * sans réponse, une promesse chiffrée, une affirmation qui heurte.
 *
 * Les crochets marquent ce qui reste à compléter.
 */

export type HookTemplate = {
  id: string;
  /** Famille d'accroche, affichée comme intitulé de groupe. */
  family: string;
  text: string;
  /** Pourquoi cette formule retient, en une phrase. */
  why: string;
};

export const HOOK_TEMPLATES: HookTemplate[] = [
  {
    id: 'curiosite-fin',
    family: 'Curiosité',
    text: 'Attends la fin 👀',
    why: 'Annonce une récompense différée : partir maintenant, c’est la rater.',
  },
  {
    id: 'curiosite-personne',
    family: 'Curiosité',
    text: 'Personne ne t’a expliqué ça',
    why: 'Suggère un savoir qui te manque, et que tu es sur le point d’obtenir.',
  },
  {
    id: 'curiosite-erreur',
    family: 'Curiosité',
    text: 'Tu fais ça depuis toujours. C’est faux.',
    why: 'Attaque une habitude du spectateur : impossible de ne pas vérifier.',
  },
  {
    id: 'promesse-chiffre',
    family: 'Promesse',
    text: '3 erreurs qui tuent tes vues',
    why: 'Le chiffre borne l’effort demandé et rend la promesse crédible.',
  },
  {
    id: 'promesse-delai',
    family: 'Promesse',
    text: 'En 30 secondes, tu sauras [le faire]',
    why: 'Un coût en temps annoncé et minuscule lève la dernière objection.',
  },
  {
    id: 'conflit-avis',
    family: 'Opinion tranchée',
    text: '[Ce truc] est complètement surcoté',
    why: 'Une position nette provoque l’accord ou la contradiction — donc l’engagement.',
  },
  {
    id: 'conflit-arret',
    family: 'Opinion tranchée',
    text: 'Arrête [de faire ça] tout de suite',
    why: 'L’injonction directe interpelle et implique un danger immédiat.',
  },
  {
    id: 'histoire-jour',
    family: 'Histoire',
    text: 'Le jour où j’ai [tout perdu]',
    why: 'Ouvre un récit : le cerveau réclame la fin d’une histoire commencée.',
  },
  {
    id: 'histoire-avant',
    family: 'Histoire',
    text: 'Avant / après [6 mois]',
    why: 'Promet une transformation visible, la comparaison se regarde jusqu’au bout.',
  },
  {
    id: 'demo-regarde',
    family: 'Démonstration',
    text: 'Regarde ce qui se passe quand [je fais ça]',
    why: 'Désigne l’image elle-même comme la preuve : le texte et le plan se renforcent.',
  },
];

/** Regroupe les modèles par famille, pour l'affichage. */
export function hooksByFamily(): { family: string; templates: HookTemplate[] }[] {
  const families: { family: string; templates: HookTemplate[] }[] = [];
  for (const template of HOOK_TEMPLATES) {
    const existing = families.find((f) => f.family === template.family);
    if (existing) existing.templates.push(template);
    else families.push({ family: template.family, templates: [template] });
  }
  return families;
}

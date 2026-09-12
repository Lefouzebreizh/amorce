// Couche 1 : message figé, jamais généré par le LLM. Toujours affiché en
// entier, identique à chaque déclenchement (le passage à une fonction ci-
// dessous n'y change rien — voir plus bas) — c'est ce qui le rend fiable :
// un texte généré pourrait varier, minimiser, ou omettre un numéro selon
// l'humeur du modèle ce jour-là. NE PAS reformuler sans repasser par Erwann :
// un professionnel de santé mentale doit encore le relire (couche 4,
// TODO.md) avant toute mise en ligne, même en bêta.
//
// Retouches de FORME successives demandées par Erwann, le FOND restant
// délibérément identique et validé : validation sincère sans minimiser,
// transparence sur le statut d'outil non professionnel, distinction claire
// entre le 3114 (soutien, non-urgence) et le 15/112 (danger immédiat).
//
// 12/09/2026, sur "ça va pas bien du tout" : (1) validation et rappel du
// cadre fondus en un seul paragraphe qui s'enchaîne comme une phrase parlée,
// au lieu de blocs séparés façon liste — les deux numéros restent chacun sur
// leur propre ligne, à dessein, pour rester immédiatement repérables et non
// noyés dans un paragraphe dense ; (2) clôture remplacée par une offre de
// présence plutôt qu'une question qui remet la charge sur la personne ; (3)
// ouverture qui ne prétend plus ressentir quelque chose ("ce que tu me dis
// me touche", "tu comptes") — une IA qui affiche une émotion qu'elle
// n'éprouve pas sonne faux et fragilise la confiance au moment où la
// personne est le plus vulnérable.
//
// 12/09/2026, second passage, sur "plus envie de rien" : le message restait
// générique — il validait sans refléter ce que la personne venait de dire,
// donnait tout d'un bloc, et refermait sur une formule plate. Trois
// changements, la transparence et les deux numéros restant à l'identique :
//
// (1) REFLET LITTÉRAL. `construireMessageCrise` prend le motif qui a
// déclenché la couche 1 sur le DERNIER message de la personne (voir
// orchestrer.ts) et l'ancre explicitement dans l'ouverture ("tu dis « X »"),
// au lieu d'une paraphrase abstraite qui pourrait s'appliquer à n'importe
// qui. Le motif cité vient de la liste de `crisisDetection.ts` — un texte
// déjà écrit, relu, sans métacaractère — jamais du texte brut et non borné
// de la personne : reprendre mot pour mot une phrase entière et
// potentiellement très longue romprait la garantie de fiabilité de ce
// fichier (texte figé, jamais généré) pour un gain minime, la personne
// reconnaissant de toute façon ses propres mots dans une liste écrite pour
// coller au francais parlé. Un seul motif ne se prête pas à la citation :
// `MOTIF_NON_CITABLE` ci-dessous, un libellé SYNTHÉTIQUE que
// `crisisDetection.ts` ajoute lui-même pour une CO-OCCURRENCE de deux mots
// distincts (peur + pulsion étrange), jamais une phrase que quelqu'un
// prononce. Le citer produirait une phrase que la personne n'a jamais dite ;
// l'ouverture retombe alors sur la formulation générique de la version
// précédente.
//
// (2) SÉQUENCE, PAS UN BLOC. La phrase de reflet et une question ouverte
// arrivent seules, en premier ; le rappel du cadre puis les deux ressources
// suivent ensuite, dans un paragraphe séparé. Ordre alterné, jamais
// simultané — mais dans UN SEUL message, toujours retourné d'un coup :
// étaler cette séquence sur plusieurs tours de conversation attendrait une
// réponse de la personne avant de donner les ressources, ce que la
// contrainte non négociable d'Erwann interdit explicitement ("rien ne doit
// retarder ni affaiblir le déclenchement des ressources").
//
// (3) CLÔTURE EN QUESTION DE SÉCURITÉ, PAS EN OFFRE DE PRÉSENCE. Ceci
// REVIENT sur le choix du 12/09/2026 ci-dessus ("Je suis là si tu as besoin
// de parler") — à dessein, sur demande explicite d'Erwann : la question
// demandée ("où es-tu, es-tu seul·e ?") n'est pas la question généraliste de
// suivi ("dis-moi comment tu te sens") que la première retouche évitait,
// mais une question d'ancrage/de sécurité, technique reconnue des lignes
// d'écoute de crise pour évaluer un danger immédiat — pas pour faire parler
// la personne de son état général.

// Même chaîne, mot pour mot, que le libellé synthétique de `crisisDetection.ts`
// — copiée plutôt qu'importée : aucun fichier de couche 1 n'importe un autre
// fichier de couche 1 (voir orchestrer.ts, qui explique pourquoi la fonction
// Edge Deno garde sa propre copie de toute cette logique — un import
// transitif sans extension entre deux fichiers tous deux consommés
// directement par Deno casserait cette copie-là). Si l'une change, l'autre
// doit changer avec.
const MOTIF_NON_CITABLE = 'peur de ses propres pulsions inhabituelles';

export function construireMessageCrise(motifRefleteDernierMessage?: string): string {
  const motifCitable =
    motifRefleteDernierMessage && motifRefleteDernierMessage !== MOTIF_NON_CITABLE
      ? motifRefleteDernierMessage
      : undefined;

  const ouverture = motifCitable
    ? `Tu dis « ${motifCitable} », et ce que tu ressens là est réel — tu n'as pas à le porter seul·e. Qu'est-ce qui se passe pour toi, là, maintenant ?`
    : `Ce que tu traverses est réel, et tu n'as pas à le porter seul·e. Qu'est-ce qui se passe pour toi, là, maintenant ?`;

  return `${ouverture}

Je suis un outil d'accompagnement, pas un professionnel, et pour ce que tu vis là il faut vraiment pouvoir en parler à quelqu'un qui peut t'aider pour de vrai.

3114, le numéro national de prévention du suicide : gratuit, confidentiel, 24h/24 et 7j/7, avec des professionnels formés qui écoutent sans jugement.

Si le danger est immédiat, c'est le 15 (SAMU) ou le 112.

Es-tu seul·e en ce moment ? Où es-tu, là ?`;
}

/**
 * Après ce message, la conversation ne reprend JAMAIS son cours normal
 * automatiquement (note d'initialisation, couche 1) : l'appelant doit
 * revérifier explicitement l'état de la personne — par exemple en reposant
 * une question ouverte — avant de repartir sur un accompagnement classique.
 * Si les signaux reviennent, ce même message se réaffiche (avec un reflet
 * mis à jour sur le nouveau dernier message, voir orchestrer.ts).
 */
export const REPRISE_AUTOMATIQUE_INTERDITE = true;

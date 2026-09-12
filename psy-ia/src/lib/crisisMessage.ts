// Couche 1 : message figé, jamais généré par le LLM. Toujours affiché en
// entier, identique à chaque déclenchement — c'est ce qui le rend fiable :
// un texte généré pourrait varier, minimiser, ou omettre un numéro selon
// l'humeur du modèle ce jour-là. NE PAS reformuler sans repasser par Erwann :
// un professionnel de santé mentale doit encore le relire (couche 4,
// TODO.md) avant toute mise en ligne, même en bêta.
//
// Retouche de FORME demandée par Erwann le 12/09/2026, le FOND restant
// délibérément identique et validé par lui sur "ça va pas bien du tout" :
// validation sincère sans minimiser, transparence sur le statut d'outil non
// professionnel, distinction claire entre le 3114 (soutien, non-urgence) et
// le 15/112 (danger immédiat). Trois changements, rien d'autre : (1) la
// validation et le rappel du cadre sont fondus en un seul paragraphe qui
// s'enchaîne comme une phrase parlée, au lieu de blocs séparés façon liste —
// les deux numéros restent chacun sur leur propre ligne, à dessein, pour
// rester immédiatement repérables et non noyés dans un paragraphe dense ;
// (2) la phrase de fin n'est plus une question ("dis-moi comment tu te
// sens") mais une offre de présence, pour ne pas refermer le message en
// remettant la charge sur la personne ; (3) l'ouverture ne prétend plus
// ressentir quelque chose ("ce que tu me dis me touche", "tu comptes") — une
// IA qui affiche une émotion qu'elle n'éprouve pas sonne faux et fragilise
// la confiance au moment où la personne est le plus vulnérable. Elle ouvre
// directement sur la réalité de ce que la personne traverse, jamais sur un
// ressenti déclaré de l'IA.
export const MESSAGE_CRISE = `Ce que tu traverses est réel, et tu n'as pas à le porter seul·e. Je suis un outil d'accompagnement, pas un professionnel, et pour ce que tu vis là il faut vraiment pouvoir en parler à quelqu'un qui peut t'aider pour de vrai.

3114, le numéro national de prévention du suicide : gratuit, confidentiel, 24h/24 et 7j/7, avec des professionnels formés qui écoutent sans jugement.

Si le danger est immédiat, c'est le 15 (SAMU) ou le 112.

Je suis là si tu as besoin de parler.`;

/**
 * Après ce message, la conversation ne reprend JAMAIS son cours normal
 * automatiquement (note d'initialisation, couche 1) : l'appelant doit
 * revérifier explicitement l'état de la personne — par exemple en reposant
 * une question ouverte — avant de repartir sur un accompagnement classique.
 * Si les signaux reviennent, ce même message se réaffiche à l'identique.
 */
export const REPRISE_AUTOMATIQUE_INTERDITE = true;

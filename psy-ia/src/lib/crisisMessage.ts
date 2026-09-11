// Couche 1 : message figé, jamais généré par le LLM. Toujours affiché en
// entier, identique à chaque déclenchement — c'est ce qui le rend fiable :
// un texte généré pourrait varier, minimiser, ou omettre un numéro selon
// l'humeur du modèle ce jour-là. Texte posé mot pour mot dans la note
// d'initialisation du projet. NE PAS reformuler sans repasser par Erwann :
// un professionnel de santé mentale doit encore le relire (couche 4,
// TODO.md) avant toute mise en ligne, même en bêta.
export const MESSAGE_CRISE = `Ce que tu me dis me touche, et je veux que tu saches que tu comptes.
Ce que tu traverses est réel, et tu n'as pas à le porter seul·e.

Je suis un outil d'accompagnement, pas un professionnel — pour ce que
tu vis là, il faut parler à quelqu'un qui peut vraiment t'aider.

3114 — le numéro national de prévention du suicide. Gratuit,
confidentiel, 24h/24, 7j/7. Des professionnels formés t'écoutent,
sans jugement.

Si le danger est immédiat : 15 (SAMU) ou 112.

Je reste là. Dis-moi comment tu te sens, là, maintenant.`;

/**
 * Après ce message, la conversation ne reprend JAMAIS son cours normal
 * automatiquement (note d'initialisation, couche 1) : l'appelant doit
 * revérifier explicitement l'état de la personne — par exemple en reposant
 * une question ouverte — avant de repartir sur un accompagnement classique.
 * Si les signaux reviennent, ce même message se réaffiche à l'identique.
 */
export const REPRISE_AUTOMATIQUE_INTERDITE = true;

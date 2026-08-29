/**
 * Le module de licence, et rien d'autre.
 *
 * `CLAUDE.md` §4 pose l'exception unique à la promesse d'Amorce : un serveur
 * peut connaître **qui a payé**, parce que cela ne se vérifie pas dans le
 * navigateur — une clé posée côté client est lue par le premier qui ouvre les
 * outils de développement.
 *
 * La frontière est stricte et gardée par `src/lib/__tests__/frontiere.test.ts` :
 * aucun média ne transite ici, le moteur de montage n'importe pas ce module, et
 * le studio reste entier serveur éteint. Ce dossier décide de ce que
 * **l'interface propose**, jamais de ce que le moteur fait d'un fichier.
 */

/** Ce qu'on sait de la licence de la personne devant l'écran. */
export type Statut =
  /** Rien n'a encore été demandé, ou le serveur n'a pas répondu. */
  | 'inconnu'
  /** Pas de licence : tout le studio, avec les bornes de l'offre libre. */
  | 'libre'
  /** Licence acquise. */
  | 'pro';

/*
 * Un statut, et rien d'autre.
 *
 * Amorce se vend **une fois**, 49 €, définitivement. Il n'y a donc ni date de
 * fin, ni renouvellement, ni période d'essai à faire expirer — et le type le
 * dit, plutôt que de porter un champ que rien ne remplirait jamais.
 *
 * Le seul retour en arrière possible est un remboursement, et c'est un
 * changement de statut, pas une date : le serveur rend `libre`, et le studio
 * l'apprend au prochain démarrage.
 */
export type Etat = {
  statut: Statut;
};

/**
 * L'état quand on ne sait rien.
 *
 * `inconnu` et non `libre`, et la nuance compte : elle permet à l'interface de
 * dire « je vérifie » au lieu d'annoncer une offre libre qu'elle démentira une
 * seconde plus tard. Pour tout ce qui autorise ou refuse, `inconnu` vaut
 * `libre` — voir `autorise`.
 */
export const ETAT_INITIAL: Etat = { statut: 'inconnu' };

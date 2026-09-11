// Couche 3 de l'architecture de sécurité : limites structurelles de
// session, à l'opposé d'un modèle économique qui chercherait à maximiser le
// temps passé sur l'application (note d'initialisation du projet).
//
// Seuil 1 (discret, non bloquant) : après ~30 minutes de conversation
// continue OU ~15 échanges, un rappel discret évoque l'intérêt d'un vrai
// suivi humain — jamais un mur.
//
// Seuil 2 (ferme) : si la même détresse revient sur PLUSIEURS SESSIONS
// DISTINCTES (pas seulement dans une conversation longue), le ton devient
// nettement plus insistant sur la redirection vers un professionnel. Ce
// module ne calcule pas lui-même cette persistance inter-sessions : elle
// suppose un historique (par exemple les déclenchements de la couche 1,
// journalisés — voir supabase/schema.sql) que l'appelant doit interroger et
// fournir en entrée. Aucune base de données n'est encore branchée ici (voir
// TODO.md) : `detressePersistante` reste, pour l'instant, à calculer côté
// appelant.

const DUREE_SEUIL_1_MS = 30 * 60 * 1000;
const ECHANGES_SEUIL_1 = 15;

export interface EtatSession {
  /** Horodatage (ms epoch) du premier message de la session en cours. */
  demarreeLe: number;
  /** Nombre d'échanges (aller-retour personne/assistant) dans la session en cours. */
  nombreEchanges: number;
  /**
   * Calculé par l'appelant à partir de l'historique inter-sessions de la
   * personne (couche 3, seuil 2) — jamais par ce module, qui ne voit qu'une
   * session à la fois.
   */
  detressePersistanteInterSessions: boolean;
}

export interface EvaluationLimitesSession {
  /** Seuil 1 franchi : afficher un rappel discret, ne rien bloquer. */
  rappelDiscret: boolean;
  /** Seuil 2 franchi : redirection ferme vers un professionnel ou une association. */
  redirectionFerme: boolean;
}

export function evaluerLimitesSession(
  etat: EtatSession,
  maintenant: number = Date.now(),
): EvaluationLimitesSession {
  const dureeEcouleeMs = maintenant - etat.demarreeLe;
  const rappelDiscret = dureeEcouleeMs >= DUREE_SEUIL_1_MS || etat.nombreEchanges >= ECHANGES_SEUIL_1;
  return {
    rappelDiscret,
    redirectionFerme: etat.detressePersistanteInterSessions,
  };
}

// Filet automatique contre l'interruption (coup de fil, changement d'appli,
// onglet déchargé par le téléphone) : garde silencieusement la place de la
// personne dans une démarche, sans mot de passe ni chiffrement — au même
// niveau de sensibilité que les cases de checklist déjà écrites en clair
// dans localStorage par js/engine.js. Le coffre (js/coffre.js) reste le
// mécanisme volontaire, chiffré, pour garder une échéance longtemps ; celui-
// ci n'est qu'une reprise à chaud, effacée dès qu'un coffre prend le relais.
const Brouillon = (() => {
  const CLE = "brouillon.demarche";
  const EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

  function enregistrer({ demarcheId, etapeId, reponses, historique }) {
    try {
      localStorage.setItem(
        CLE,
        JSON.stringify({ demarcheId, etapeId, reponses, historique: historique || [], majLe: Date.now() })
      );
    } catch (e) {
      // pas grave : le pire cas est de perdre la reprise automatique, pas la
      // démarche elle-même, qui continue de fonctionner sans ce filet.
    }
  }

  // Rend le brouillon s'il existe et n'a pas expiré, sinon null — et efface
  // au passage tout ce qui est illisible ou périmé, pour ne jamais proposer
  // une reprise sur des données qu'on n'a pas pu vérifier.
  function lire() {
    let brut;
    try {
      brut = localStorage.getItem(CLE);
    } catch (e) {
      return null;
    }
    if (!brut) return null;

    let donnees;
    try {
      donnees = JSON.parse(brut);
    } catch (e) {
      effacer();
      return null;
    }

    if (!donnees.majLe || Date.now() - donnees.majLe > EXPIRATION_MS) {
      effacer();
      return null;
    }
    return donnees;
  }

  function effacer() {
    try {
      localStorage.removeItem(CLE);
    } catch (e) {
      // rien à faire de plus si le stockage est déjà indisponible
    }
  }

  return { enregistrer, lire, effacer };
})();

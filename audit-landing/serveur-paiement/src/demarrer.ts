import { chargerReglages, creerServeur } from './http.ts';

try {
  const reglages = chargerReglages(process.env);
  const port = Number(process.env.PORT ?? '8788');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Configuration absente ou invalide : PORT');
  }
  // Le reverse proxy local fournit HTTPS ; aucune exposition réseau par défaut.
  const serveur = creerServeur(reglages);
  serveur.once('error', () => {
    console.error('Démarrage impossible : vérifier le port et l’adresse d’écoute');
    process.exitCode = 1;
  });
  serveur.listen(port, process.env.HOST ?? '127.0.0.1', () => {
    console.log('Serveur de paiement démarré en mode test');
  });
  const arreter = () => serveur.close(() => { process.exitCode = 0; });
  process.once('SIGTERM', arreter);
  process.once('SIGINT', arreter);
} catch (erreur) {
  // Les erreurs de configuration ne contiennent que le nom du réglage.
  console.error(erreur instanceof Error ? erreur.message : 'Configuration invalide');
  process.exitCode = 1;
}

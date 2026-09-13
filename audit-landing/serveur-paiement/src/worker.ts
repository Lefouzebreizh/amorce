import { traiter } from './index.ts';

/**
 * Adaptateur Cloudflare : les décisions de paiement restent dans `index.ts`,
 * afin d'être testées sans réseau ni compte Cloudflare. Ce fichier ne fait
 * que lire les réglages fournis par le Worker au moment de la requête.
 */
type Environnement = {
  CLE_SECRETE_STRIPE: string;
  ID_PRIX_STRIPE: string;
  SECRET_WEBHOOK: string;
  JETON_DECLENCHEMENT: string;
  DEPOT_DECLENCHEMENT: string;
  ORIGINES: string;
  URL_SUCCES: string;
  URL_ANNULATION: string;
};

function liste(valeur: string | undefined): string[] {
  return (valeur ?? '')
    .split(',')
    .map((element) => element.trim())
    .filter(Boolean);
}

const worker = {
  fetch(requete: Request, env: Environnement): Promise<Response> {
    return traiter(requete, {
      cleSecreteStripe: env.CLE_SECRETE_STRIPE ?? '',
      idPrixStripe: env.ID_PRIX_STRIPE ?? '',
      secretWebhook: env.SECRET_WEBHOOK ?? '',
      jetonDeclenchement: env.JETON_DECLENCHEMENT ?? '',
      depotDeclenchement: env.DEPOT_DECLENCHEMENT ?? '',
      origines: liste(env.ORIGINES),
      urlSucces: env.URL_SUCCES ?? '',
      urlAnnulation: env.URL_ANNULATION ?? '',
    });
  },
};

export default worker;

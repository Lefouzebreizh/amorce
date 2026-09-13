import { createServer, type IncomingMessage } from 'node:http';
import { traiter, type Reglages } from './index.ts';

export const LIMITE_CORPS = 64 * 1024;

/** Ne jamais insérer les valeurs d'environnement dans une erreur. */
export function chargerReglages(env: NodeJS.ProcessEnv): Reglages {
  const lire = (nom: string): string => {
    const valeur = env[nom]?.trim();
    if (!valeur) throw new Error(`Configuration absente ou invalide : ${nom}`);
    return valeur;
  };
  const adresse = (nom: string): string => {
    const valeur = lire(nom);
    try {
      const url = new URL(valeur);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    } catch {
      throw new Error(`Configuration absente ou invalide : ${nom}`);
    }
    return valeur;
  };
  const cleSecreteStripe = lire('STRIPE_SECRET_KEY');
  // Ce premier adaptateur est réservé à la validation test du pilote.
  if (!/^(?:rk|sk)_test_\S+$/.test(cleSecreteStripe)) {
    throw new Error('Configuration absente ou invalide : STRIPE_SECRET_KEY (mode test requis)');
  }
  const idPrixStripe = lire('STRIPE_PRICE_ID');
  if (!/^price_\S+$/.test(idPrixStripe)) throw new Error('Configuration absente ou invalide : STRIPE_PRICE_ID');
  const secretWebhook = lire('STRIPE_WEBHOOK_SECRET');
  if (!/^whsec_\S+$/.test(secretWebhook)) throw new Error('Configuration absente ou invalide : STRIPE_WEBHOOK_SECRET');
  const secret = lire('AUDIT_RECEPTION_SECRET');
  if (secret.length < 32) throw new Error('Configuration absente ou invalide : AUDIT_RECEPTION_SECRET');
  const origines = lire('AUDIT_ORIGINES').split(',').map((valeur) => valeur.trim());
  if (origines.some((origine) => {
    try {
      const url = new URL(origine);
      return url.protocol !== 'https:' || url.origin !== origine;
    } catch { return true; }
  })) throw new Error('Configuration absente ou invalide : AUDIT_ORIGINES');
  return {
    cleSecreteStripe, idPrixStripe, secretWebhook, origines,
    urlSucces: adresse('AUDIT_URL_SUCCES'),
    urlAnnulation: adresse('AUDIT_URL_ANNULATION'),
    receptionCommandes: { url: adresse('AUDIT_RECEPTION_URL'), secret },
  };
}

class CorpsTropGrand extends Error {}

function lireCorps(requete: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let taille = 0;
    const morceaux: Buffer[] = [];
    const nettoyer = () => {
      requete.off('data', donnees);
      requete.off('end', termine);
      requete.off('error', echoue);
      requete.off('aborted', abandonne);
    };
    const echoue = (erreur: Error) => { nettoyer(); reject(erreur); };
    const abandonne = () => echoue(new Error('Requête interrompue'));
    const donnees = (morceau: Buffer) => {
      taille += morceau.length;
      if (taille > LIMITE_CORPS) {
        echoue(new CorpsTropGrand());
        // Finir la réponse 413 sans conserver le corps restant en mémoire.
        requete.resume();
      } else morceaux.push(morceau);
    };
    const termine = () => { nettoyer(); resolve(Buffer.concat(morceaux)); };
    requete.on('data', donnees);
    requete.once('end', termine);
    requete.once('error', echoue);
    requete.once('aborted', abandonne);
  });
}

/** HTTP local derrière un reverse proxy HTTPS. Aucun écouteur à l'import. */
export function creerServeur(reglages: Reglages) {
  const serveur = createServer(async (requete, reponse) => {
    try {
      const url = new URL(requete.url ?? '/', 'http://localhost');
      if (requete.method === 'GET' && url.pathname === '/health') {
        reponse.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        reponse.end(JSON.stringify({ statut: 'ok', mode: 'test' }));
        return;
      }
      const corps = await lireCorps(requete);
      const entetes = new Headers();
      for (let i = 0; i < requete.rawHeaders.length; i += 2) {
        entetes.append(requete.rawHeaders[i], requete.rawHeaders[i + 1]);
      }
      const methode = requete.method ?? 'GET';
      const request = new Request(url, {
        method: methode,
        headers: entetes,
        // Préserver les octets signés : aucune désérialisation JSON ici.
        body: methode === 'GET' || methode === 'HEAD' ? undefined : new Uint8Array(corps),
      });
      const resultat = await traiter(request, reglages);
      const contenu = Buffer.from(await resultat.arrayBuffer());
      reponse.statusCode = resultat.status;
      resultat.headers.forEach((valeur, nom) => reponse.setHeader(nom, valeur));
      reponse.setHeader('cache-control', 'no-store');
      reponse.end(contenu);
    } catch (erreur) {
      if (reponse.headersSent || reponse.destroyed) return;
      const tropGrand = erreur instanceof CorpsTropGrand;
      reponse.writeHead(tropGrand ? 413 : 500, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'connection': 'close',
      });
      reponse.end(JSON.stringify({ erreur: tropGrand ? 'corps trop volumineux' : 'service temporairement indisponible' }));
    }
  });
  serveur.requestTimeout = 30_000;
  serveur.headersTimeout = 10_000;
  return serveur;
}

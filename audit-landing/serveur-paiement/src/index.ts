import { signatureValide } from './signature.ts';

/** Serveur Checkout et webhook Stripe.
 * Après vérification du paiement, transmet la commande à une réception HTTPS
 * qui l'enregistre durablement. Aucun repository_dispatch dans cette version.
 * Le traitement et la livraison sont assurés séparément sur stockage persistant.
 */

export type Reglages = {
  /** Réception HTTPS sur disque persistant ; vide : livraison durable indisponible. */
  receptionCommandes?: { url: string; secret: string };
  /** Clé secrète Stripe (test ou live selon le déploiement) — jamais committée. */
  cleSecreteStripe: string;
  /**
   * ID du prix Stripe (`price_...`) du produit. **Vide par défaut, à
   * dessein** — même décision que `TARIFS` dans `generation-serveur/` et
   * `PACKS` dans `comptes-serveur/` : le prix n'est pas encore décidé par le
   * propriétaire, et l'inventer donnerait un veto qui a l'air de tenir.
   * Tant qu'il est vide, `/creer-session` refuse plutôt que de créer une
   * session à un prix inventé.
   */
  idPrixStripe: string;
  /** Secret de signature du webhook Stripe. */
  secretWebhook: string;
  /** Origines autorisées à appeler `/creer-session` depuis un navigateur. */
  origines: string[];
  urlSucces: string;
  urlAnnulation: string;
  /** Point d'injection pour les tests : remplace l'appel réseau à Stripe et à GitHub. */
  fetch?: typeof fetch;
};

const JSON_ENTETES = { 'content-type': 'application/json; charset=utf-8' };

function entetesOrigine(requete: Request, origines: string[]): Record<string, string> {
  const origine = requete.headers.get('Origin');
  if (!origine || !origines.includes(origine)) return {};
  return { 'access-control-allow-origin': origine, 'vary': 'Origin' };
}

function erreur(message: string, status: number, partage: Record<string, string>): Response {
  return new Response(JSON.stringify({ erreur: message }), {
    status,
    headers: { ...JSON_ENTETES, ...partage },
  });
}

/**
 * Une adresse plausible, rien de plus : `capturer_page.py` est ce qui juge
 * vraiment si la page existe. Refuser ici évite seulement de payer pour un
 * champ vide ou une valeur qui n'est manifestement pas une URL.
 */
function urlPlausible(valeur: unknown): valeur is string {
  if (typeof valeur !== 'string') return false;
  try {
    const u = new URL(valeur);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function creerSession(requete: Request, r: Reglages): Promise<Response> {
  const partage = entetesOrigine(requete, r.origines);
  const appelerFetch = r.fetch ?? fetch;

  if (!r.idPrixStripe) {
    // Le veto passe avant toute autre vérification, même le corps de la
    // requête — même ordre que generation-serveur : un prix inconnu ne se
    // contourne par aucun autre chemin.
    return erreur('produit pas encore configuré (prix manquant)', 503, partage);
  }

  if (!r.receptionCommandes || r.receptionCommandes.secret.length < 32) {
    return erreur('réception des commandes non configurée', 503, partage);
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return erreur('corps illisible', 400, partage);
  }
  const { url } = (corps as { url?: unknown }) ?? {};
  if (!urlPlausible(url)) {
    return erreur('adresse manquante ou invalide', 400, partage);
  }

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('line_items[0][price]', r.idPrixStripe);
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', r.urlSucces);
  params.set('cancel_url', r.urlAnnulation);
  // C'est cette métadonnée que /webhook relit pour savoir quelle page
  // auditer : rien d'autre ne transporte l'information entre les deux appels.
  params.set('metadata[url_a_auditer]', url);

  const reponse = await appelerFetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'authorization': `Basic ${btoa(`${r.cleSecreteStripe}:`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!reponse.ok) {
    // Jamais le détail Stripe tel quel : il peut porter des identifiants
    // internes. Le code d'état suffit à distinguer une vraie panne d'un refus.
    return erreur('la session de paiement n\'a pas pu être créée', 502, partage);
  }

  const session = (await reponse.json()) as { url?: string };
  if (!session.url) return erreur('réponse Stripe sans adresse de paiement', 502, partage);
  try {
    const adressePaiement = new URL(session.url);
    if (adressePaiement.protocol !== 'https:' || adressePaiement.hostname !== 'checkout.stripe.com') {
      return erreur('réponse Stripe avec adresse de paiement refusée', 502, partage);
    }
  } catch {
    return erreur('réponse Stripe avec adresse de paiement invalide', 502, partage);
  }

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { ...JSON_ENTETES, ...partage },
  });
}

/**
 * Enregistre un audit payé auprès de la réception durable.
 *
 * Rend false en cas de refus ou de panne : le webhook doit alors rendre
 * un 503 pour conserver les nouvelles tentatives de Stripe.
 */
async function declencherAnalyse(
  r: Reglages,
  charge: { url: string; sessionId: string; email: string | null },
): Promise<boolean> {
  const appelerFetch = r.fetch ?? fetch;
  const reception = r.receptionCommandes;
  if (!reception || reception.secret.length < 32) return false;
  try {
    const adresse = new URL(reception.url);
    if (adresse.protocol !== 'https:' || adresse.username || adresse.password) return false;
    const reponse = await appelerFetch(reception.url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        'authorization': `Bearer ${reception.secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(charge),
    });
    return reponse.status === 200 || reponse.status === 201;
  } catch {
    return false;
  }
}

async function webhook(requete: Request, r: Reglages): Promise<Response> {
  const corps = await requete.text();
  const valide = await signatureValide(corps, requete.headers.get('Stripe-Signature'), r.secretWebhook);
  // Refus sec et sans détail, même raison que licence-serveur : une réponse
  // bavarde aide à forger la signature suivante.
  if (!valide) return new Response('signature refusée', { status: 400 });

  let evenement: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    evenement = JSON.parse(corps);
  } catch {
    return new Response('corps illisible', { status: 400 });
  }

  if (evenement.type === 'checkout.session.completed' || evenement.type === 'checkout.session.async_payment_succeeded') {
    const objet = evenement.data?.object ?? {};
    if (objet.payment_status !== 'paid') return new Response('paiement en attente', { status: 200 });
    const sessionId = typeof objet.id === 'string' ? objet.id : '';
    const metadata = (objet.metadata ?? {}) as Record<string, unknown>;
    const url = typeof metadata.url_a_auditer === 'string' ? metadata.url_a_auditer : '';
    const details = (objet.customer_details ?? {}) as Record<string, unknown>;
    const email = typeof details.email === 'string' ? details.email : null;

    if (sessionId && url) {
      if (!await declencherAnalyse(r, { url, sessionId, email })) {
        return new Response('déclenchement temporairement indisponible', { status: 503 });
      }
    }
    // Une session sans URL en métadonnée ne devrait pas exister (elle vient
    // toujours de /creer-session, qui l'y pose) — mais si Stripe l'envoie
    // quand même, on ne bloque pas le webhook pour autant : rien à déclencher.
  }

  // Accuser réception des événements ignorés et des déclenchements acceptés.
  return new Response('ok', { status: 200 });
}

export async function traiter(requete: Request, r: Reglages): Promise<Response> {
  const chemin = new URL(requete.url).pathname;
  if (chemin === '/creer-session' && requete.method === 'OPTIONS') {
    const origine = requete.headers.get('Origin');
    if (!origine || !r.origines.includes(origine)) return new Response('origine refusée', { status: 403 });
    return new Response(null, { status: 204, headers: {
      ...entetesOrigine(requete, r.origines),
      'access-control-allow-methods': 'POST',
      'access-control-allow-headers': 'content-type',
    } });
  }
  if (chemin === '/creer-session' && requete.method === 'POST') return creerSession(requete, r);
  if (chemin === '/webhook' && requete.method === 'POST') return webhook(requete, r);
  return new Response('introuvable', { status: 404 });
}

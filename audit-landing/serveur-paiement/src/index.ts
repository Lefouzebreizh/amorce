import { signatureValide } from './signature.ts';

/**
 * Le serveur de paiement de « Audit de page de vente en 24h ».
 *
 * Deux routes : `/creer-session` crée une session Stripe Checkout pour la
 * page que le client veut faire auditer, `/webhook` reçoit la confirmation
 * de paiement et déclenche l'analyse. Sans dépendance — comme
 * `licence-serveur/`, dont il reprend la mécanique de vérification de
 * signature — la plateforme fournit `Request`, `Response`, `fetch` et
 * `crypto.subtle`.
 *
 * **Ce qu'il ne fait pas** : il ne stocke rien. Contrairement à
 * `licence-serveur/`, aucune clé à vérifier plus tard — la seule question
 * qu'il tranche est « ce paiement vient-il de se confirmer », et la réponse
 * part immédiatement vers GitHub Actions plutôt que dans une base.
 */

export type Reglages = {
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
  /** Jeton GitHub à portée minimale (`repository_dispatch` seulement). */
  jetonDeclenchement: string;
  /** Dépôt à notifier, forme `proprietaire/depot`. */
  depotDeclenchement: string;
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

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { ...JSON_ENTETES, ...partage },
  });
}

/**
 * Notifie GitHub Actions qu'un audit payé attend d'être lancé.
 *
 * N'échoue jamais bruyamment vers l'appelant : un `repository_dispatch`
 * raté ne doit pas faire échouer la réponse au webhook Stripe, sans quoi
 * Stripe rejoue l'événement pendant des jours pour une cause qui n'est pas
 * la sienne (voir `licence-serveur/src/index.ts`, même raison pour le 200
 * systématique). Rend `true`/`false` pour que l'appelant puisse au moins le
 * journaliser.
 */
async function declencherAnalyse(
  r: Reglages,
  charge: { url: string; sessionId: string; email: string | null },
): Promise<boolean> {
  const appelerFetch = r.fetch ?? fetch;
  try {
    const reponse = await appelerFetch(
      `https://api.github.com/repos/${r.depotDeclenchement}/dispatches`,
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${r.jetonDeclenchement}`,
          'accept': 'application/vnd.github+json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'nouvel-audit-paye',
          client_payload: { url: charge.url, session_id: charge.sessionId, email: charge.email },
        }),
      },
    );
    return reponse.ok;
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

  if (evenement.type === 'checkout.session.completed') {
    const objet = evenement.data?.object ?? {};
    const sessionId = typeof objet.id === 'string' ? objet.id : '';
    const metadata = (objet.metadata ?? {}) as Record<string, unknown>;
    const url = typeof metadata.url_a_auditer === 'string' ? metadata.url_a_auditer : '';
    const details = (objet.customer_details ?? {}) as Record<string, unknown>;
    const email = typeof details.email === 'string' ? details.email : null;

    if (sessionId && url) {
      await declencherAnalyse(r, { url, sessionId, email });
    }
    // Une session sans URL en métadonnée ne devrait pas exister (elle vient
    // toujours de /creer-session, qui l'y pose) — mais si Stripe l'envoie
    // quand même, on ne bloque pas le webhook pour autant : rien à déclencher.
  }

  // Toujours 200, même pour un type qu'on n'écoute pas : Stripe réessaie
  // tout ce qui n'est pas un 2xx pendant des jours.
  return new Response('ok', { status: 200 });
}

export async function traiter(requete: Request, r: Reglages): Promise<Response> {
  const chemin = new URL(requete.url).pathname;
  if (chemin === '/creer-session' && requete.method === 'POST') return creerSession(requete, r);
  if (chemin === '/webhook' && requete.method === 'POST') return webhook(requete, r);
  return new Response('introuvable', { status: 404 });
}

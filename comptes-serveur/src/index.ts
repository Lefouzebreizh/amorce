import { envoyerLienConnexion } from './courriel.ts';
import { ouvrir, sceller } from './jetons.ts';
import { signatureValide } from './signature.ts';

/**
 * Le serveur de comptes d'Amorce.
 *
 * Phase 1 de la génération intégrée : des comptes et un grand livre de
 * crédits, séparés de `licence-serveur` plutôt qu'ajoutés dedans — celui-ci
 * annonce déjà « il sait deux choses et pas une de plus », et un solde qui
 * bouge à chaque appel de génération n'est pas cette deuxième chose. Deux
 * services minces se relisent chacun en entier ; un seul qui ferait les deux
 * ne se relirait plus.
 *
 * Aucun mot de passe : la connexion se fait par lien envoyé par courriel,
 * comme la remise de licence le fait déjà pour la clé. Un mot de passe est
 * une chose de plus à saler, hacher, faire fuir un jour ; un lien de quinze
 * minutes ne laisse rien à voler qui vaille encore quelque chose une fois
 * lu.
 */

export type Base = {
  /** Le compte lié à cette adresse, ou `null` s'il n'existe pas encore. */
  compteParEmail(email: string): Promise<{ id: string; solde: number } | null>;
  /** Crée le compte. Idempotent par construction : `email` est unique en base. */
  creerCompte(id: string, email: string): Promise<void>;
  /** Le solde courant, ou `null` si le compte n'existe pas. */
  solde(compteId: string): Promise<number | null>;
  /** Le mouvement déjà enregistré sous cet id, ou `null`. Sert à retrouver un achat au moment de son remboursement. */
  mouvement(id: string): Promise<{ compteId: string; delta: number } | null>;
  /**
   * Enregistre un mouvement et met à jour le solde — idempotent sur `id` :
   * si un mouvement porte déjà cet id, l'appel ne fait rien. C'est ce qui
   * absorbe un webhook Stripe rejoué, ou une requête de génération relancée
   * après une coupure réseau, sans créditer ou débiter deux fois.
   */
  crediter(id: string, compteId: string, delta: number, motif: string): Promise<void>;
};

export type Reglages = {
  base: Base;
  /** Secret qui scelle les jetons de connexion et de session. */
  secretJetons: string;
  /** Secret de signature du webhook Stripe. */
  secretWebhook: string;
  /** Clé d'API Resend. Vide : les liens de connexion ne partent pas, la route le dit. */
  cleResend: string;
  /** Expéditeur au format `"Nom <adresse@domaine>"`. */
  expediteur: string;
  /** Racine du site, pour construire le lien envoyé par courriel. */
  adresseSite: string;
  /** Origines autorisées à interroger ce serveur depuis un navigateur. */
  origines: string[];
  /**
   * Correspondance montant payé (centimes) → crédits accordés. Les paliers
   * eux-mêmes ne sont pas décidés — cette table reste vide tant qu'ils ne le
   * sont pas, et le webhook ignore alors tout paiement sans le perdre : voir
   * `webhook`.
   */
  packs: Record<string, number>;
};

const JSON_ENTETES = { 'content-type': 'application/json; charset=utf-8' };

function reponseJson(corps: unknown, statut = 200, entetes: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...JSON_ENTETES, ...entetes } });
}

function entetesOrigine(requete: Request, origines: string[]): Record<string, string> {
  const origine = requete.headers.get('Origin');
  if (!origine || !origines.includes(origine)) return {};
  return { 'access-control-allow-origin': origine, vary: 'Origin' };
}

const DUREE_LIEN_S = 15 * 60;
const DUREE_SESSION_S = 30 * 24 * 3600;

/**
 * Demande un lien de connexion.
 *
 * Ne touche jamais la base : le compte se crée à la vérification du lien,
 * pas à la demande — sinon une adresse mal tapée, ou celle de quelqu'un
 * d'autre, créerait un compte fantôme que personne ne viendra jamais
 * réclamer.
 */
async function connexion(requete: Request, r: Reglages): Promise<Response> {
  const partage = entetesOrigine(requete, r.origines);
  const corps = await requete.json().catch(() => null) as { email?: unknown } | null;
  const email = typeof corps?.email === 'string' ? corps.email.trim().toLowerCase() : '';

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return reponseJson({ erreur: 'adresse illisible' }, 400, partage);
  }

  const jeton = await sceller(r.secretJetons, { email, type: 'connexion' }, DUREE_LIEN_S);
  const lien = `${r.adresseSite}/verifier?jeton=${encodeURIComponent(jeton)}`;
  const envoye = await envoyerLienConnexion(r.cleResend, email, lien, r.expediteur);

  // `envoye` reflète l'appel à Resend, pas l'existence d'un compte : cette
  // route ne sait jamais si l'adresse en avait déjà un.
  return reponseJson({ envoye }, 200, partage);
}

/**
 * Vérifie le lien, crée le compte s'il n'existait pas, rend un jeton de
 * session.
 */
async function verifier(requete: Request, r: Reglages): Promise<Response> {
  const partage = entetesOrigine(requete, r.origines);
  const jetonBrut = new URL(requete.url).searchParams.get('jeton') ?? '';
  const charge = await ouvrir<{ email: string; type: string }>(r.secretJetons, jetonBrut);

  if (!charge || charge.type !== 'connexion' || typeof charge.email !== 'string') {
    return reponseJson({ erreur: 'lien invalide ou expiré' }, 400, partage);
  }

  let compte = await r.base.compteParEmail(charge.email);
  if (!compte) {
    const id = crypto.randomUUID();
    await r.base.creerCompte(id, charge.email);
    compte = { id, solde: 0 };
  }

  const session = await sceller(r.secretJetons, { compteId: compte.id, type: 'session' }, DUREE_SESSION_S);
  return reponseJson({ jeton: session, solde: compte.solde }, 200, partage);
}

/**
 * Le solde courant. Jamais 401 : un jeton absent, expiré ou forgé rend la
 * même forme qu'un compte réel sans solde, comme `licence-serveur` rend
 * « libre » à toute clé qui ne vaut rien — le studio a besoin de savoir quoi
 * proposer, pas pourquoi le serveur refuse.
 */
async function solde(requete: Request, r: Reglages): Promise<Response> {
  const partage = entetesOrigine(requete, r.origines);
  const entete = requete.headers.get('Authorization') ?? '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : '';

  const charge = jeton ? await ouvrir<{ compteId: string; type: string }>(r.secretJetons, jeton) : null;
  if (!charge || charge.type !== 'session') return reponseJson({ connecte: false }, 200, partage);

  const valeur = await r.base.solde(charge.compteId);
  if (valeur === null) return reponseJson({ connecte: false }, 200, partage);

  return reponseJson({ connecte: true, solde: valeur }, 200, partage);
}

/**
 * Le webhook Stripe : crédite un achat, renverse un remboursement.
 *
 * La corrélation se fait par `payment_intent`, jamais par l'identifiant de
 * l'objet Stripe reçu : `checkout.session.completed` porte une session
 * (`cs_…`), `charge.refunded` porte une charge (`ch_…`) — deux identifiants
 * différents pour le même paiement. Les confondre aurait laissé un
 * remboursement ne jamais retrouver l'achat qu'il annule.
 */
async function webhook(requete: Request, r: Reglages): Promise<Response> {
  const corps = await requete.text();
  const valide = await signatureValide(corps, requete.headers.get('Stripe-Signature'), r.secretWebhook);
  if (!valide) return new Response('signature refusée', { status: 400 });

  let evenement: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    evenement = JSON.parse(corps);
  } catch {
    return new Response('corps illisible', { status: 400 });
  }

  const objet = evenement.data?.object ?? {};

  if (evenement.type === 'checkout.session.completed') {
    const compteId = typeof objet.client_reference_id === 'string' ? objet.client_reference_id : '';
    const paiementId = typeof objet.payment_intent === 'string' ? objet.payment_intent : '';
    const montant = typeof objet.amount_total === 'number' ? objet.amount_total : -1;
    const credits = r.packs[String(montant)];

    /*
     * Silencieux et pas une erreur : un montant sans palier connu arrive
     * forcément le jour où les prix changent sur Stripe avant que ce fichier
     * ne soit redéployé avec la nouvelle table. Refuser en 4xx ferait
     * réessayer Stripe pendant des jours pour un événement qui ne se
     * réparera jamais tout seul.
     */
    if (compteId && paiementId && credits) {
      await r.base.crediter(`achat:${paiementId}`, compteId, credits, 'achat_stripe');
    }
  } else if (evenement.type === 'charge.refunded' || evenement.type === 'charge.dispute.created') {
    const paiementId = typeof objet.payment_intent === 'string' ? objet.payment_intent : '';
    if (paiementId) {
      const achat = await r.base.mouvement(`achat:${paiementId}`);
      // Le solde peut passer sous zéro si les crédits ont déjà été dépensés
      // — c'est une dette réelle, pas un bug à masquer en plafonnant à zéro.
      if (achat) await r.base.crediter(`remb:${paiementId}`, achat.compteId, -achat.delta, 'remboursement');
    }
  }

  return new Response('ok', { status: 200 });
}

export async function traiter(requete: Request, r: Reglages): Promise<Response> {
  const chemin = new URL(requete.url).pathname;
  if (chemin === '/connexion' && requete.method === 'POST') return connexion(requete, r);
  if (chemin === '/verifier' && requete.method === 'GET') return verifier(requete, r);
  if (chemin === '/solde' && requete.method === 'GET') return solde(requete, r);
  if (chemin === '/webhook' && requete.method === 'POST') return webhook(requete, r);
  return new Response('introuvable', { status: 404 });
}

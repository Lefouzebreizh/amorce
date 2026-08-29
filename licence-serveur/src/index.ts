import { fabriquerCle, referenceDeLaCle } from './cles.ts';
import { signatureValide } from './signature.ts';

/**
 * Le serveur de licence d'Amorce.
 *
 * Il sait deux choses et pas une de plus : cette clé est-elle authentique, et
 * ce paiement tient-il toujours. Aucun média ne l'atteint jamais, aucun nom de
 * fichier, aucune trace d'usage — la frontière est écrite dans le `CLAUDE.md`
 * d'Amorce et dans `src/licence/CONTRAT.md`.
 *
 * Sans dépendance : la plateforme fournit `Request`, `Response` et
 * `crypto.subtle`. Ce qui n'a pas de dépendance n'a pas de faille héritée, et
 * se relit en entier en dix minutes.
 */

export type Base = {
  /** Rend la ligne du paiement, ou `null` s'il n'existe pas. */
  lire(reference: string): Promise<{ revoquee: boolean } | null>;
  /** Enregistre un paiement. Rejouer le même événement ne doit rien casser. */
  enregistrer(reference: string, paiement: string): Promise<void>;
  /** Marque un paiement remboursé ou contesté. */
  revoquer(reference: string): Promise<void>;
};

export type Reglages = {
  base: Base;
  /** Secret de signature du webhook Stripe. */
  secretWebhook: string;
  /** Secret qui scelle les clés. Le changer invalide toutes les licences émises. */
  secretCles: string;
  /** Origines autorisées à interroger `/etat`. */
  origines: string[];
};

const JSON_ENTETES = { 'content-type': 'application/json; charset=utf-8' };

/**
 * L'offre libre est la réponse à tout ce qui n'est pas une licence valide.
 *
 * Clé absente, malformée, inconnue, remboursée : le studio n'a pas à savoir
 * laquelle, il a à savoir quoi proposer. Un 401 le renseignerait sur ce que le
 * serveur sait, et ne lui servirait à rien.
 */
function libre(entetes: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ statut: 'libre' }), {
    status: 200,
    headers: { ...JSON_ENTETES, ...entetes },
  });
}

/** N'ouvre le partage qu'aux origines nommées : `*` laisserait n'importe quel site interroger. */
function entetesOrigine(requete: Request, origines: string[]): Record<string, string> {
  const origine = requete.headers.get('Origin');
  if (!origine || !origines.includes(origine)) return {};
  return {
    'access-control-allow-origin': origine,
    'vary': 'Origin',
  };
}

async function etat(requete: Request, r: Reglages): Promise<Response> {
  const partage = entetesOrigine(requete, r.origines);
  const entete = requete.headers.get('Authorization') ?? '';
  const cle = entete.startsWith('Bearer ') ? entete.slice(7) : '';
  if (!cle) return libre(partage);

  const reference = await referenceDeLaCle(r.secretCles, cle);
  if (!reference) return libre(partage);

  const ligne = await r.base.lire(reference);
  if (!ligne || ligne.revoquee) return libre(partage);

  return new Response(JSON.stringify({ statut: 'pro' }), {
    status: 200,
    headers: { ...JSON_ENTETES, ...partage },
  });
}

/**
 * La référence tirée d'un identifiant Stripe.
 *
 * On ne recopie pas l'identifiant tel quel : il voyagerait dans la clé, donc
 * dans un courriel et sur un écran partagé. Les douze derniers caractères
 * suffisent à distinguer deux paiements sans rien révéler d'exploitable.
 */
function reference(identifiant: string): string {
  return identifiant.replace(/[^A-Za-z0-9]/g, '').slice(-12).toUpperCase();
}

async function webhook(requete: Request, r: Reglages): Promise<Response> {
  const corps = await requete.text();
  const valide = await signatureValide(corps, requete.headers.get('Stripe-Signature'), r.secretWebhook);
  // Le refus est sec et sans détail : une réponse bavarde aide à forger la
  // signature suivante.
  if (!valide) return new Response('signature refusée', { status: 400 });

  let evenement: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    evenement = JSON.parse(corps);
  } catch {
    return new Response('corps illisible', { status: 400 });
  }

  const objet = evenement.data?.object ?? {};
  const identifiant = typeof objet.id === 'string' ? objet.id : '';
  if (!identifiant) return new Response('ok', { status: 200 });

  if (evenement.type === 'checkout.session.completed') {
    await r.base.enregistrer(reference(identifiant), identifiant);
  } else if (evenement.type === 'charge.refunded' || evenement.type === 'charge.dispute.created') {
    await r.base.revoquer(reference(identifiant));
  }

  /*
   * Toujours 200, même pour un type qu'on n'écoute pas.
   *
   * Stripe réessaie tout ce qui n'est pas un 2xx, pendant des jours. Répondre
   * en erreur à un événement dont on ne fait rien fabrique une file d'attente
   * qui ne se vide jamais.
   */
  return new Response('ok', { status: 200 });
}

/**
 * Remettre sa clé à qui vient de payer.
 *
 * Le webhook enregistre le paiement ; **rien ne donnait la clé à l'acheteur**.
 * Stripe le renvoie sur une page de succès avec l'identifiant de sa session,
 * et c'est cet identifiant qu'on échange ici.
 *
 * Rien n'est stocké pour cela : la référence se dérive de la session et la clé
 * se **recalcule** par son sceau. Une colonne qui garderait la clé en clair
 * serait une table de licences distribuables, et il n'y en a pas besoin.
 *
 * Ce que cette route expose, dit franchement : qui connaît un identifiant de
 * session peut obtenir la clé correspondante. C'est le même secret que la clé
 * elle-même — Stripe ne le donne qu'à l'acheteur, dans sa redirection — et
 * c'est le compromis habituel d'une page de succès. Ce qui le borne : le
 * format est vérifié avant toute lecture, un paiement inconnu ou révoqué ne
 * rend rien, et le partage reste fermé aux origines nommées.
 */
async function remise(requete: Request, r: Reglages): Promise<Response> {
  const partage = entetesOrigine(requete, r.origines);
  const session = new URL(requete.url).searchParams.get('session') ?? '';

  /* Le format d'abord : sans lui cette adresse publique devient un guichet où
     l'on essaie des identifiants au kilo, une lecture de base par tentative. */
  if (!/^cs_[A-Za-z0-9_]{10,}$/.test(session)) {
    return new Response(JSON.stringify({ erreur: 'session illisible' }), {
      status: 400,
      headers: { ...JSON_ENTETES, ...partage },
    });
  }

  const ref = reference(session);
  const ligne = await r.base.lire(ref);

  /*
   * 404 et non 200 : le webhook a souvent quelques secondes de retard sur la
   * redirection, et la page de succès doit pouvoir réessayer sur ce code. Le
   * confondre avec un refus enverrait quelqu'un qui vient de payer croire que
   * son paiement a échoué.
   */
  if (!ligne) {
    return new Response(JSON.stringify({ erreur: 'paiement pas encore enregistré' }), {
      status: 404,
      headers: { ...JSON_ENTETES, ...partage },
    });
  }
  if (ligne.revoquee) {
    return new Response(JSON.stringify({ erreur: 'paiement révoqué' }), {
      status: 410,
      headers: { ...JSON_ENTETES, ...partage },
    });
  }

  return new Response(JSON.stringify({ cle: await fabriquerCle(r.secretCles, ref) }), {
    status: 200,
    headers: { ...JSON_ENTETES, ...partage },
  });
}

export async function traiter(requete: Request, r: Reglages): Promise<Response> {
  const chemin = new URL(requete.url).pathname;
  if (chemin === '/etat' && requete.method === 'GET') return etat(requete, r);
  if (chemin === '/webhook' && requete.method === 'POST') return webhook(requete, r);
  if (chemin === '/remise' && requete.method === 'GET') return remise(requete, r);
  return new Response('introuvable', { status: 404 });
}

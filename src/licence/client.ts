import { ADRESSE_SERVEUR, serveurConfigure } from './etat.ts';
import { ETAT_INITIAL, type Etat, type Statut } from './types.ts';

/**
 * Le seul endroit d'Amorce qui parle au réseau.
 *
 * Ce qu'il envoie : une clé de licence, et rien d'autre. Pas un nom de fichier,
 * pas une durée, pas un compte d'exports — une requête sans corps. Ce qu'il
 * reçoit : un statut. C'est la frontière écrite dans `CLAUDE.md` §4, et elle
 * est étroite exprès.
 *
 * La clé lui est passée plutôt que lue ici : ce fichier ne touche à aucun
 * stockage, exactement comme le reste du module. `cle.ts` s'en charge, et c'est
 * le seul qui garde quelque chose.
 *
 * Il ne lève jamais. Un serveur éteint, une coupure, une réponse illisible :
 * dans tous les cas on retombe sur l'état initial, donc sur l'offre libre, et
 * le studio continue. Une exception qui remonterait jusqu'à l'interface
 * arrêterait un montage pour une raison qui ne regarde pas le montage.
 */

/** Au-delà, on n'attend plus : le studio ne se met pas en pause pour une facture. */
const DELAI_MS = 4000;

const STATUTS_CONNUS: Statut[] = ['inconnu', 'libre', 'pro'];

/**
 * Lit la réponse du serveur sans lui faire confiance.
 *
 * Un statut inconnu, un champ manquant, un JSON qui n'en est pas : tout cela
 * rend l'état initial plutôt qu'un objet à moitié rempli. Un `statut`
 * indéfini se serait comparé à `'pro'` sans erreur — donc faux, donc refusé,
 * et personne n'aurait su pourquoi un abonné payait pour rien.
 */
export function lireReponse(donnees: unknown): Etat {
  if (typeof donnees !== 'object' || donnees === null) return ETAT_INITIAL;
  const brut = donnees as Record<string, unknown>;
  const statut = brut.statut;
  if (typeof statut !== 'string' || !STATUTS_CONNUS.includes(statut as Statut)) return ETAT_INITIAL;
  // Un champ de plus dans la réponse est ignoré, jamais recopié : ce que le
  // studio lit est ce dont il a besoin, et rien qui vienne du réseau ne
  // traverse sans avoir été nommé ici.
  return { statut: statut as Statut };
}

/**
 * Ce que la consultation a appris, transport compris.
 *
 * `joignable` dit si le serveur a **répondu**, pas s'il a dit oui. La nuance a
 * été sous-estimée une première fois, et c'était une erreur de raisonnement :
 * on avait écrit qu'un client ne pouvait pas distinguer « clé fausse » de
 * « serveur muet ». Il le peut — un refus de partage entre origines, une
 * coupure ou un délai dépassé **lèvent**, là où un serveur qui rejette une clé
 * rend 200 avec `libre`.
 *
 * Ce que ça change concrètement : le jour où l'origine du studio n'est pas
 * listée dans les réglages du serveur, le navigateur bloque la réponse et tout
 * le monde retombe sur l'offre libre. Sans cette distinction, l'application
 * annonce « cette clé n'a pas été reconnue » à quelqu'un qui vient de payer, et
 * l'envoie chercher une faute de frappe dans une clé parfaitement valable.
 */
export type Consultation = {
  etat: Etat;
  joignable: boolean;
};

/**
 * Demande au serveur si cette personne a sa licence.
 *
 * `chercher` est injectable pour que le chemin entier — y compris ses replis —
 * s'éprouve sans réseau ni navigateur. Ce n'est pas une facilité de test :
 * c'est la seule façon de vérifier qu'une panne rend bien l'offre libre, et
 * une panne ne se commande pas.
 */
export async function demanderEtat(
  cle: string,
  chercher: typeof fetch = fetch,
  delaiMs = DELAI_MS,
): Promise<Consultation> {
  // Sans serveur, ou sans clé, il n'y a personne à interroger et rien à
  // demander. Une requête partirait pour se faire refuser, et l'offre libre
  // est déjà la réponse.
  // Rien n'a été demandé : le serveur n'est donc ni joignable ni injoignable,
  // et l'interface n'a aucune panne à signaler.
  if (!serveurConfigure() || cle.trim() === '') return { etat: ETAT_INITIAL, joignable: true };

  const arret = new AbortController();
  const minuterie = setTimeout(() => arret.abort(), delaiMs);
  try {
    const reponse = await chercher(`${ADRESSE_SERVEUR}/etat`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cle.trim()}` },
      signal: arret.signal,
    });
    // Un serveur qui répond en erreur a bel et bien répondu : ce n'est pas une
    // panne de transport, et le studio n'a pas à parler de réseau.
    if (!reponse.ok) return { etat: ETAT_INITIAL, joignable: true };
    return { etat: lireReponse(await reponse.json()), joignable: true };
  } catch {
    // Coupure, délai dépassé, partage entre origines refusé, réponse illisible :
    // le studio garde l'offre libre et continue. Rien de tout cela ne regarde le
    // montage en cours — mais on retient que le serveur n'a pas répondu, pour
    // ne pas accuser la clé de quelqu'un qui vient de payer.
    return { etat: ETAT_INITIAL, joignable: false };
  } finally {
    clearTimeout(minuterie);
  }
}

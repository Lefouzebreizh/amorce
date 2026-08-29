import { ADRESSE_SERVEUR, serveurConfigure } from './etat.ts';
import { ETAT_INITIAL, type Etat, type Statut } from './types.ts';

/**
 * Le seul endroit d'Amorce qui parle au réseau.
 *
 * Ce qu'il envoie : rien. Pas un nom de fichier, pas une durée, pas un compte
 * d'exports. Une requête sans corps, avec le témoin de session, et c'est tout.
 * Ce qu'il reçoit : un statut et une date. C'est la frontière écrite dans
 * `CLAUDE.md` §4, et elle est étroite exprès.
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
  const finLe = typeof brut.finLe === 'number' && Number.isFinite(brut.finLe) ? brut.finLe : undefined;
  return finLe === undefined ? { statut: statut as Statut } : { statut: statut as Statut, finLe };
}

/**
 * Demande au serveur qui est là et jusqu'à quand.
 *
 * `chercher` est injectable pour que le chemin entier — y compris ses replis —
 * s'éprouve sans réseau ni navigateur. Ce n'est pas une facilité de test :
 * c'est la seule façon de vérifier qu'une panne rend bien l'offre libre, et
 * une panne ne se commande pas.
 */
export async function demanderEtat(
  chercher: typeof fetch = fetch,
  delaiMs = DELAI_MS,
): Promise<Etat> {
  if (!serveurConfigure()) return ETAT_INITIAL;

  const arret = new AbortController();
  const minuterie = setTimeout(() => arret.abort(), delaiMs);
  try {
    const reponse = await chercher(`${ADRESSE_SERVEUR}/etat`, {
      method: 'GET',
      credentials: 'include',
      signal: arret.signal,
    });
    if (!reponse.ok) return ETAT_INITIAL;
    return lireReponse(await reponse.json());
  } catch {
    // Coupure, délai dépassé, réponse illisible : le studio garde l'offre
    // libre et continue. Rien de tout cela ne regarde le montage en cours.
    return ETAT_INITIAL;
  } finally {
    clearTimeout(minuterie);
  }
}

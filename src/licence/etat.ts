import { autorise } from './limites.ts';
import { type Etat } from './types.ts';

/**
 * L'adresse du serveur de licence, ou rien.
 *
 * Tant qu'elle est absente, il n'existe **aucun endroit où payer**. C'est une
 * information, pas un réglage : elle apparaîtra le jour où le serveur existe,
 * et le studio s'y adaptera sans qu'une ligne change.
 */
export const ADRESSE_SERVEUR = process.env.NEXT_PUBLIC_LICENCE_URL ?? '';

/** Vrai quand un chemin de paiement existe. */
export function serveurConfigure(): boolean {
  return ADRESSE_SERVEUR !== '';
}

/** Le texte de la signature, tel qu'il apparaît sur l'image. */
export const TEXTE_SIGNATURE = 'monté avec Amorce';

/**
 * La signature à tracer, ou rien.
 *
 * Deux conditions, et la seconde est celle qui compte : l'offre doit la
 * prévoir, **et un endroit où payer doit exister**.
 *
 * Apposer une marque qu'on ne peut pas retirer serait un procédé. La personne
 * verrait une signature, chercherait comment s'en défaire, et ne trouverait
 * rien — on lui aurait vendu une frustration au lieu d'un abonnement. Le
 * public visé est précisément celui que ce genre d'impasse blesse.
 *
 * La condition n'est donc pas un interrupteur qu'on oublie : elle se lève
 * toute seule le jour où le serveur est configuré, et jamais avant.
 */
export function signatureAAfficher(etat: Etat): string | undefined {
  if (!serveurConfigure()) return undefined;
  return autorise(etat, 'sansSignature') ? undefined : TEXTE_SIGNATURE;
}

/**
 * La pleine définition est-elle proposée ?
 *
 * Même règle que la signature, et pour la même raison — les deux sont écrites
 * côte à côte pour qu'elles ne puissent pas diverger.
 *
 * Sans serveur, **aucune limite**. Il n'existe alors nulle part où payer :
 * retirer le 1080 laisserait la personne devant une option manquante, sans
 * moyen de l'ouvrir et sans savoir pourquoi. Ce n'est pas une offre, c'est une
 * impasse — et le public visé est précisément celui que ce genre d'impasse
 * blesse.
 *
 * La restriction se lève donc toute seule le jour où le serveur est configuré,
 * jamais avant, et personne n'a d'interrupteur à ne pas oublier.
 */
export function pleineDefinitionOfferte(etat: Etat): boolean {
  if (!serveurConfigure()) return true;
  return autorise(etat, 'pleineDefinition');
}

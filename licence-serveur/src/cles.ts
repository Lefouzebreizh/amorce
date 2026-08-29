/**
 * Les clés de licence, vérifiables sans base de données.
 *
 * Une clé porte sa propre preuve : `AMO-<référence>-<sceau>`, où le sceau est
 * un HMAC de la référence. Le serveur recalcule le sceau et compare — il n'a
 * donc **rien à lire** pour savoir qu'une clé est authentique.
 *
 * La base ne sert qu'à deux choses que le calcul ne peut pas dire : ce
 * paiement a-t-il eu lieu, et a-t-il été remboursé depuis. C'est ce qui la
 * réduit à une table de deux colonnes utiles.
 */

import { egalesEnTempsConstant } from './signature.ts';

const PREFIXE = 'AMO';
/** Assez long pour ne pas se deviner, assez court pour se recopier à la main. */
const LONGUEUR_SCEAU = 20;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * L'alphabet écarte `I`, `O`, `0` et `1`.
 *
 * Une clé se lit dans un courriel et se recopie parfois à la main : `I` et `1`,
 * `O` et `0` s'échangent sans qu'on s'en aperçoive, et le support récupère une
 * clé « fausse » qui était juste mal lue.
 */
function encoder(octets: Uint8Array, longueur: number): string {
  let sortie = '';
  for (let i = 0; i < longueur; i += 1) sortie += ALPHABET[octets[i % octets.length] % ALPHABET.length];
  return sortie;
}

async function sceau(secret: string, reference: string): Promise<string> {
  const encodeur = new TextEncoder();
  const clef = await crypto.subtle.importKey(
    'raw',
    encodeur.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', clef, encodeur.encode(reference));
  return encoder(new Uint8Array(signature), LONGUEUR_SCEAU);
}

/** La clé qui correspond à une référence de paiement. */
export async function fabriquerCle(secret: string, reference: string): Promise<string> {
  return `${PREFIXE}-${reference}-${await sceau(secret, reference)}`;
}

/**
 * La référence contenue dans une clé authentique, ou `null`.
 *
 * Rend `null` pour toute clé malformée, tronquée ou dont le sceau ne
 * correspond pas — sans distinguer les cas : dire *pourquoi* une clé est
 * refusée aide surtout celui qui la fabrique.
 */
export async function referenceDeLaCle(secret: string, cle: string): Promise<string | null> {
  const morceaux = cle.trim().split('-');
  if (morceaux.length !== 3) return null;
  const [prefixe, reference, presente] = morceaux;
  if (prefixe !== PREFIXE || reference.length === 0) return null;

  const attendu = await sceau(secret, reference);
  // La comparaison vient de `signature.ts` plutôt que d'être recopiée : deux
  // copies d'une même précaution divergent, et c'est celle qu'on oublie de
  // corriger qui laisse deviner une clé.
  return egalesEnTempsConstant(presente, attendu) ? reference : null;
}

import { egalesEnTempsConstant } from './signature.ts';

/**
 * Jetons scellés par HMAC — même principe que la clé de licence d'Amorce :
 * la preuve voyage avec la donnée, le serveur n'a rien à lire pour la
 * vérifier. Deux usages ici, une seule fonction : le lien de connexion
 * (15 minutes, porte l'adresse) et le jeton de session (30 jours, porte
 * l'identifiant de compte). Aucune table de sessions à tenir, donc rien à
 * purger et rien à faire fuir.
 *
 * Le revers, dit franchement : un jeton ne se révoque pas avant son
 * expiration — il n'y a pas de liste noire. Pour un lien de connexion de
 * quinze minutes et une session de trente jours renouvelée à chaque usage,
 * c'est le compromis qu'accepte déjà `licence-serveur` pour la clé de
 * licence elle-même, qui ne s'éteint jamais avant un remboursement.
 */

async function sceau(secret: string, message: string): Promise<string> {
  const encodeur = new TextEncoder();
  const clef = await crypto.subtle.importKey(
    'raw',
    encodeur.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', clef, encodeur.encode(message));
  return [...new Uint8Array(signature)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

/** Base64 url-safe, sans le rembourrage `=` : il n'a pas sa place dans une URL. */
function encoderBase64Url(texte: string): string {
  const brut = btoa(unescape(encodeURIComponent(texte)));
  return brut.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decoderBase64Url(valeur: string): string {
  const brut = valeur.replaceAll('-', '+').replaceAll('_', '/');
  const rembourre = brut + '='.repeat((4 - (brut.length % 4)) % 4);
  return decodeURIComponent(escape(atob(rembourre)));
}

/**
 * Scelle une charge avec une expiration. `exp` fait partie de la charge
 * signée : le déplacer en dehors laisserait quelqu'un forger une expiration
 * différente sans casser la signature.
 */
export async function sceller(
  secret: string,
  charge: Record<string, unknown>,
  dureeS: number,
): Promise<string> {
  const expire = Math.floor(Date.now() / 1000) + dureeS;
  const corps = encoderBase64Url(JSON.stringify({ ...charge, exp: expire }));
  return `${corps}.${await sceau(secret, corps)}`;
}

/**
 * Ouvre un jeton scellé, ou rend `null` — sceau faux, format invalide,
 * charge illisible ou expirée sont un seul et même refus. Distinguer ces cas
 * à l'appelant renseignerait sur ce que le serveur a vérifié en premier.
 */
export async function ouvrir<T extends Record<string, unknown>>(
  secret: string,
  jeton: string,
): Promise<T | null> {
  const [corps, presente] = jeton.split('.');
  if (!corps || !presente) return null;

  const attendu = await sceau(secret, corps);
  if (!egalesEnTempsConstant(presente, attendu)) return null;

  let charge: Record<string, unknown>;
  try {
    charge = JSON.parse(decoderBase64Url(corps));
  } catch {
    return null;
  }

  const exp = charge.exp;
  if (typeof exp !== 'number' || exp < Math.floor(Date.now() / 1000)) return null;

  return charge as T;
}

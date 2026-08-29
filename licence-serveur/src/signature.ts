/**
 * Vérification de la signature Stripe.
 *
 * C'est la seule chose qui empêche n'importe qui d'accorder une licence en
 * appelant l'adresse du webhook. Tout le reste du serveur peut se tromper sans
 * conséquence ; ceci, non.
 *
 * Stripe signe `${horodatage}.${corps}` en HMAC-SHA256 et met le résultat dans
 * l'en-tête `Stripe-Signature`, sous la forme `t=...,v1=...`. On refait le
 * calcul et on compare.
 */

/** Au-delà, on refuse : une signature valide rejouée plus tard ne doit rien accorder. */
const TOLERANCE_S = 300;

/** Découpe `t=123,v1=abc,v1=def` sans supposer l'ordre ni l'unicité. */
function lireEntete(entete: string): { t: number | null; v1: string[] } {
  let t: number | null = null;
  const v1: string[] = [];
  for (const morceau of entete.split(',')) {
    const [clef, valeur] = morceau.split('=', 2);
    if (clef?.trim() === 't' && valeur) {
      const n = Number(valeur.trim());
      if (Number.isFinite(n)) t = n;
    }
    // Stripe envoie plusieurs `v1` pendant une rotation de secret : il suffit
    // qu'un seul corresponde, sans quoi toute rotation casserait les paiements.
    if (clef?.trim() === 'v1' && valeur) v1.push(valeur.trim());
  }
  return { t, v1 };
}

/**
 * Compare deux chaînes en temps constant.
 *
 * Une comparaison ordinaire s'arrête au premier caractère différent, et le
 * temps écoulé raconte alors combien de caractères étaient justes. On forge la
 * signature octet par octet à partir de là. La boucle ci-dessous parcourt donc
 * toujours toute la longueur.
 */
export function egalesEnTempsConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let ecart = 0;
  for (let i = 0; i < a.length; i += 1) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ecart === 0;
}

async function hmac(secret: string, message: string): Promise<string> {
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

/** Signature valide et récente. Rend `false` pour toute autre raison, sans distinguer. */
export async function signatureValide(
  corps: string,
  entete: string | null,
  secret: string,
  maintenantS: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!entete || !secret) return false;
  const { t, v1 } = lireEntete(entete);
  if (t === null || v1.length === 0) return false;
  if (Math.abs(maintenantS - t) > TOLERANCE_S) return false;

  const attendue = await hmac(secret, `${t}.${corps}`);
  return v1.some((candidate) => egalesEnTempsConstant(candidate, attendue));
}

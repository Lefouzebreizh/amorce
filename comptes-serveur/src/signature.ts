/**
 * Vérification de la signature Stripe.
 *
 * Recopié de `licence-serveur/src/signature.ts` à l'identique plutôt que
 * partagé par un paquet commun : deux services Cloudflare indépendants,
 * chacun sans dépendance, se relisent chacun en entier en dix minutes. Un
 * paquet partagé introduirait un couplage de déploiement entre les deux pour
 * économiser soixante lignes.
 *
 * Stripe signe `${horodatage}.${corps}` en HMAC-SHA256 et met le résultat
 * dans l'en-tête `Stripe-Signature`, sous la forme `t=...,v1=...`. On refait
 * le calcul et on compare.
 */

const TOLERANCE_S = 300;

function lireEntete(entete: string): { t: number | null; v1: string[] } {
  let t: number | null = null;
  const v1: string[] = [];
  for (const morceau of entete.split(',')) {
    const [clef, valeur] = morceau.split('=', 2);
    if (clef?.trim() === 't' && valeur) {
      const n = Number(valeur.trim());
      if (Number.isFinite(n)) t = n;
    }
    if (clef?.trim() === 'v1' && valeur) v1.push(valeur.trim());
  }
  return { t, v1 };
}

/** Comparaison en temps constant : voir `licence-serveur` pour la raison. */
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

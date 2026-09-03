/**
 * Chiffrement entièrement côté navigateur (Web Crypto API, aucune bibliothèque
 * tierce) — porté sans changement de logique depuis modules/coffre/ de
 * Life-Organizer. Le serveur (ici Supabase) ne voit jamais la phrase secrète
 * ni la clé qui en dérive, que l'hébergement soit local ou distant : c'est la
 * même garantie, seul l'endroit qui stocke les octets opaques a changé.
 */

export const ITERATIONS = 600_000;
export const TEXTE_VERIF = 'coffre-life-organizer-verification';

/**
 * Le nombre d'itérations vient du serveur, jamais de la page. On ne le croit
 * donc **jamais à la baisse** : une ligne corrompue — ou altérée — à
 * `iterations: 1` ferait dériver une clé faible en silence, sans qu'aucune
 * erreur ne sorte et sans que rien ne s'affiche différemment.
 *
 * `ITERATIONS` est un **plancher**, pas une valeur par défaut : une valeur
 * plus haute est honorée telle quelle, parce qu'elle ne peut que renforcer.
 * Une valeur absente, négative, non numérique ou non finie retombe au
 * plancher plutôt que de lever — l'utilisateur n'a rien à décider ici, et une
 * exception l'enfermerait dehors de son propre coffre.
 */
export function iterationsSures(annoncees: unknown): number {
  const n = typeof annoncees === 'number' && Number.isFinite(annoncees)
    ? Math.floor(annoncees)
    : 0;
  return Math.max(ITERATIONS, n);
}

export function b64FromBuf(buf: ArrayBuffer): string {
  const octets = new Uint8Array(buf);
  let binaire = '';
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire);
}

export function bufFromB64(b64: string): ArrayBuffer {
  const binaire = atob(b64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets.buffer;
}

// Un seul blob par objet : les 12 premiers octets sont le vecteur
// d'initialisation AES-GCM, le reste est le texte chiffré (avec son étiquette
// d'authentification déjà incluse par Web Crypto).
function empaqueter(ivBuf: ArrayBuffer, cipherBuf: ArrayBuffer): ArrayBuffer {
  const iv = new Uint8Array(ivBuf);
  const cipher = new Uint8Array(cipherBuf);
  const tout = new Uint8Array(iv.length + cipher.length);
  tout.set(iv, 0);
  tout.set(cipher, iv.length);
  return tout.buffer;
}

function depaqueter(buf: ArrayBuffer): { iv: Uint8Array; cipher: Uint8Array } {
  const tout = new Uint8Array(buf);
  return { iv: tout.slice(0, 12), cipher: tout.slice(12) };
}

export async function deriverCle(motDePasse: string, sel: Uint8Array, iterations: number): Promise<CryptoKey> {
  const cleBase = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sel as BufferSource, iterations, hash: 'SHA-256' },
    cleBase,
    { name: 'AES-GCM', length: 256 },
    false, // non extractible : même la console du navigateur ne peut pas en sortir les octets
    ['encrypt', 'decrypt'],
  );
}

export async function chiffrerOctets(cle: CryptoKey, buf: ArrayBuffer): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, buf);
  return empaqueter(iv.buffer as ArrayBuffer, cipher);
}

export async function dechiffrerOctets(cle: CryptoKey, buf: ArrayBuffer): Promise<ArrayBuffer> {
  const paquet = depaqueter(buf);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: paquet.iv as BufferSource },
    cle,
    paquet.cipher as BufferSource,
  );
}

export async function chiffrerTexte(cle: CryptoKey, texte: string): Promise<ArrayBuffer> {
  return chiffrerOctets(cle, new TextEncoder().encode(texte).buffer as ArrayBuffer);
}

export async function dechiffrerTexte(cle: CryptoKey, buf: ArrayBuffer): Promise<string> {
  const b = await dechiffrerOctets(cle, buf);
  return new TextDecoder().decode(b);
}

export function nomOpaque(): string {
  const octets = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
}

export function empaqueterVerificateur(paquet: ArrayBuffer): { iv: string; texte: string } {
  const d = depaqueter(paquet);
  return { iv: b64FromBuf(d.iv.buffer as ArrayBuffer), texte: b64FromBuf(d.cipher.buffer as ArrayBuffer) };
}

export function reempaqueterVerificateur(ivB64: string, texteB64: string): ArrayBuffer {
  const iv = new Uint8Array(bufFromB64(ivB64));
  const cipher = new Uint8Array(bufFromB64(texteB64));
  const tout = new Uint8Array(iv.length + cipher.length);
  tout.set(iv, 0);
  tout.set(cipher, iv.length);
  return tout.buffer;
}

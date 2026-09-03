/**
 * Le coffre, hébergé — mêmes opérations qu'en local (modules/coffre/ de
 * Life-Organizer), sur des tables Postgres et un bucket Supabase Storage
 * plutôt qu'un dossier synchronisé et un fichier JSON. La sécurité tient aux
 * policies RLS posées sur chaque table et sur le bucket (voir la migration
 * `creer_le_coffre_multi_utilisateurs`) : chaque requête est filtrée côté
 * serveur par auth.uid(), jamais laissée à la bonne volonté du client.
 */

import { supabase } from './supabase';
import {
  ITERATIONS, TEXTE_VERIF, b64FromBuf, bufFromB64, chiffrerOctets, dechiffrerOctets,
  chiffrerTexte, dechiffrerTexte, deriverCle, empaqueterVerificateur, nomOpaque,
  reempaqueterVerificateur,
} from './crypto';

export type ObjetIndex = {
  nom: string;
  taille: number;
  type: string;
  categorie: string;
  deposeLe: string;
};

export type IndexCoffre = { objets: Record<string, ObjetIndex> };

export async function coffreExiste(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('coffre_cles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

export async function initialiserCoffre(userId: string, motDePasse: string): Promise<CryptoKey> {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const cle = await deriverCle(motDePasse, sel, ITERATIONS);
  const paquetVerif = await chiffrerTexte(cle, TEXTE_VERIF);
  const { iv, texte } = empaqueterVerificateur(paquetVerif);

  const { error } = await supabase.from('coffre_cles').insert({
    user_id: userId,
    sel: b64FromBuf(sel.buffer as ArrayBuffer),
    iterations: ITERATIONS,
    verificateur_iv: iv,
    verificateur_texte: texte,
  });
  if (error) throw new Error(error.message);
  return cle;
}

export async function deverrouillerCoffre(userId: string, motDePasse: string): Promise<CryptoKey> {
  const { data, error } = await supabase
    .from('coffre_cles')
    .select('sel, iterations, verificateur_iv, verificateur_texte')
    .eq('user_id', userId)
    .single();
  if (error || !data) throw new Error('Coffre introuvable.');

  const sel = new Uint8Array(bufFromB64(data.sel));
  const cle = await deriverCle(motDePasse, sel, data.iterations);
  const paquetVerif = reempaqueterVerificateur(data.verificateur_iv, data.verificateur_texte);
  const texte = await dechiffrerTexte(cle, paquetVerif).catch(() => null);
  if (texte !== TEXTE_VERIF) throw new Error('Phrase secrète incorrecte.');
  return cle;
}

export async function chargerIndex(userId: string, cle: CryptoKey): Promise<IndexCoffre> {
  const { data, error } = await supabase
    .from('coffre_index')
    .select('contenu')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { objets: {} };
  const texte = await dechiffrerTexte(cle, bufFromB64(data.contenu));
  const index = JSON.parse(texte) as IndexCoffre;
  if (!index.objets) index.objets = {};
  return index;
}

async function sauvegarderIndex(userId: string, cle: CryptoKey, index: IndexCoffre): Promise<void> {
  const paquet = await chiffrerTexte(cle, JSON.stringify(index));
  const { error } = await supabase
    .from('coffre_index')
    .upsert({ user_id: userId, contenu: b64FromBuf(paquet), mis_a_jour_le: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function deposerFichier(
  userId: string, cle: CryptoKey, fichier: File, categorie: string, index: IndexCoffre,
): Promise<IndexCoffre> {
  const buf = await fichier.arrayBuffer();
  const paquet = await chiffrerOctets(cle, buf);
  const nom = nomOpaque();

  const { error } = await supabase.storage
    .from('coffre-objets')
    .upload(`${userId}/${nom}`, paquet, { contentType: 'application/octet-stream' });
  if (error) throw new Error(error.message);

  const nouvel_index: IndexCoffre = {
    objets: {
      ...index.objets,
      [nom]: {
        nom: fichier.name,
        taille: fichier.size,
        type: fichier.type || 'application/octet-stream',
        categorie,
        deposeLe: new Date().toISOString(),
      },
    },
  };
  await sauvegarderIndex(userId, cle, nouvel_index);
  return nouvel_index;
}

export async function recupererFichier(userId: string, cle: CryptoKey, nom: string, info: ObjetIndex): Promise<Blob> {
  const { data, error } = await supabase.storage.from('coffre-objets').download(`${userId}/${nom}`);
  if (error || !data) throw new Error('Objet introuvable sur le serveur.');
  const buf = await data.arrayBuffer();
  const clair = await dechiffrerOctets(cle, buf);
  return new Blob([clair], { type: info.type });
}

export async function supprimerFichier(
  userId: string, cle: CryptoKey, nom: string, index: IndexCoffre,
): Promise<IndexCoffre> {
  const { error } = await supabase.storage.from('coffre-objets').remove([`${userId}/${nom}`]);
  if (error) throw new Error(error.message);
  const objets = { ...index.objets };
  delete objets[nom];
  const nouvel_index: IndexCoffre = { objets };
  await sauvegarderIndex(userId, cle, nouvel_index);
  return nouvel_index;
}

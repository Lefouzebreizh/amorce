/**
 * Le coffre, hébergé — mêmes opérations qu'en local (modules/coffre/ de
 * Life-Organizer), sur des tables Postgres et un bucket Supabase Storage
 * plutôt qu'un dossier synchronisé et un fichier JSON. La sécurité tient aux
 * policies RLS posées sur chaque table et sur le bucket (voir
 * `supabase/schema.sql`) : chaque requête est filtrée côté
 * serveur par auth.uid(), jamais laissée à la bonne volonté du client.
 */

import { supabase } from './supabase';
import {
  ITERATIONS, TEXTE_VERIF, b64FromBuf, bufFromB64, chiffrerOctets, dechiffrerOctets,
  chiffrerTexte, dechiffrerTexte, deriverCle, empaqueterVerificateur, nomOpaque,
  reempaqueterVerificateur,
  iterationsSures,
} from './crypto';

export type Echeance = {
  presente: boolean;
  date: string | null;
  libelle: string | null;
  confiance: 'haute' | 'moyenne' | 'basse';
};

export type ObjetIndex = {
  nom: string;
  taille: number;
  type: string;
  categorie: string;
  deposeLe: string;
  echeance?: Echeance;
};

export type IndexCoffre = { objets: Record<string, ObjetIndex> };

export type PropositionClassement = {
  lisible: boolean;
  categorie: string;
  nomSuggere: string;
  echeance: Echeance;
};

function b64FromFichier(buf: ArrayBuffer): string {
  // Par blocs de 32 Ko : String.fromCharCode(...octets) sur un fichier de
  // plusieurs Mo dépasserait la pile d'appels (trop d'arguments d'un coup).
  const octets = new Uint8Array(buf);
  const TAILLE_BLOC = 32768;
  let binaire = '';
  for (let i = 0; i < octets.length; i += TAILLE_BLOC) {
    binaire += String.fromCharCode(...octets.subarray(i, i + TAILLE_BLOC));
  }
  return btoa(binaire);
}

// Envoie le fichier EN CLAIR à la fonction serveur classer-document — le seul
// instant où un document du coffre est lisible ailleurs que dans ce
// navigateur (voir SECURITY.md). N'échoue jamais bruyamment : en cas de
// panne, on renvoie une proposition vide plutôt que de bloquer le dépôt.
export async function proposerClassement(fichier: File): Promise<PropositionClassement> {
  const vide: PropositionClassement = {
    lisible: false, categorie: '', nomSuggere: '',
    echeance: { presente: false, date: null, libelle: null, confiance: 'basse' },
  };
  try {
    const buf = await fichier.arrayBuffer();
    const { data, error } = await supabase.functions.invoke('classer-document', {
      body: { donnees: b64FromFichier(buf), type: fichier.type || 'application/octet-stream' },
    });
    if (error || !data || 'erreur' in data) return vide;
    return data as PropositionClassement;
  } catch {
    return vide;
  }
}

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
  const cle = await deriverCle(motDePasse, sel, iterationsSures(data.iterations));
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
  nomAffiche?: string, echeance?: Echeance,
): Promise<IndexCoffre> {
  const buf = await fichier.arrayBuffer();
  const paquet = await chiffrerOctets(cle, buf);
  const nom = nomOpaque();

  const { error } = await supabase.storage
    .from('coffre-objets')
    .upload(`${userId}/${nom}`, paquet, { contentType: 'application/octet-stream' });
  if (error) throw new Error(error.message);

  const objet: ObjetIndex = {
    nom: nomAffiche || fichier.name,
    taille: fichier.size,
    type: fichier.type || 'application/octet-stream',
    categorie,
    deposeLe: new Date().toISOString(),
  };
  // L'échéance complète (libellé compris) reste chiffrée dans l'index, comme
  // le reste — visible seulement une fois le coffre déverrouillé. La date
  // seule, sans rien d'autre, part aussi vers coffre_echeances : c'est ce qui
  // permet à la fonction d'alerte de savoir qu'il faut prévenir, sans jamais
  // savoir de quel document il s'agit ni ce qu'il contient.
  if (echeance && echeance.presente) {
    objet.echeance = echeance;
    if (echeance.date) {
      const { error: erreurEcheance } = await supabase
        .from('coffre_echeances')
        .insert({ user_id: userId, objet_nom: nom, date: echeance.date });
      if (erreurEcheance) throw new Error(erreurEcheance.message);
    }
  }

  const nouvel_index: IndexCoffre = { objets: { ...index.objets, [nom]: objet } };
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
  // Retire aussi l'échéance en clair associée, s'il y en avait une — sinon
  // une alerte finirait par arriver pour un document qui n'existe plus.
  await supabase.from('coffre_echeances').delete().eq('user_id', userId).eq('objet_nom', nom);
  const objets = { ...index.objets };
  delete objets[nom];
  const nouvel_index: IndexCoffre = { objets };
  await sauvegarderIndex(userId, cle, nouvel_index);
  return nouvel_index;
}

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

export type Lettre = {
  objet: string;
  corps: string;
  mentionsManquantes: string[];
};

export type ObjetIndex = {
  nom: string;
  taille: number;
  type: string;
  categorie: string;
  deposeLe: string;
  echeance?: Echeance;
  emetteur?: string;
  referenceClient?: string;
  lettre?: Lettre;
};

export type RendezVous = {
  id: string;
  libelle: string;
  date: string;
};

export type Identite = {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
};

export type IndexCoffre = {
  objets: Record<string, ObjetIndex>;
  rendezVous?: Record<string, RendezVous>;
  identite?: Identite;
};

export type PropositionClassement = {
  lisible: boolean;
  categorie: string;
  nomSuggere: string;
  emetteur: string | null;
  referenceClient: string | null;
  echeance: Echeance;
};

// Catégories où un document a des chances d'être un abonnement résiliable —
// sert seulement à décider si on propose une lettre, jamais à choisir un
// fondement légal précis (on n'a pas la date d'engagement ni le préavis
// exact, contrairement à paper-manager/core/resiliation.py — voir SECURITY.md).
const CATEGORIES_RESILIABLES = ['Assurance', 'Énergie', 'Téléphonie et internet'];

// Un gabarit fixe, jamais du texte librement généré par un modèle : c'est le
// gabarit qui garantit le fond (mentions obligatoires), pas la formulation.
// Toujours présenté comme un brouillon à relire, jamais envoyé seul —
// version volontairement simplifiée de paper-manager/core/resiliation.py :
// pas de calcul de préavis, pas de fondement légal par catégorie, parce que
// Le Coffre n'a que ce qu'une photo laisse voir.
export function composerLettreResiliation(
  identite: Identite, emetteur: string, referenceClient: string | null, dateEffet: string,
): Lettre {
  const aujourdhui = new Date().toLocaleDateString('fr-FR');
  const effet = new Date(dateEffet + 'T00:00:00').toLocaleDateString('fr-FR');
  const objet = `Résiliation de mon contrat${referenceClient ? ` — réf. client ${referenceClient}` : ''}`;
  const corps =
    `${identite.nom}\n${identite.adresse}\n${identite.codePostal} ${identite.ville}\n\n` +
    `${identite.ville}, le ${aujourdhui}\n\n` +
    `À l'attention du service résiliation — ${emetteur}\n\n` +
    `Objet : ${objet}\n\n` +
    `Madame, Monsieur,\n\n` +
    `Je vous informe par la présente de ma décision de résilier mon contrat` +
    `${referenceClient ? ` (référence client ${referenceClient})` : ''} souscrit auprès de ${emetteur}, ` +
    `pour des raisons qui me sont personnelles.\n\n` +
    `Je vous demande de prendre en compte cette résiliation avec effet au ${effet}, ` +
    `et vous remercie de bien vouloir m'en adresser une confirmation écrite.\n\n` +
    `Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\n` +
    `${identite.nom}`;

  const entier = `${objet}\n${corps}`;
  const mentionsManquantes = [
    !referenceClient && "la référence client (non lue sur le document — à ajouter à la main si tu la connais)",
    !entier.includes(effet) && "la date d'effet",
    !entier.toLowerCase().includes('confirmation') && "la demande de confirmation écrite",
  ].filter((m): m is string => Boolean(m));

  return { objet, corps, mentionsManquantes };
}

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
    lisible: false, categorie: '', nomSuggere: '', emetteur: null, referenceClient: null,
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

const TENTATIVES_MAX = 10;
const FENETRE_MINUTES = 15;

// Le serveur ne voit jamais la phrase secrète, donc jamais si CETTE tentative
// a réussi au moment où elle a lieu — mais il peut compter les échecs
// récents journalisés après coup, et refuser d'aller plus loin s'il y en a
// trop. Un vérificateur chiffré à 600 000 itérations PBKDF2 est déjà lent à
// attaquer ; ce compteur ajoute une deuxième barrière, côté serveur celle-là.
async function tropDeTentatives(userId: string): Promise<boolean> {
  const depuis = new Date(Date.now() - FENETRE_MINUTES * 60_000).toISOString();
  const { count, error } = await supabase
    .from('coffre_tentatives')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('reussie', false)
    .gte('le', depuis);
  if (error) return false; // une panne de journalisation ne doit pas bloquer un utilisateur légitime
  return (count ?? 0) >= TENTATIVES_MAX;
}

async function journaliserTentative(userId: string, reussie: boolean): Promise<void> {
  await supabase.from('coffre_tentatives').insert({ user_id: userId, reussie });
}

export async function deverrouillerCoffre(userId: string, motDePasse: string): Promise<CryptoKey> {
  if (await tropDeTentatives(userId)) {
    throw new Error(
      `Trop de tentatives incorrectes. Réessaie dans ${FENETRE_MINUTES} minutes.`,
    );
  }

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
  const reussie = texte === TEXTE_VERIF;
  await journaliserTentative(userId, reussie);
  if (!reussie) throw new Error('Phrase secrète incorrecte.');
  return cle;
}

export async function chargerIndex(userId: string, cle: CryptoKey): Promise<IndexCoffre> {
  const { data, error } = await supabase
    .from('coffre_index')
    .select('contenu')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { objets: {}, rendezVous: {} };
  const texte = await dechiffrerTexte(cle, bufFromB64(data.contenu));
  const index = JSON.parse(texte) as IndexCoffre;
  if (!index.objets) index.objets = {};
  if (!index.rendezVous) index.rendezVous = {};
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
  nomAffiche?: string, echeance?: Echeance, emetteur?: string | null, referenceClient?: string | null,
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
    // La lettre est un gabarit rempli, jamais un texte deviné : seulement si
    // l'émetteur a été lu noir sur blanc, la catégorie ressemble à un
    // abonnement, et l'identité de l'utilisateur est renseignée.
    if (
      echeance.date && emetteur && index.identite
      && CATEGORIES_RESILIABLES.includes(categorie)
    ) {
      objet.emetteur = emetteur;
      if (referenceClient) objet.referenceClient = referenceClient;
      objet.lettre = composerLettreResiliation(index.identite, emetteur, referenceClient ?? null, echeance.date);
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

// Un rendez-vous n'a pas de fichier : le libellé (« Dentiste, cabinet
// Martin ») reste chiffré dans l'index, comme un nom de document — seule la
// date part en clair vers coffre_echeances, avec type='rendezvous', pour que
// la fonction d'alerte sache prévenir sans jamais savoir de quoi il s'agit.
export async function ajouterRendezVous(
  userId: string, cle: CryptoKey, libelle: string, date: string, index: IndexCoffre,
): Promise<IndexCoffre> {
  const id = nomOpaque();
  const { error } = await supabase
    .from('coffre_echeances')
    .insert({ user_id: userId, objet_nom: id, date, type: 'rendezvous' });
  if (error) throw new Error(error.message);

  const nouvel_index: IndexCoffre = {
    objets: index.objets,
    rendezVous: { ...index.rendezVous, [id]: { id, libelle, date } },
  };
  await sauvegarderIndex(userId, cle, nouvel_index);
  return nouvel_index;
}

export async function supprimerRendezVous(
  userId: string, cle: CryptoKey, id: string, index: IndexCoffre,
): Promise<IndexCoffre> {
  await supabase.from('coffre_echeances').delete().eq('user_id', userId).eq('objet_nom', id);
  const rendezVous = { ...index.rendezVous };
  delete rendezVous[id];
  const nouvel_index: IndexCoffre = { objets: index.objets, rendezVous };
  await sauvegarderIndex(userId, cle, nouvel_index);
  return nouvel_index;
}

// L'identité (nom, adresse) sert uniquement à remplir l'en-tête des lettres
// de résiliation — chiffrée dans l'index comme le reste, jamais transmise
// ailleurs, jamais utilisée pour rien d'autre.
export async function enregistrerIdentite(
  userId: string, cle: CryptoKey, identite: Identite, index: IndexCoffre,
): Promise<IndexCoffre> {
  const nouvel_index: IndexCoffre = { ...index, identite };
  await sauvegarderIndex(userId, cle, nouvel_index);
  return nouvel_index;
}

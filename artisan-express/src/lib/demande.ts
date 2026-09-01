/*
 * Ce qu'un artisan remplit, et ce qu'on accepte d'en faire.
 *
 * La validation vit ici, seule et sans dépendance : c'est le seul morceau de la
 * page qu'on puisse éprouver sans navigateur, sans réseau et sans clé d'API. Le
 * formulaire du client et la route serveur appellent tous les deux cette
 * fonction — l'un pour afficher les erreurs tout de suite, l'autre parce qu'un
 * contrôle fait uniquement dans le navigateur ne contrôle rien.
 */

export type Demande = {
  nom: string;
  metier: string;
  ville: string;
  telephone: string;
  courriel: string;
  message: string;
};

export type ChampDemande = keyof Demande;

export type Analyse =
  | { statut: 'valide'; demande: Demande }
  | { statut: 'invalide'; erreurs: Partial<Record<ChampDemande, string>> }
  /*
   * Le piège à robots est un champ que personne ne voit et qu'un automate
   * remplit. On ne renvoie pas d'erreur dans ce cas : la route répondra comme
   * si tout allait bien, sans rien envoyer. Dire « tu es un robot » apprend
   * seulement au robot suivant à ne pas remplir ce champ.
   */
  | { statut: 'robot' };

const LONGUEURS: Record<ChampDemande, { min: number; max: number }> = {
  nom: { min: 2, max: 80 },
  metier: { min: 2, max: 60 },
  ville: { min: 2, max: 80 },
  telephone: { min: 0, max: 30 },
  courriel: { min: 0, max: 120 },
  message: { min: 0, max: 2000 },
};

/** Le champ invisible du formulaire. Vide chez un humain, rempli par un robot. */
export const CHAMP_PIEGE = 'entreprise_bis';

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

/*
 * Un numéro français s'écrit de six façons — 06 12 34 56 78, 06.12.34.56.78,
 * +33 6 12 34 56 78, avec ou sans espaces. On garde les chiffres et un `+` de
 * tête, on compte, et on refuse au lieu de deviner : neuf chiffres est le
 * plancher d'un fixe ou d'un mobile, indicatif compris.
 */
export function normaliserTelephone(brut: string): string {
  const nettoye = brut.replace(/[^\d+]/g, '');
  return nettoye.startsWith('+') ? `+${nettoye.slice(1).replace(/\+/g, '')}` : nettoye.replace(/\+/g, '');
}

function telephoneValide(brut: string): boolean {
  const chiffres = normaliserTelephone(brut).replace(/\D/g, '');
  return chiffres.length >= 9 && chiffres.length <= 15;
}

/*
 * Contrôle volontairement large : « un arobase, un point après, pas d'espace ».
 * Une expression rationnelle plus fine rejette des adresses valides, et le
 * courriel n'est ici qu'un moyen de rappel parmi deux — le téléphone fait foi.
 */
function courrielValide(brut: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(brut);
}

export function analyserDemande(brut: unknown): Analyse {
  const donnees = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;

  if (texte(donnees[CHAMP_PIEGE]) !== '') {
    return { statut: 'robot' };
  }

  const demande: Demande = {
    nom: texte(donnees.nom),
    metier: texte(donnees.metier),
    ville: texte(donnees.ville),
    telephone: texte(donnees.telephone),
    courriel: texte(donnees.courriel),
    message: texte(donnees.message),
  };

  const erreurs: Partial<Record<ChampDemande, string>> = {};

  for (const champ of ['nom', 'metier', 'ville'] as const) {
    const longueur = LONGUEURS[champ].min;
    if (demande[champ].length < longueur) {
      erreurs[champ] = 'À remplir.';
    }
  }

  if (demande.telephone === '') {
    erreurs.telephone = 'Ton numéro, pour que je puisse te rappeler.';
  } else if (!telephoneValide(demande.telephone)) {
    erreurs.telephone = 'Ce numéro a l’air incomplet.';
  }

  if (demande.courriel !== '' && !courrielValide(demande.courriel)) {
    erreurs.courriel = 'Cette adresse a l’air incomplète.';
  }

  for (const champ of Object.keys(LONGUEURS) as ChampDemande[]) {
    if (demande[champ].length > LONGUEURS[champ].max) {
      erreurs[champ] = `${LONGUEURS[champ].max} caractères au maximum.`;
    }
  }

  if (Object.keys(erreurs).length > 0) {
    return { statut: 'invalide', erreurs };
  }

  return { statut: 'valide', demande: { ...demande, telephone: normaliserTelephone(demande.telephone) } };
}

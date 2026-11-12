/** La démonstration structure le texte localement. Aucun modèle IA ni tarif n’est appelé. */
export type LigneDevisVocal = {
  id: number;
  designation: string;
  quantite: string;
  unite: string;
  prixUnitaire: string;
};

export type BrouillonDevisVocal = {
  client: string;
  lignes: LigneDevisVocal[];
};

export const EXEMPLE_DEVIS_VOCAL =
  'Devis pour M. Dupont, pose d’un chauffe-eau 200 L, 3 h de main-d’œuvre.';

export const MAX_LIGNES_DEVIS = 12;
export const MAX_TEXTE_DEVIS = 3000;

export function ligneVide(id: number): LigneDevisVocal {
  return { id, designation: '', quantite: '1', unite: 'forfait', prixUnitaire: '' };
}

/** Seuls des montants explicitement suivis de € ou euros sont pris comme prix. */
export function structurerDictee(texte: string): BrouillonDevisVocal {
  const propre = texte.trim().slice(0, MAX_TEXTE_DEVIS);
  const clientTrouve = propre.match(/^(?:devis\s+)?pour\s+([^,;\n]+)[,;\n]?/i);
  const client = clientTrouve?.[1]?.trim() ?? '';
  const prestations = (clientTrouve ? propre.slice(clientTrouve[0].length) : propre)
    .replace(/^devis\s*[:,]?\s*/i, '')
    .split(/(?<!\d),|,(?!\d)|[;\n]+/)
    .map((partie) => partie.trim().replace(/[.!]$/, ''))
    .filter(Boolean)
    .slice(0, MAX_LIGNES_DEVIS);

  const lignes = prestations.map((prestation, index): LigneDevisVocal => {
    const heures = prestation.match(/(?<![\d.\-])(\d+(?:[.,]\d{1,3})?)\s*(?:h\b|heures?\b)/i);
    const montant = prestation.match(/(?<![\d.,\-])(?:à\s+)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?\b)/i);
    const designation = prestation
      .replace(montant?.[0] ?? /$^/, '')
      .replace(heures?.[0] ?? /$^/, '')
      .replace(/^\s*(?:de\s+|d[’']\s*)/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      id: index + 1,
      designation: designation || prestation,
      quantite: heures?.[1]?.replace(',', '.') ?? '1',
      unite: heures ? 'h' : 'forfait',
      prixUnitaire: montant?.[1]?.replace(',', '.') ?? '',
    };
  });
  return { client, lignes: lignes.length ? lignes : [ligneVide(1)] };
}

/** Conversion exacte d’une saisie décimale, sans arrondi binaire sur la devise. */
export function montantEnCentimes(valeur: string): number | null {
  const normalise = valeur.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(normalise)) return null;
  const [entier = '0', fraction = ''] = normalise.split('.');
  const centimes = Number(entier) * 100 + Number(fraction.padEnd(2, '0'));
  return centimes <= 100_000_000 ? centimes : null;
}

export function quantiteEnMilliemes(valeur: string): number | null {
  const normalise = valeur.trim().replace(',', '.');
  if (!/^\d{1,5}(?:\.\d{1,3})?$/.test(normalise)) return null;
  const [entier = '0', fraction = ''] = normalise.split('.');
  const millieme = Number(entier) * 1000 + Number(fraction.padEnd(3, '0'));
  return millieme > 0 && millieme <= 10_000_000 ? millieme : null;
}

export function totalLigneCentimes(ligne: LigneDevisVocal): number | null {
  const prix = montantEnCentimes(ligne.prixUnitaire);
  const quantite = quantiteEnMilliemes(ligne.quantite);
  if (prix === null || quantite === null) return null;
  return Math.round((prix * quantite) / 1000);
}

export function erreursDevis(brouillon: BrouillonDevisVocal, autoriserBrouillonIncomplet = false): string[] {
  const erreurs: string[] = [];
  if (!brouillon.client.trim() && !autoriserBrouillonIncomplet) erreurs.push('Ajoute le nom du client.');
  if (brouillon.client.length > 120) erreurs.push('Le nom du client est limité à 120 caractères.');
  if (!brouillon.lignes.length || brouillon.lignes.length > MAX_LIGNES_DEVIS) {
    erreurs.push(`Le devis doit contenir entre 1 et ${MAX_LIGNES_DEVIS} prestations.`);
  }
  brouillon.lignes.forEach((ligne, index) => {
    const repere = `Prestation ${index + 1}`;
    if (!ligne.designation.trim()) erreurs.push(`${repere} : décris la prestation.`);
    if (ligne.designation.length > 240) erreurs.push(`${repere} : 240 caractères au maximum.`);
    if (quantiteEnMilliemes(ligne.quantite) === null) {
      erreurs.push(`${repere} : quantité positive, jusqu’à 10 000 et trois décimales.`);
    }
    if (montantEnCentimes(ligne.prixUnitaire) === null && !(autoriserBrouillonIncomplet && !ligne.prixUnitaire.trim())) {
      erreurs.push(`${repere} : indique ton prix unitaire, de 0 à 1 000 000 €, avec deux décimales au maximum.`);
    }
    if (!ligne.unite.trim() || ligne.unite.length > 20) erreurs.push(`${repere} : précise une unité de 20 caractères au maximum.`);
  });
  return erreurs;
}

export function totalDevisCentimes(brouillon: BrouillonDevisVocal): number | null {
  if (!brouillon.lignes.length) return null;
  let total = 0;
  for (const ligne of brouillon.lignes) {
    const montant = totalLigneCentimes(ligne);
    if (montant === null) return null;
    total += montant;
  }
  return total;
}

export function afficherEuros(centimes: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(centimes / 100);
}

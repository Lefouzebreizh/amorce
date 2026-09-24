export const OFFRES = [
  {
    id: 'express',
    nom: 'Express',
    prix: '300\u00a0€',
    repere: 'L’essentiel, sans détour',
    description: 'Une vitrine nette pour être joignable et présenter l’essentiel de ton activité.',
    details: ['Une page pensée pour le mobile', 'Présentation, contact et appel direct', 'Une modification après livraison'],
  },
  {
    id: 'metier',
    nom: 'Métier',
    prix: '690\u00a0€',
    repere: 'Le bon niveau pour se développer',
    description: 'Un site vitrine structuré qui montre vraiment ce que tu fais et ce que tu as réalisé.',
    details: ['Jusqu’à 3 pages : accueil, services, réalisations/contact', 'Direction graphique adaptée à ton activité', 'Parcours de contact et mise en ligne'],
  },
  {
    id: 'signature',
    nom: 'Signature',
    prix: '1\u202f290\u00a0€',
    repere: 'Une présence qui marque',
    description: 'Une direction visuelle sur mesure et un parcours construit autour de ton savoir-faire.',
    details: ['Jusqu’à 5 pages et architecture définie ensemble', 'Direction visuelle personnalisée sur tous les écrans', 'Prestations, réalisations, CTA et parcours contrôlés'],
  },
] as const;

export type OffreId = (typeof OFFRES)[number]['id'];

export function estOffreId(valeur: unknown): valeur is OffreId {
  return OFFRES.some((offre) => offre.id === valeur);
}

export function offreParId(id: OffreId) {
  return OFFRES.find((offre) => offre.id === id) ?? OFFRES[0];
}

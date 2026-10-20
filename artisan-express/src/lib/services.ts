/** Les outils sont démontrables ; leur raccordement est chiffré après étude. */
export const SERVICES = [
  { id: 'appels', nom: 'Sauveur d’appels manqués', ancre: 'appels-manques', accroche: 'Garde le contact, même sur un chantier.', description: 'Un SMS après un appel sans réponse, puis le besoin du client prêt à rappeler.', detail: 'Raccordement téléphonique et coût des SMS étudiés ensemble.' },
  { id: 'devis', nom: 'Devis express par la voix', ancre: 'devis-vocal', accroche: 'Dicte sur place. Relis. Exporte.', description: 'Tes notes de chantier deviennent un brouillon de devis clair, avec tes propres prix.', detail: 'Démo utilisable ici, sans compte. Structuration simulée.' },
  { id: 'local', nom: 'Présence locale & avis', ancre: 'presence-locale', accroche: 'Sois trouvé. Facilite les retours.', description: 'Une fiche Google soignée et un message simple pour demander un avis après chaque intervention.', detail: 'Accompagnement sur ta fiche existante, sans promesse de classement.' },
] as const;

export type BesoinId = (typeof SERVICES)[number]['id'] | 'site';
export function estBesoinId(valeur: unknown): valeur is BesoinId {
  return valeur === 'site' || SERVICES.some((service) => service.id === valeur);
}
export function nomDuBesoin(id: BesoinId): string {
  return id === 'site' ? 'Site vitrine complémentaire' : SERVICES.find((service) => service.id === id)!.nom;
}

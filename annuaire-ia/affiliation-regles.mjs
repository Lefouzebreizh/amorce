const DEMO = /exemple-affiliation\.com/;

export function lienAffilieReel(outil) {
  const lien = String(outil?.lien_affiliation ?? '').trim();
  return /^https:\/\//.test(lien) && !DEMO.test(lien) && !outil?.sans_programme;
}

/**
 * Réveille une niche préparée pour le lancement automatique dès qu'elle porte
 * au moins une offre réellement rémunératrice. Les niches sensibles ne
 * reçoivent pas `activation_automatique` et restent donc en pause.
 */
export function activerSiMonetisable(base) {
  if (base?.niche?.actif !== false || base?.niche?.activation_automatique !== true) return false;
  if (!(base.outils ?? []).some(lienAffilieReel)) return false;
  base.niche.actif = true;
  return true;
}

// Utilitaires de date partagés par toutes les démarches — aucune démarche
// ne devrait recalculer ça elle-même.
const MOIS_LONG = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function moisAnnee(date) {
  return `${MOIS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

function dateLongue(date) {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function ajouterJours(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function ajouterMois(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function ajouterAns(date, n) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + n);
  return d;
}

function moisEcoules(depart, arrivee) {
  const mois = (arrivee.getFullYear() - depart.getFullYear()) * 12 + (arrivee.getMonth() - depart.getMonth());
  return Math.max(0, mois);
}

function joursRestants(dateCible) {
  const cible = new Date(dateCible);
  cible.setHours(0, 0, 0, 0);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((cible - aujourdhui) / 86400000);
}

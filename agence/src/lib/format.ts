/*
 * Formatage d'affichage.
 *
 * Le fuseau et la langue sont figés. Sans cela, le serveur (UTC) et le
 * navigateur (fuseau de l'utilisateur) produisent deux chaînes différentes pour
 * la même date, et React signale une divergence d'hydratation sur chaque ligne
 * de la liste.
 */

const FUSEAU = 'Europe/Paris';

const MONTANT = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const DATE_COURTE = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeZone: FUSEAU,
});

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: FUSEAU,
});

export function formaterMontant(montant: number): string {
  return MONTANT.format(montant);
}

export function formaterDate(iso: string): string {
  return DATE_COURTE.format(new Date(iso));
}

export function formaterDateHeure(iso: string): string {
  return DATE_LONGUE.format(new Date(iso));
}

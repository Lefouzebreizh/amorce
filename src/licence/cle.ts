/**
 * La clé de licence, et le seul endroit du module qui garde quelque chose.
 *
 * Amorce se vend une fois : il n'y a donc **pas de compte**. Pas de mot de
 * passe à perdre, pas de courriel à confirmer, pas de session à renouveler.
 * Un achat rend une clé ; on la colle dans le studio, et c'est tout.
 *
 * Ce choix va plus loin qu'une simplification. Un compte oblige le serveur à
 * savoir **qui** vous êtes ; une clé lui fait seulement savoir **qu'elle a été
 * payée**. C'est moins de données chez nous, moins à protéger, et c'est plus
 * proche de la promesse d'Amorce que ne le serait un système de comptes.
 */

const CLEF_STOCKAGE = 'amorce.licence';

/**
 * Toute lecture est protégée : `localStorage` **lève** en navigation privée et
 * quand un navigateur refuse le stockage, avant même qu'on lise quoi que ce
 * soit. Le studio doit fonctionner là aussi — sans clé, donc en offre libre.
 */
export function lireCle(): string {
  try {
    return localStorage.getItem(CLEF_STOCKAGE) ?? '';
  } catch {
    return '';
  }
}

/** Rend `false` si le navigateur refuse d'écrire, pour que l'interface le dise. */
export function poserCle(cle: string): boolean {
  try {
    localStorage.setItem(CLEF_STOCKAGE, cle.trim());
    return true;
  } catch {
    return false;
  }
}

export function oublierCle(): void {
  try {
    localStorage.removeItem(CLEF_STOCKAGE);
  } catch {
    // Rien à faire : il n'y avait rien à oublier.
  }
}

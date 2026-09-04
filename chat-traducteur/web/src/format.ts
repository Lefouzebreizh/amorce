/**
 * Les deux formats de nombre que le noyau Python produit, reproduits ici.
 *
 * Ce fichier n'a pas d'équivalent Python : il existe **parce que** le portage
 * existe. Python et JavaScript n'arrondissent pas de la même façon à égalité
 * parfaite — `format(0.125, '.0%')` rend « 12 » en Python, là que
 * `(12.5).toFixed(0)` rend « 13 » en JavaScript. Python arrondit au pair,
 * JavaScript s'éloigne de zéro.
 *
 * Le cas est rare : il demande une valeur exactement représentable en binaire
 * qui tombe pile sur un demi. Rare n'est pas jamais, et une carte partagée qui
 * affiche 13 % là où le journal du serveur dit 12 % est un défaut qu'on ne
 * saurait pas reproduire. On implémente donc l'arrondi au pair, et un test le
 * garde sur les valeurs qui font diverger les deux langages.
 */

/** Arrondi au pair, comme Python. Rend un entier. */
function arrondiAuPair(x: number): number {
  const bas = Math.floor(x);
  const reste = x - bas;
  if (reste > 0.5) return bas + 1;
  if (reste < 0.5) return bas;
  return bas % 2 === 0 ? bas : bas + 1; // égalité parfaite : on va au pair
}

/** Équivalent de `f"{x:.2f}"`. */
export function fixe2(x: number): string {
  const signe = x < 0 ? "-" : "";
  const v = Math.abs(x);
  const centiemes = arrondiAuPair(v * 100);
  const entier = Math.floor(centiemes / 100);
  const frac = String(centiemes % 100).padStart(2, "0");
  return `${signe}${entier}.${frac}`;
}

/** Équivalent de `f"{x:.0%}"`. */
export function pourcent0(x: number): string {
  const signe = x < 0 ? "-" : "";
  return `${signe}${arrondiAuPair(Math.abs(x) * 100)}%`;
}

/** Équivalent de `f"{x:.0f}"`. */
export function fixe0(x: number): string {
  const signe = x < 0 ? "-" : "";
  return `${signe}${arrondiAuPair(Math.abs(x))}`;
}

/** Équivalent de `f"{x:.1f}"`. */
export function fixe1(x: number): string {
  const signe = x < 0 ? "-" : "";
  const dixiemes = arrondiAuPair(Math.abs(x) * 10);
  return `${signe}${Math.floor(dixiemes / 10)}.${dixiemes % 10}`;
}

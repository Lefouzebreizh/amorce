/**
 * Portage de `noyau/traits.py`. **Le Python fait foi**, et il porte le statut
 * des deux frontières — hypothèses déclarées, jamais mesurées — ainsi que la
 * raison pour laquelle `hauteur` peut valoir `null` et ne doit jamais être
 * traitée comme zéro.
 *
 * Un point propre au portage : l'autocorrélation est le seul endroit du cœur
 * où le résultat dépend de l'**arithmétique flottante** et non d'une règle.
 * Python et JavaScript partagent la même norme IEEE 754 sur les doubles, si
 * bien que la somme des produits donne bit pour bit la même valeur tant que
 * l'ordre des opérations est identique. Il l'est, à dessein : la boucle
 * ci-dessous parcourt les indices dans le même ordre que sa jumelle, et ce
 * n'est pas un détail de style. Les témoins comparent les hertz rendus.
 */

export const FREQUENCE = 16_000;
export const F_MIN = 120.0;
export const F_MAX = 1400.0;
export const CONFIANCE_MIN = 0.55;
export const FRONTIERE_AIGU = 400.0;
export const FRONTIERE_LONG = 0.7;

export interface Traits {
  hauteur: number | null;
  duree: number;
  mesuresFiables: number;
}

export function aigu(t: Traits): boolean | null {
  return t.hauteur === null ? null : t.hauteur >= FRONTIERE_AIGU;
}

export function longue(t: Traits): boolean {
  return t.duree >= FRONTIERE_LONG;
}

/** Fondamentale d'un bloc par autocorrélation. Rend `[hertz, confiance]`. */
export function hauteurBloc(
  bloc: ArrayLike<number>,
  frequence: number = FREQUENCE,
): [number | null, number] {
  const n = bloc.length;
  if (n < 256) return [null, 0];

  let somme = 0;
  for (let i = 0; i < n; i++) somme += bloc[i];
  const moyenne = somme / n;

  const centre = new Array<number>(n);
  let energie = 0;
  for (let i = 0; i < n; i++) {
    centre[i] = bloc[i] - moyenne;
    energie += centre[i] * centre[i];
  }
  if (energie < 1e-9) return [null, 0];

  const tauMin = Math.max(2, Math.trunc(frequence / F_MAX));
  const tauMax = Math.min(Math.trunc(frequence / F_MIN), Math.trunc(n / 2));
  if (tauMax <= tauMin + 1) return [null, 0];

  let meilleurTau = tauMin;
  let meilleure = -1;
  for (let tau = tauMin; tau < tauMax; tau++) {
    let s = 0;
    // Un échantillon sur quatre, et dans cet ordre-là : voir le bloc de tête.
    for (let i = 0; i < n - tau; i += 4) s += centre[i] * centre[i + tau];
    const note = s / (energie / 4);
    if (note > meilleure) { meilleure = note; meilleurTau = tau; }
  }

  // Collé à une borne : c'est la signature d'un échec, pas d'un résultat.
  if (meilleurTau <= tauMin || meilleurTau >= tauMax - 1) return [null, meilleure];
  return [frequence / meilleurTau, meilleure];
}

/** Mesure hauteur et durée **dans les seules fenêtres félines**. */
export function traitsVocalisation(
  echantillons: ArrayLike<number>,
  fenetresFelines: boolean[],
  tailleFenetre: number,
  pas: number,
): Traits {
  const hauteurs: number[] = [];
  for (let i = 0; i < fenetresFelines.length; i++) {
    if (!fenetresFelines[i]) continue;
    const debut = i * pas;
    const bloc = Array.prototype.slice.call(echantillons, debut, debut + tailleFenetre);
    const [f0, confiance] = hauteurBloc(bloc);
    if (f0 !== null && confiance >= CONFIANCE_MIN) hauteurs.push(f0);
  }

  // La durée est celle de la **plus longue suite continue**, jamais le total.
  let plusLongue = 0;
  let courante = 0;
  for (const feline of fenetresFelines) {
    courante = feline ? courante + 1 : 0;
    if (courante > plusLongue) plusLongue = courante;
  }
  const duree = plusLongue
    ? (plusLongue * pas + (tailleFenetre - pas)) / FREQUENCE
    : 0;

  if (hauteurs.length === 0) return { hauteur: null, duree, mesuresFiables: 0 };
  hauteurs.sort((a, b) => a - b);
  const milieu = Math.floor(hauteurs.length / 2);
  const mediane = hauteurs.length % 2
    ? hauteurs[milieu]
    : (hauteurs[milieu - 1] + hauteurs[milieu]) / 2;
  return { hauteur: mediane, duree, mesuresFiables: hauteurs.length };
}

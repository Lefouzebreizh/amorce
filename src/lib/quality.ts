/**
 * Qualité de prévisualisation.
 *
 * Composer une image en 1080 × 1920 avec grain, vignettage et halo coûte cher.
 * Un ordinateur encaisse ; un téléphone non — et une prévisualisation qui
 * saccade rend le montage impossible à juger, ce qui est pire qu'une
 * prévisualisation un peu moins fine.
 *
 * La composition reste écrite en coordonnées de sortie ; seule une
 * transformation d'échelle est posée sur le contexte. Positions, corps de
 * police et proportions restent donc exacts, quelle que soit l'échelle, et
 * l'export repasse à 1 sans qu'une seule ligne de dessin change.
 */

export type QualityTier = {
  id: 'full' | 'high' | 'medium' | 'low';
  label: string;
  /** Facteur appliqué à la définition de sortie. */
  scale: number;
  /** Le halo sur les hautes lumières est le traitement le plus coûteux. */
  bloom: boolean;
};

export const QUALITY_TIERS: QualityTier[] = [
  { id: 'full', label: 'Maximale', scale: 1, bloom: true },
  { id: 'high', label: 'Élevée', scale: 0.7, bloom: true },
  { id: 'medium', label: 'Moyenne', scale: 0.5, bloom: true },
  { id: 'low', label: 'Fluide', scale: 0.34, bloom: false },
];

export function tierById(id: QualityTier['id']): QualityTier {
  return QUALITY_TIERS.find((t) => t.id === id) ?? QUALITY_TIERS[2];
}

/**
 * Palier de départ.
 *
 * Les capacités réelles d'un appareil ne sont pas interrogeables depuis une page
 * web : on part donc d'une estimation à partir du nombre de cœurs et de la
 * taille de l'écran, que la mesure des images corrigera ensuite.
 */
export function guessTier(): QualityTier {
  if (typeof window === 'undefined') return tierById('medium');

  const cores = navigator.hardwareConcurrency ?? 4;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  // Un écran étroit piloté au doigt est un téléphone : on part prudemment bas,
  // quitte à remonter, plutôt que d'infliger une première impression saccadée.
  if (coarse && shortSide <= 480) return tierById(cores >= 8 ? 'medium' : 'low');
  if (coarse) return tierById('medium');
  return tierById(cores >= 8 ? 'full' : 'high');
}

/** Durée d'image au-delà de laquelle l'affichage est jugé trop lent. */
const SLOW_FRAME_MS = 34;

/** Durée d'image en dessous de laquelle on peut viser plus haut. */
const FAST_FRAME_MS = 15;

/** Nombre d'images observées avant toute décision. */
const WINDOW = 45;

/**
 * Surveille la cadence et ajuste le palier.
 *
 * Le passage à un palier inférieur est franc, la remontée beaucoup plus
 * prudente : osciller entre deux paliers se verrait à l'écran comme un
 * clignotement de netteté, bien plus gênant qu'un rendu stable un cran trop bas.
 */
export class QualityGovernor {
  private durations: number[] = [];
  private lastChange = 0;
  private downgrades = 0;
  private tier: QualityTier;

  constructor(tier: QualityTier) {
    this.tier = tier;
  }

  current(): QualityTier {
    return this.tier;
  }

  /** Fige le palier sur un choix explicite de l'utilisateur. */
  set(tier: QualityTier): void {
    this.tier = tier;
    this.durations = [];
    this.downgrades = 0;
  }

  /**
   * Enregistre la durée d'une image et renvoie le nouveau palier si la
   * surveillance vient d'en décider un autre.
   */
  observe(durationMs: number, now: number): QualityTier | null {
    this.durations.push(durationMs);
    if (this.durations.length < WINDOW) return null;

    // La médiane ignore les à-coups isolés — une image longue arrive à chaque
    // changement de plan, sans que l'appareil soit pour autant dépassé.
    const sorted = [...this.durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    this.durations = [];

    if (now - this.lastChange < 2500) return null;

    const index = QUALITY_TIERS.findIndex((t) => t.id === this.tier.id);

    if (median > SLOW_FRAME_MS && index < QUALITY_TIERS.length - 1) {
      this.lastChange = now;
      this.downgrades++;
      this.tier = QUALITY_TIERS[index + 1];
      return this.tier;
    }

    // On ne remonte jamais après deux dégradations : l'appareil a déjà montré
    // qu'il ne suivait pas, et le va-et-vient serait plus visible que le gain.
    if (median < FAST_FRAME_MS && index > 0 && this.downgrades < 2) {
      this.lastChange = now;
      this.tier = QUALITY_TIERS[index - 1];
      return this.tier;
    }

    return null;
  }
}

/** Durée d'image à partir de laquelle l'interface cesse d'être manipulable. */
const PANIC_FRAME_MS = 90;

/** Nombre d'images consécutives à ce niveau avant de déclencher le secours. */
const PANIC_STREAK = 15;

/**
 * Filet de sécurité contre un palier trop lourd choisi à la main.
 *
 * Un choix explicite prime normalement sur la surveillance automatique. Mais
 * au-delà d'un certain seuil, la boucle de rendu accapare le fil principal au
 * point que l'interface ne répond plus : l'utilisateur ne peut alors même plus
 * atteindre le réglage qui l'a mis dans cet état, et n'a d'autre issue que de
 * recharger la page en perdant son montage.
 *
 * Dans ce cas précis, reprendre la main est le moindre mal — à condition de le
 * dire, ce dont se charge le panneau de réglage.
 */
export class PanicDetector {
  private streak = 0;
  private fired = false;

  /** Renvoie vrai une seule fois, à l'instant où le secours doit se déclencher. */
  observe(durationMs: number): boolean {
    if (durationMs < PANIC_FRAME_MS) {
      this.streak = 0;
      return false;
    }

    this.streak++;
    if (this.streak < PANIC_STREAK || this.fired) return false;

    this.fired = true;
    return true;
  }

  reset(): void {
    this.streak = 0;
    this.fired = false;
  }
}

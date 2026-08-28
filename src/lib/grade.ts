import { OUTPUT_HEIGHT, OUTPUT_WIDTH, type LookId } from './types.ts';

/**
 * Étalonnage cinématographique.
 *
 * Ce qui distingue une image « cinéma » d'une image brute tient à quelques
 * traitements empilés, tous reproductibles en 2D : une correction colorimétrique
 * globale, une dominante froide dans les ombres opposée à une dominante chaude
 * dans les hautes lumières, un halo sur les zones les plus claires, un
 * assombrissement des bords qui ramène l'œil au centre, et un grain qui casse la
 * propreté du numérique.
 *
 * Tout est appliqué avant les sous-titres : le texte reste net et non grainé,
 * sinon la lisibilité — qui prime sur l'esthétique en format court — en pâtirait.
 */

export type Look = {
  id: LookId;
  label: string;
  /** Ce que le rendu apporte, en une phrase compréhensible sans formation. */
  description: string;
  /** Filtre CSS appliqué au moment de tracer l'image vidéo. */
  filter: string;
  /** Teinte poussée dans les ombres. */
  shadowTint: string;
  /** Teinte poussée dans les hautes lumières. */
  highlightTint: string;
  /** Force du vignettage, de 0 à 1. */
  vignette: number;
  /** Quantité de grain, de 0 à 1. */
  grain: number;
  /** Intensité du halo sur les hautes lumières, de 0 à 1. */
  bloom: number;
  /** Remontée des noirs, qui imite le voile d'une pellicule. */
  fade: number;
};

export const LOOKS: Look[] = [
  {
    id: 'naturel',
    label: 'Naturel',
    description: 'Aucune retouche. L’image sort telle quelle.',
    filter: 'none',
    shadowTint: 'rgba(0,0,0,0)',
    highlightTint: 'rgba(0,0,0,0)',
    vignette: 0,
    grain: 0,
    bloom: 0,
    fade: 0,
  },
  {
    id: 'cinema',
    label: 'Cinéma',
    description: 'Ombres bleutées, peaux dorées. Le rendu de film le plus courant.',
    filter: 'contrast(1.12) saturate(1.08)',
    shadowTint: 'rgba(18,74,120,0.30)',
    highlightTint: 'rgba(255,168,84,0.20)',
    vignette: 0.42,
    grain: 0.16,
    bloom: 0.22,
    fade: 0.05,
  },
  {
    id: 'blockbuster',
    label: 'Blockbuster',
    description: 'Contraste marqué et couleurs franches, pour l’action.',
    filter: 'contrast(1.24) saturate(1.22) brightness(0.98)',
    shadowTint: 'rgba(8,52,96,0.36)',
    highlightTint: 'rgba(255,142,52,0.24)',
    vignette: 0.52,
    grain: 0.12,
    bloom: 0.34,
    fade: 0,
  },
  {
    id: 'argentique',
    label: 'Argentique',
    description: 'Noirs délavés et grain marqué, comme une vieille pellicule.',
    filter: 'contrast(0.94) saturate(0.86) sepia(0.16)',
    shadowTint: 'rgba(92,64,44,0.24)',
    highlightTint: 'rgba(255,226,178,0.20)',
    vignette: 0.36,
    grain: 0.52,
    bloom: 0.14,
    fade: 0.16,
  },
  {
    id: 'nuit',
    label: 'Nuit',
    description: 'Ambiance froide et sombre, pour le mystère.',
    filter: 'contrast(1.18) saturate(0.82) brightness(0.86)',
    shadowTint: 'rgba(12,32,84,0.46)',
    highlightTint: 'rgba(120,180,255,0.16)',
    vignette: 0.62,
    grain: 0.22,
    bloom: 0.28,
    fade: 0.04,
  },
  {
    id: 'or',
    label: 'Heure dorée',
    description: 'Lumière chaude de fin de journée, flatteuse sur les visages.',
    filter: 'contrast(1.06) saturate(1.16) brightness(1.04)',
    shadowTint: 'rgba(96,44,16,0.22)',
    highlightTint: 'rgba(255,186,96,0.34)',
    vignette: 0.32,
    grain: 0.14,
    bloom: 0.36,
    fade: 0.08,
  },
  {
    id: 'noir',
    label: 'Noir et blanc',
    description: 'Contraste dur, sans couleur. Tout repose sur la lumière.',
    filter: 'grayscale(1) contrast(1.28) brightness(1.02)',
    shadowTint: 'rgba(0,0,0,0.22)',
    highlightTint: 'rgba(255,255,255,0.06)',
    vignette: 0.55,
    grain: 0.34,
    bloom: 0.18,
    fade: 0.06,
  },
  {
    id: 'reve',
    label: 'Rêve',
    description: 'Halo diffus et couleurs douces, atmosphère irréelle.',
    filter: 'contrast(0.96) saturate(1.12) brightness(1.06)',
    shadowTint: 'rgba(88,60,140,0.26)',
    highlightTint: 'rgba(255,190,220,0.26)',
    vignette: 0.28,
    grain: 0.1,
    bloom: 0.62,
    fade: 0.18,
  },
];

export function getLook(id: LookId): Look {
  return LOOKS.find((l) => l.id === id) ?? LOOKS[0];
}

/** Taille du motif de grain. Assez grand pour ne pas se répéter visiblement. */
const GRAIN_TILE = 256;

/**
 * Ressources de post-traitement.
 *
 * Le motif de grain et le canevas de halo sont coûteux à fabriquer et ne
 * dépendent pas du contenu de l'image : on les crée une fois et on les réutilise
 * à chaque image, sans quoi le rendu s'effondrerait sous les allocations.
 */
export class GradePipeline {
  private grainPattern: CanvasPattern | null = null;
  private bloomCanvas: HTMLCanvasElement | null = null;

  /** Filtre à poser sur le contexte avant de tracer les images vidéo. */
  baseFilter(look: Look, intensity: number): string {
    if (look.filter === 'none' || intensity <= 0) return 'none';
    // À intensité partielle, on interpole chaque fonction vers sa valeur neutre.
    return look.filter.replace(/([a-z-]+)\(([\d.]+)\)/g, (_match, name: string, value: string) => {
      const neutral = name === 'sepia' || name === 'grayscale' ? 0 : 1;
      const scaled = neutral + (Number(value) - neutral) * intensity;
      return `${name}(${scaled.toFixed(3)})`;
    });
  }

  private ensureGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (this.grainPattern) return this.grainPattern;

    const tile = document.createElement('canvas');
    tile.width = GRAIN_TILE;
    tile.height = GRAIN_TILE;
    const tileCtx = tile.getContext('2d');
    if (!tileCtx) return null;

    const image = tileCtx.createImageData(GRAIN_TILE, GRAIN_TILE);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = 110 + Math.random() * 90;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    tileCtx.putImageData(image, 0, 0);

    this.grainPattern = ctx.createPattern(tile, 'repeat');
    return this.grainPattern;
  }

  /**
   * Applique le post-traitement sur l'image déjà composée.
   *
   * `frame` sert uniquement à déplacer le grain d'une image à l'autre : un grain
   * figé se lirait comme une salissure sur l'objectif plutôt que comme de la
   * matière argentique. `bloom` permet de couper le halo sur les appareils qui
   * ne tiennent pas la cadence.
   */
  apply(
    ctx: CanvasRenderingContext2D,
    look: Look,
    options: { intensity: number; frame: number; bars: number; bloom?: boolean },
  ): void {
    const { intensity, frame, bars, bloom = true } = options;
    const strength = Math.max(0, Math.min(1, intensity));

    if (strength > 0 && look.id !== 'naturel') {
      // Le halo est de loin le traitement le plus lourd : il est le premier
      // sacrifié quand l'appareil ne suit pas.
      if (bloom) this.drawBloom(ctx, look.bloom * strength);
      this.drawTints(ctx, look, strength);
      this.drawFade(ctx, look.fade * strength);
      this.drawVignette(ctx, look.vignette * strength);
      this.drawGrain(ctx, look.grain * strength, frame);
    }

    if (bars > 0) this.drawBars(ctx, bars);
  }

  /** Halo sur les hautes lumières, obtenu en réinjectant une copie floutée. */
  private drawBloom(ctx: CanvasRenderingContext2D, amount: number): void {
    if (amount <= 0.01) return;

    if (!this.bloomCanvas) {
      this.bloomCanvas = document.createElement('canvas');
      // Un quart de la définition suffit : le résultat est flouté de toute façon,
      // et cela divise par seize la surface à traiter.
      this.bloomCanvas.width = Math.round(OUTPUT_WIDTH / 4);
      this.bloomCanvas.height = Math.round(OUTPUT_HEIGHT / 4);
    }

    const bloomCtx = this.bloomCanvas.getContext('2d');
    if (!bloomCtx) return;

    bloomCtx.clearRect(0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
    /*
     * Le contraste extrême isole les hautes lumières : seules elles doivent
     * diffuser, sinon toute l'image se voile et perd son contraste.
     *
     * Le flou est enchaîné **ici**, sur le petit canvas, et non au moment de
     * réagrandir. Il était posé sur la destination, en pleine définition : on
     * calculait donc un quart de la surface pour l'isolement des lumières, puis
     * on floutait seize fois cette surface. Le rayon suit la réduction — quatre
     * fois plus petit sur une image quatre fois plus petite donne le même halo
     * une fois réagrandie —, si bien que le flou coûte seize fois moins de
     * surface pour un rayon quatre fois moindre.
     *
     * Un halo est par nature une image sans détail : rien de ce qu'on perd à le
     * calculer en petit ne se voit après agrandissement.
     */
    const rayon = (14 + amount * 26) / 4;
    bloomCtx.filter = `brightness(1.25) contrast(2.6) blur(${rayon.toFixed(1)}px)`;
    bloomCtx.drawImage(ctx.canvas, 0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
    bloomCtx.filter = 'none';

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = amount * 0.55;
    ctx.drawImage(this.bloomCanvas, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    ctx.restore();
  }

  /** Ombres froides contre hautes lumières chaudes, signature du rendu cinéma. */
  private drawTints(ctx: CanvasRenderingContext2D, look: Look, strength: number): void {
    ctx.save();
    ctx.globalAlpha = strength;

    // « multiply » n'agit que là où l'image est déjà sombre : la teinte se
    // dépose donc dans les ombres sans toucher aux hautes lumières.
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = look.shadowTint;
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    // Symétriquement, « screen » ne mord que sur les zones déjà claires.
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = look.highlightTint;
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    ctx.restore();
  }

  /** Remonte les noirs pour imiter le voile d'une pellicule. */
  private drawFade(ctx: CanvasRenderingContext2D, amount: number): void {
    if (amount <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighten';
    ctx.fillStyle = `rgba(38,34,48,${amount})`;
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    ctx.restore();
  }

  /** Assombrit les bords pour ramener le regard au centre du cadre. */
  private drawVignette(ctx: CanvasRenderingContext2D, amount: number): void {
    if (amount <= 0.01) return;

    const gradient = ctx.createRadialGradient(
      OUTPUT_WIDTH / 2,
      OUTPUT_HEIGHT / 2,
      OUTPUT_HEIGHT * 0.22,
      OUTPUT_WIDTH / 2,
      OUTPUT_HEIGHT / 2,
      OUTPUT_HEIGHT * 0.72,
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${amount})`);

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    ctx.restore();
  }

  /** Dépose le grain, décalé à chaque image pour qu'il vive. */
  private drawGrain(ctx: CanvasRenderingContext2D, amount: number, frame: number): void {
    if (amount <= 0.01) return;
    const pattern = this.ensureGrain(ctx);
    if (!pattern) return;

    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = amount * 0.5;
    // Décalage pseudo-aléatoire mais déterministe : identique en prévisualisation
    // et à l'export pour un même numéro d'image.
    const offsetX = (frame * 61) % GRAIN_TILE;
    const offsetY = (frame * 37) % GRAIN_TILE;
    ctx.translate(-offsetX, -offsetY);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, OUTPUT_WIDTH + GRAIN_TILE, OUTPUT_HEIGHT + GRAIN_TILE);
    ctx.restore();
  }

  /** Bandes noires horizontales, référence directe au format large du cinéma. */
  private drawBars(ctx: CanvasRenderingContext2D, amount: number): void {
    const height = OUTPUT_HEIGHT * 0.08 * Math.max(0, Math.min(1, amount));
    if (height < 1) return;
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, OUTPUT_WIDTH, height);
    ctx.fillRect(0, OUTPUT_HEIGHT - height, OUTPUT_WIDTH, height);
    ctx.restore();
  }

  dispose(): void {
    this.grainPattern = null;
    this.bloomCanvas = null;
  }
}

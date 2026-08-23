import { OUTPUT_HEIGHT, OUTPUT_WIDTH, type TransitionKind } from './types.ts';

/**
 * Transitions entre deux clips.
 *
 * Chaque transition reçoit deux fonctions de dessin — le clip sortant et le
 * clip entrant — et décide comment les composer. Les couches ne savent rien de
 * la transition : elles se contentent d'appliquer l'opacité et la transformation
 * qu'on leur passe, ce qui permet d'en ajouter une nouvelle sans toucher au
 * moteur de rendu.
 */

/** Réglages de dessin d'une couche vidéo pour une image donnée. */
export type LayerTransform = {
  alpha: number;
  /** Décalage horizontal en pixels de sortie. */
  dx: number;
  dy: number;
  /** Facteur d'échelle appliqué en plus du recadrage. */
  scale: number;
};

export type LayerDrawer = (transform: LayerTransform) => void;

const NEUTRAL: LayerTransform = { alpha: 1, dx: 0, dy: 0, scale: 1 };

/** Adoucit une progression linéaire pour éviter les départs brutaux. */
function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
}

function easeOut(p: number): number {
  return 1 - (1 - p) ** 3;
}

export const TRANSITION_LABELS: Record<TransitionKind, string> = {
  cut: 'Coupe franche',
  fade: 'Fondu',
  whipPan: 'Balayage',
  zoomPunch: 'Zoom coup de poing',
  slideUp: 'Glissement vertical',
  flash: 'Flash',
  glitch: 'Glitch',
};

/**
 * Compose les deux couches à l'instant donné de la transition.
 *
 * `progress` va de 0 (le clip sortant occupe encore tout l'écran) à 1 (le clip
 * entrant est seul). `drawFrom` vaut null en dehors d'une transition.
 */
export function applyTransition(
  kind: TransitionKind,
  progress: number,
  ctx: CanvasRenderingContext2D,
  drawFrom: LayerDrawer | null,
  drawTo: LayerDrawer,
): void {
  const p = Math.min(1, Math.max(0, progress));

  if (!drawFrom || kind === 'cut') {
    drawTo(NEUTRAL);
    return;
  }

  switch (kind) {
    case 'fade': {
      drawFrom(NEUTRAL);
      drawTo({ ...NEUTRAL, alpha: p });
      break;
    }

    case 'flash': {
      drawFrom(NEUTRAL);
      drawTo({ ...NEUTRAL, alpha: p });
      // Éclair blanc maximal au milieu de la transition, qui masque la couture.
      const intensity = 1 - Math.abs(p - 0.5) * 2;
      ctx.save();
      ctx.globalAlpha = intensity * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      ctx.restore();
      break;
    }

    case 'whipPan': {
      const e = easeInOut(p);
      drawFrom({ ...NEUTRAL, dx: -OUTPUT_WIDTH * e, scale: 1 + 0.08 * e });
      drawTo({ ...NEUTRAL, dx: OUTPUT_WIDTH * (1 - e), scale: 1 + 0.08 * (1 - e) });
      break;
    }

    case 'slideUp': {
      const e = easeInOut(p);
      drawFrom({ ...NEUTRAL, dy: -OUTPUT_HEIGHT * 0.35 * e, alpha: 1 - e * 0.4 });
      drawTo({ ...NEUTRAL, dy: OUTPUT_HEIGHT * (1 - e) });
      break;
    }

    case 'zoomPunch': {
      const e = easeOut(p);
      drawFrom({ ...NEUTRAL, scale: 1 + 0.25 * e, alpha: 1 - e });
      // Le clip entrant arrive de très loin et se pose net : l'effet « claque ».
      drawTo({ ...NEUTRAL, scale: 1.8 - 0.8 * e, alpha: Math.min(1, p * 1.6) });
      break;
    }

    case 'glitch': {
      drawFrom(NEUTRAL);
      drawTo({ ...NEUTRAL, alpha: p });
      drawGlitchBands(ctx, p, drawTo);
      break;
    }

    default: {
      drawFrom(NEUTRAL);
      drawTo({ ...NEUTRAL, alpha: p });
    }
  }
}

/**
 * Redessine des bandes horizontales décalées pour simuler une image qui
 * décroche. Les décalages sont dérivés de la progression, jamais tirés au sort :
 * une même image doit toujours donner le même rendu, sans quoi l'export
 * différerait de la prévisualisation.
 */
function drawGlitchBands(ctx: CanvasRenderingContext2D, p: number, drawTo: LayerDrawer): void {
  const intensity = 1 - Math.abs(p - 0.5) * 2;
  if (intensity <= 0.02) return;

  const bands = 7;
  const bandHeight = OUTPUT_HEIGHT / bands;

  for (let i = 0; i < bands; i++) {
    // Suite déterministe qui varie assez pour paraître aléatoire.
    const noise = Math.sin(i * 12.9898 + p * 78.233) * 43758.5453;
    const shift = ((noise - Math.floor(noise)) - 0.5) * 120 * intensity;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, i * bandHeight, OUTPUT_WIDTH, bandHeight);
    ctx.clip();
    drawTo({ alpha: 1, dx: shift, dy: 0, scale: 1 });
    ctx.restore();
  }
}

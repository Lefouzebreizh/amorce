import { OUTPUT_HEIGHT, OUTPUT_WIDTH, type Caption, type CaptionStyleId } from './types.ts';

/**
 * Sous-titres incrustés.
 *
 * La majorité du public regarde sans le son : le texte à l'écran n'est pas une
 * option de confort, c'est le principal vecteur du message. Les styles ci-dessous
 * privilégient donc tous la lisibilité sur un petit écran — corps large, fort
 * contraste, contour épais pour tenir sur n'importe quelle image.
 */

/** Polices résolues à l'exécution et transmises au moteur de rendu. */
export type FontSet = {
  /** Police d'affichage, très grasse, pour les accroches. */
  display: string;
  /** Police de texte courant. */
  body: string;
};

type CaptionStyle = {
  id: CaptionStyleId;
  label: string;
  description: string;
  /** Corps de la police en pixels, pour une sortie de 1080 px de large. */
  fontSize: number;
  weight: number;
  family: keyof FontSet;
  uppercase: boolean;
  color: string;
  stroke?: { color: string; width: number };
  shadow?: { color: string; blur: number; offsetY: number };
  /** Cartouche plein derrière le texte. */
  box?: { color: string; paddingX: number; paddingY: number; radius: number };
  /** Surlignage du mot en cours de prononciation. */
  highlight?: { color: string; color2: string };
  /** Apparition en rebond. */
  pop: boolean;
};

export const CAPTION_STYLES: Record<CaptionStyleId, CaptionStyle> = {
  punch: {
    id: 'punch',
    label: 'Punch',
    description: 'Gros titre contouré, celui qui tient le hook.',
    fontSize: 104,
    weight: 900,
    family: 'display',
    uppercase: true,
    color: '#ffffff',
    stroke: { color: '#000000', width: 16 },
    shadow: { color: 'rgba(0,0,0,0.55)', blur: 26, offsetY: 8 },
    pop: true,
  },
  karaoke: {
    id: 'karaoke',
    label: 'Karaoké',
    description: 'Le mot prononcé s’allume — imbattable pour retenir l’œil.',
    fontSize: 88,
    weight: 900,
    family: 'display',
    uppercase: true,
    color: '#ffffff',
    stroke: { color: '#000000', width: 14 },
    highlight: { color: '#22e37a', color2: '#04150c' },
    pop: false,
  },
  neon: {
    id: 'neon',
    label: 'Néon',
    description: 'Halo coloré, lisible même sur une image chargée.',
    fontSize: 92,
    weight: 900,
    family: 'display',
    uppercase: true,
    color: '#ffffff',
    stroke: { color: '#0a0a12', width: 10 },
    shadow: { color: '#48d2ff', blur: 44, offsetY: 0 },
    pop: true,
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    description: 'Discret, pour ne pas manger l’image.',
    fontSize: 62,
    weight: 700,
    family: 'body',
    uppercase: false,
    color: '#ffffff',
    shadow: { color: 'rgba(0,0,0,0.75)', blur: 18, offsetY: 3 },
    pop: false,
  },
  subtitle: {
    id: 'subtitle',
    label: 'Cartouche',
    description: 'Bandeau sombre classique, lisibilité garantie.',
    fontSize: 56,
    weight: 600,
    family: 'body',
    uppercase: false,
    color: '#ffffff',
    box: { color: 'rgba(0,0,0,0.72)', paddingX: 28, paddingY: 16, radius: 14 },
    pop: false,
  },
};

/** Largeur maximale du bloc de texte, en pixels de sortie. */
const MAX_TEXT_WIDTH = OUTPUT_WIDTH * 0.86;
const LINE_HEIGHT_RATIO = 1.18;
const POP_DURATION = 0.24;

/** Durée d'un aller-retour de la pulsation, en secondes. */
const PULSE_PERIOD = 0.7;

/**
 * Amplitude de la pulsation.
 *
 * Volontairement faible. Un texte qui enfle de moitié cesse d'être un texte et
 * devient un gadget ; à cinq pour cent, l'œil perçoit un battement sans jamais
 * perdre le mot. C'est aussi ce qui garde le bloc dans la largeur autorisée,
 * calculée elle sur la taille au repos.
 */
const PULSE_DEPTH = 0.05;

function fontString(style: CaptionStyle, fonts: FontSet, scale: number): string {
  return `${style.weight} ${Math.round(style.fontSize * scale)}px ${fonts[style.family]}`;
}

/** Rectangle occupé par un sous-titre, en coordonnées de sortie. */
export type CaptionBox = { x: number; y: number; width: number; height: number };

/** Découpe le texte en lignes qui tiennent dans la largeur autorisée. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Facteur d'échelle de l'animation d'apparition.
 *
 * Dépasse volontairement 1 en cours de route : le léger rebond est ce qui rend
 * l'apparition perceptible en une fraction de seconde.
 */
/**
 * Facteur d'échelle de la pulsation, pour un texte qui doit battre.
 *
 * Un compte à rebours, un « plus que 3 jours », une question finale : ce sont
 * les seuls textes qui gagnent à ne pas rester immobiles. Le battement se
 * calcule à partir du temps de la timeline, jamais d'une horloge réelle —
 * l'export doit produire exactement la même image que la prévisualisation.
 */
export function pulseScale(elapsed: number): number {
  if (elapsed < 0) return 1;
  return 1 + PULSE_DEPTH * Math.sin((2 * Math.PI * elapsed) / PULSE_PERIOD);
}

export function popScale(elapsed: number): number {
  if (elapsed >= POP_DURATION) return 1;
  if (elapsed < 0) return 0;
  const p = elapsed / POP_DURATION;
  return 0.72 + 0.34 * Math.sin(p * Math.PI * 0.85) + 0.28 * p;
}

/**
 * Index du mot « prononcé » à cet instant, pour le style karaoké.
 *
 * Faute de piste de parole analysable, la durée du sous-titre est répartie
 * uniformément entre ses mots. C'est une approximation, mais elle suffit à
 * produire le mouvement continu qui retient le regard.
 */
export function activeWordIndex(caption: Caption, time: number, wordCount: number): number {
  const span = Math.max(0.001, caption.end - caption.start);
  const progress = (time - caption.start) / span;
  return Math.min(wordCount - 1, Math.max(0, Math.floor(progress * wordCount)));
}

/** Sous-titres visibles à l'instant donné. */
export function captionsAt(captions: Caption[], time: number): Caption[] {
  return captions.filter((c) => time >= c.start && time <= c.end);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * Dessine un sous-titre sur le canvas de sortie.
 *
 * Renvoie le rectangle occupé, dont l'interface se sert pour savoir quel
 * sous-titre se trouve sous le doigt : sans cette information, un texte dessiné
 * dans un canvas n'est pas plus cliquable qu'une image.
 */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  caption: Caption,
  time: number,
  fonts: FontSet,
): CaptionBox | null {
  const style = CAPTION_STYLES[caption.style];
  const text = style.uppercase ? caption.text.toUpperCase() : caption.text;
  if (!text.trim()) return null;

  const scale = caption.scale ?? 1;
  const fontSize = style.fontSize * scale;

  ctx.save();
  ctx.font = fontString(style, fonts, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapLines(ctx, text, MAX_TEXT_WIDTH);
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  const blockHeight = lines.length * lineHeight;
  const centerY = caption.y * OUTPUT_HEIGHT;

  // L'animation part du centre du bloc pour que le rebond reste symétrique.
  // Apparition et pulsation se multiplient : le texte rebondit en arrivant,
  // puis continue de battre, sans que l'une n'annule l'autre.
  const elapsed = time - caption.start;
  const animation = (style.pop ? popScale(elapsed) : 1) * (caption.pulse ? pulseScale(elapsed) : 1);

  if (animation !== 1) {
    ctx.translate(OUTPUT_WIDTH / 2, centerY);
    ctx.scale(animation, animation);
    ctx.translate(-OUTPUT_WIDTH / 2, -centerY);
  }

  const firstLineY = centerY - blockHeight / 2 + lineHeight / 2;
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));

  if (style.box) {
    roundedRect(
      ctx,
      OUTPUT_WIDTH / 2 - widest / 2 - style.box.paddingX,
      firstLineY - lineHeight / 2 - style.box.paddingY,
      widest + style.box.paddingX * 2,
      blockHeight + style.box.paddingY * 2,
      style.box.radius,
    );
    ctx.fillStyle = style.box.color;
    ctx.fill();
  }

  const color = caption.color ?? style.color;

  if (style.highlight) {
    drawKaraokeLines(ctx, lines, caption, time, style, firstLineY, lineHeight, scale);
  } else {
    lines.forEach((line, index) => {
      drawStyledText(ctx, line, OUTPUT_WIDTH / 2, firstLineY + index * lineHeight, style, color, scale);
    });
  }

  ctx.restore();

  /*
   * Zone tactile élargie.
   *
   * Le rectangle strict du texte est difficile à viser au doigt, surtout sur
   * une ligne courte. On l'étend d'une marge généreuse, quitte à ce que deux
   * sous-titres voisins se chevauchent — le plus proche du point touché
   * l'emporte de toute façon.
   */
  const padX = 40;
  const padY = 24;
  return {
    x: OUTPUT_WIDTH / 2 - widest / 2 - padX,
    y: centerY - blockHeight / 2 - padY,
    width: widest + padX * 2,
    height: blockHeight + padY * 2,
  };
}

/** Vrai si le point est dans le rectangle. */
export function boxContains(box: CaptionBox, x: number, y: number): boolean {
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

/** Trace un texte avec son contour et son ombre éventuels. */
function drawStyledText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: CaptionStyle,
  color: string,
  scale = 1,
): void {
  ctx.save();
  if (style.shadow) {
    ctx.shadowColor = style.shadow.color;
    ctx.shadowBlur = style.shadow.blur * scale;
    ctx.shadowOffsetY = style.shadow.offsetY * scale;
  }
  if (style.stroke) {
    ctx.lineWidth = style.stroke.width * scale;
    ctx.strokeStyle = style.stroke.color;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(text, x, y);
  }
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Texte lisible sur un fond donné : noir ou blanc, jamais autre chose.
 *
 * La luminance perçue n'est pas la moyenne des composantes — l'œil est bien
 * plus sensible au vert qu'au bleu. Un jaune vif et un bleu vif ont la même
 * moyenne et des luminances qui vont du simple au triple ; s'en remettre à la
 * moyenne poserait du texte noir sur le bleu, illisible.
 *
 * Le choix n'est pas laissé à l'utilisateur : deux sélecteurs de couleur
 * permettraient de composer un couple invisible en deux gestes.
 */
export function readableOn(background: string): string {
  const hex = background.replace('#', '');
  if (hex.length !== 6) return '#0a0a0a';

  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? '#0a0a0a' : '#ffffff';
}

/** Trace les lignes en surlignant le mot courant. */
function drawKaraokeLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  caption: Caption,
  time: number,
  style: CaptionStyle,
  firstLineY: number,
  lineHeight: number,
  scale = 1,
): void {
  const allWords = lines.flatMap((line) => line.split(' '));
  const active = activeWordIndex(caption, time, allWords.length);
  const spaceWidth = ctx.measureText(' ').width;
  let wordCursor = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const words = lines[lineIndex].split(' ');
    const lineWidth = ctx.measureText(lines[lineIndex]).width;
    const y = firstLineY + lineIndex * lineHeight;
    let x = OUTPUT_WIDTH / 2 - lineWidth / 2;

    for (const word of words) {
      const width = ctx.measureText(word).width;
      const isActive = wordCursor === active;
      const centerX = x + width / 2;

      if (isActive && style.highlight) {
        ctx.save();
        roundedRect(
          ctx,
          x - 14 * scale,
          y - style.fontSize * scale * 0.58,
          width + 28 * scale,
          style.fontSize * scale * 1.16,
          16 * scale,
        );
        ctx.fillStyle = caption.highlightColor ?? style.highlight.color;
        ctx.fill();
        ctx.restore();
      }

      drawStyledText(
        ctx,
        word,
        centerX,
        y,
        // Le contour noir nuit à la lisibilité sur le pavé de surlignage.
        isActive && style.highlight ? { ...style, stroke: undefined } : style,
        isActive && style.highlight
          ? // Le style porte sa propre couleur de texte tant qu'on ne lui en a
            // pas imposé une autre ; dès qu'on change la pastille, seul le
            // contraste décide.
            caption.highlightColor
            ? readableOn(caption.highlightColor)
            : style.highlight.color2
          : (caption.color ?? style.color),
        scale,
      );

      x += width + spaceWidth;
      wordCursor++;
    }
  }
}

import type { SfxId } from './types.ts';

/**
 * Bruitages de synthèse.
 *
 * Aucun fichier audio n'est embarqué : tout est fabriqué à la volée avec des
 * oscillateurs et du bruit filtré. Ça évite d'avoir à héberger une bibliothèque
 * de sons et, surtout, ça règle la question des licences — ces sons n'existaient
 * pas avant d'être joués.
 *
 * Les mêmes fonctions servent à la prévisualisation et à l'export : elles
 * acceptent aussi bien un `AudioContext` temps réel qu'un contexte hors ligne.
 */

type AnyAudioContext = BaseAudioContext;

export type SfxDescriptor = {
  id: SfxId;
  label: string;
  description: string;
  /** Durée approximative, utilisée pour l'affichage sur la timeline. */
  duration: number;
};

export const SFX_LIBRARY: SfxDescriptor[] = [
  { id: 'whoosh', label: 'Whoosh', description: 'Souffle de transition', duration: 0.5 },
  { id: 'boom', label: 'Impact', description: 'Coup grave qui ponctue', duration: 0.7 },
  { id: 'punch', label: 'Coup sec', description: 'Frappe courte et nette', duration: 0.2 },
  { id: 'subdrop', label: 'Chute grave', description: 'Basse qui plonge, pour un dévoilement', duration: 1.3 },
  { id: 'riser', label: 'Montée', description: 'Tension qui grimpe avant la chute', duration: 1.2 },
  { id: 'reverse', label: 'Aspiration', description: 'Souffle inversé, à poser juste avant une coupe', duration: 0.9 },
  { id: 'ding', label: 'Ding', description: 'Clochette de révélation', duration: 0.6 },
  { id: 'sparkle', label: 'Étincelles', description: 'Scintillement, pour un détail qui apparaît', duration: 0.7 },
  { id: 'zap', label: 'Grésillement', description: 'Décrochage numérique, va avec le glitch', duration: 0.3 },
  { id: 'swipe', label: 'Swipe', description: 'Balayage court', duration: 0.3 },
  { id: 'wind', label: 'Souffle long', description: 'Transition ample, sur un fondu', duration: 1.5 },
  { id: 'pop', label: 'Pop', description: 'Apparition d’élément', duration: 0.18 },
  { id: 'click', label: 'Clic', description: 'Ponctuation sèche', duration: 0.06 },
];

/** Durée d'un bruitage, pour le placement sur la timeline. */
export function sfxDuration(id: SfxId): number {
  return SFX_LIBRARY.find((s) => s.id === id)?.duration ?? 0.5;
}

/**
 * Un tampon de bruit blanc par contexte, réutilisé par tous les bruitages.
 * Le régénérer à chaque déclenchement coûterait cher pour aucun bénéfice audible.
 */
const noiseCache = new WeakMap<AnyAudioContext, AudioBuffer>();

function noiseBuffer(ctx: AnyAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;

  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

  noiseCache.set(ctx, buffer);
  return buffer;
}

/**
 * Enveloppe de volume percussive.
 *
 * `exponentialRampToValueAtTime` refuse la valeur zéro, d'où la descente
 * exponentielle vers une valeur minuscule suivie d'une coupure linéaire.
 */
function envelope(
  gainNode: GainNode,
  when: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, when);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
  g.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  g.linearRampToValueAtTime(0, when + attack + decay + 0.01);
}

function connectNoise(
  ctx: AnyAudioContext,
  dest: AudioNode,
  when: number,
  duration: number,
): { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  source.start(when);
  source.stop(when + duration + 0.05);

  return { source, gain, filter };
}

/**
 * Planifie un bruitage sur le contexte audio, à l'instant `when`.
 *
 * Renvoie les sources créées : l'appelant en a besoin pour les interrompre si
 * la lecture est mise en pause avant qu'elles n'aient fini de sonner.
 */
export function scheduleSfx(
  ctx: AnyAudioContext,
  dest: AudioNode,
  id: SfxId,
  when: number,
  gain = 0.8,
): AudioScheduledSourceNode[] {
  // Un déclenchement dans le passé ferait lever une exception au navigateur.
  const at = Math.max(when, ctx.currentTime);
  const level = Math.max(0, Math.min(1, gain));
  const sources: AudioScheduledSourceNode[] = [];
  if (level === 0) return sources;

  switch (id) {
    case 'whoosh': {
      const { gain: g, filter, source } = connectNoise(ctx, dest, at, 0.5);
      sources.push(source);
      filter.type = 'bandpass';
      // Q basse : une bande large laisse passer la matière du bruit. Trop
      // étroite, il ne reste qu'un sifflement fin qui ne s'entend pas.
      filter.Q.value = 0.6;
      filter.frequency.setValueAtTime(400, at);
      filter.frequency.exponentialRampToValueAtTime(3200, at + 0.25);
      filter.frequency.exponentialRampToValueAtTime(500, at + 0.5);
      envelope(g, at, level * 1.1, 0.07, 0.38);
      break;
    }

    case 'boom': {
      // Le grave porte l'impact, le bruit filtré lui donne de la matière.
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, at);
      osc.frequency.exponentialRampToValueAtTime(32, at + 0.45);
      osc.connect(oscGain);
      oscGain.connect(dest);
      envelope(oscGain, at, level * 1.5, 0.006, 0.7);
      osc.start(at);
      osc.stop(at + 0.75);
      sources.push(osc);

      const { gain: g, filter, source } = connectNoise(ctx, dest, at, 0.25);
      sources.push(source);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, at);
      envelope(g, at, level * 0.7, 0.004, 0.22);
      break;
    }

    case 'ding': {
      // Deux partiels non harmoniques : la sonorité tire vers la cloche.
      for (const [frequency, amplitude, decay] of [
        [1480, 1.1, 0.6],
        [2260, 0.6, 0.45],
      ] as const) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, at);
        osc.connect(g);
        g.connect(dest);
        envelope(g, at, level * amplitude, 0.004, decay);
        osc.start(at);
        osc.stop(at + decay + 0.1);
        sources.push(osc);
      }
      break;
    }

    case 'riser': {
      const { gain: g, filter, source } = connectNoise(ctx, dest, at, 1.2);
      sources.push(source);
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(200, at);
      filter.frequency.exponentialRampToValueAtTime(7000, at + 1.15);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 1.0), at + 1.1);
      g.gain.linearRampToValueAtTime(0, at + 1.2);

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, at);
      osc.frequency.exponentialRampToValueAtTime(1500, at + 1.15);
      osc.connect(oscGain);
      oscGain.connect(dest);
      oscGain.gain.setValueAtTime(0.0001, at);
      oscGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.4), at + 1.1);
      oscGain.gain.linearRampToValueAtTime(0, at + 1.2);
      osc.start(at);
      osc.stop(at + 1.25);
      sources.push(osc);
      break;
    }

    case 'pop': {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(760, at);
      osc.frequency.exponentialRampToValueAtTime(190, at + 0.13);
      osc.connect(g);
      g.connect(dest);
      envelope(g, at, level * 1.1, 0.004, 0.14);
      osc.start(at);
      osc.stop(at + 0.2);
      sources.push(osc);
      break;
    }

    case 'click': {
      const { gain: g, filter, source } = connectNoise(ctx, dest, at, 0.06);
      sources.push(source);
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2400, at);
      envelope(g, at, level * 0.9, 0.002, 0.05);
      break;
    }

    case 'swipe': {
      const { gain: g, filter, source } = connectNoise(ctx, dest, at, 0.3);
      sources.push(source);
      filter.type = 'bandpass';
      filter.Q.value = 2.5;
      filter.frequency.setValueAtTime(3400, at);
      filter.frequency.exponentialRampToValueAtTime(620, at + 0.28);
      envelope(g, at, level * 1.0, 0.008, 0.28);
      break;
    }

    case 'punch': {
      // Une transitoire sèche par-dessus un grave très court : c'est la
      // brièveté qui donne l'impression de frappe, pas le volume.
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, at);
      osc.frequency.exponentialRampToValueAtTime(48, at + 0.12);
      osc.connect(oscGain);
      oscGain.connect(dest);
      envelope(oscGain, at, level * 1.5, 0.003, 0.16);
      osc.start(at);
      osc.stop(at + 0.25);
      sources.push(osc);

      const { gain: g, filter, source } = connectNoise(ctx, dest, at, 0.09);
      sources.push(source);
      filter.type = 'bandpass';
      filter.Q.value = 0.9;
      filter.frequency.setValueAtTime(1800, at);
      envelope(g, at, level * 0.9, 0.002, 0.07);
      break;
    }

    case 'subdrop': {
      // La descente sous le seuil d'audition se ressent plus qu'elle ne
      // s'entend : c'est l'effet recherché sous un dévoilement.
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, at);
      osc.frequency.exponentialRampToValueAtTime(24, at + 1.1);
      osc.connect(g);
      g.connect(dest);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 1.6), at + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.25);
      g.gain.linearRampToValueAtTime(0, at + 1.3);
      osc.start(at);
      osc.stop(at + 1.35);
      sources.push(osc);
      break;
    }

    case 'reverse': {
      // Enveloppe croissante puis coupure nette : l'oreille anticipe un
      // évènement, la coupe qui suit le lui donne.
      const { gain: g, filter, source } = connectNoise(ctx, dest, at, 0.9);
      sources.push(source);
      filter.type = 'bandpass';
      filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(600, at);
      filter.frequency.exponentialRampToValueAtTime(5200, at + 0.85);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 1.2), at + 0.82);
      // Coupure franche plutôt qu'une décroissance : c'est la rupture qui fait
      // l'effet, une extinction douce le dissoudrait.
      g.gain.linearRampToValueAtTime(0, at + 0.88);
      break;
    }

    case 'sparkle': {
      // Suite fixe et non tirée au sort : la prévisualisation et l'export
      // doivent produire exactement le même son.
      const partials = [2400, 3100, 1900, 3800, 2700];
      partials.forEach((frequency, index) => {
        const start = at + index * 0.085;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, start);
        osc.connect(g);
        g.connect(dest);
        envelope(g, start, level * (0.85 - index * 0.1), 0.004, 0.22);
        osc.start(start);
        osc.stop(start + 0.3);
        sources.push(osc);
      });
      break;
    }

    case 'zap': {
      // Sauts de hauteur par paliers : l'oreille y entend un signal qui
      // décroche, ce qui accompagne le glitch à l'image.
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      const steps = [1200, 380, 2100, 640, 1500, 300];
      steps.forEach((frequency, index) => {
        osc.frequency.setValueAtTime(frequency, at + index * 0.04);
      });
      osc.connect(g);
      g.connect(dest);
      envelope(g, at, level * 0.75, 0.002, 0.26);
      osc.start(at);
      osc.stop(at + 0.32);
      sources.push(osc);
      break;
    }

    case 'wind': {
      const { gain: g, filter, source } = connectNoise(ctx, dest, at, 1.5);
      sources.push(source);
      filter.type = 'bandpass';
      filter.Q.value = 0.45;
      filter.frequency.setValueAtTime(260, at);
      filter.frequency.exponentialRampToValueAtTime(2200, at + 0.75);
      filter.frequency.exponentialRampToValueAtTime(320, at + 1.45);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.9), at + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.45);
      g.gain.linearRampToValueAtTime(0, at + 1.5);
      break;
    }
  }

  return sources;
}

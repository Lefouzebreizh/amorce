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
  { id: 'ding', label: 'Ding', description: 'Clochette de révélation', duration: 0.6 },
  { id: 'riser', label: 'Montée', description: 'Tension qui grimpe avant la chute', duration: 1.2 },
  { id: 'pop', label: 'Pop', description: 'Apparition d’élément', duration: 0.18 },
  { id: 'click', label: 'Clic', description: 'Ponctuation sèche', duration: 0.06 },
  { id: 'swipe', label: 'Swipe', description: 'Balayage court', duration: 0.3 },
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
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(400, at);
      filter.frequency.exponentialRampToValueAtTime(3200, at + 0.25);
      filter.frequency.exponentialRampToValueAtTime(500, at + 0.5);
      envelope(g, at, level * 0.55, 0.12, 0.34);
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
      envelope(oscGain, at, level * 0.9, 0.008, 0.6);
      osc.start(at);
      osc.stop(at + 0.75);
      sources.push(osc);

      const { gain: g, filter, source } = connectNoise(ctx, dest, at, 0.25);
      sources.push(source);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, at);
      envelope(g, at, level * 0.3, 0.005, 0.2);
      break;
    }

    case 'ding': {
      // Deux partiels non harmoniques : la sonorité tire vers la cloche.
      for (const [frequency, amplitude, decay] of [
        [1480, 0.6, 0.55],
        [2260, 0.32, 0.4],
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
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.5), at + 1.1);
      g.gain.linearRampToValueAtTime(0, at + 1.2);

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, at);
      osc.frequency.exponentialRampToValueAtTime(1500, at + 1.15);
      osc.connect(oscGain);
      oscGain.connect(dest);
      oscGain.gain.setValueAtTime(0.0001, at);
      oscGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.18), at + 1.1);
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
      envelope(g, at, level * 0.6, 0.005, 0.13);
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
      envelope(g, at, level * 0.4, 0.002, 0.04);
      break;
    }

    case 'swipe': {
      const { gain: g, filter, source } = connectNoise(ctx, dest, at, 0.3);
      sources.push(source);
      filter.type = 'bandpass';
      filter.Q.value = 2.5;
      filter.frequency.setValueAtTime(3400, at);
      filter.frequency.exponentialRampToValueAtTime(620, at + 0.28);
      envelope(g, at, level * 0.45, 0.01, 0.26);
      break;
    }
  }

  return sources;
}

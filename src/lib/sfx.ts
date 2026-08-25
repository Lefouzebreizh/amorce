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
 *
 * Trois choix expliquent la sonorité obtenue, et aucun n'est décoratif.
 *
 * 1. Les graves sont doublés de leurs harmoniques. Un impact de bande-annonce
 *    descend vers 30 Hz, et un haut-parleur de téléphone ne restitue rien sous
 *    400 Hz : en sinus pur, ces sons étaient purement et simplement absents de
 *    l'appareil où le format court est regardé. La saturation fabrique les
 *    harmoniques 2f, 3f… qui, elles, passent — c'est ce que fait tout mastering
 *    destiné à l'écoute mobile.
 * 2. Une réverbération commune est partagée par tous. Sans queue, un impact
 *    s'entend comme un bip d'interface, pas comme un évènement dans un espace.
 *    La réponse impulsionnelle est fabriquée ici aussi, donc rien à héberger.
 * 3. Ce qui est fait de bruit est écarté en stéréo. Un souffle mono reste collé
 *    au centre, là où toute la parole se trouve déjà.
 */

type AnyAudioContext = BaseAudioContext;

export type SfxDescriptor = {
  id: SfxId;
  label: string;
  description: string;
  duration: number;
};

export const SFX_LIBRARY: SfxDescriptor[] = [
  { id: 'whoosh', label: 'Whoosh', description: 'Souffle de transition', duration: 0.75 },
  { id: 'boom', label: 'Impact', description: 'Coup grave qui ponctue', duration: 2 },
  { id: 'punch', label: 'Coup sec', description: 'Frappe courte et nette', duration: 0.4 },
  { id: 'subdrop', label: 'Chute grave', description: 'Basse qui plonge, pour un dévoilement', duration: 1.9 },
  { id: 'riser', label: 'Montée', description: 'Tension qui grimpe avant la chute', duration: 1.3 },
  { id: 'reverse', label: 'Aspiration', description: 'Souffle inversé, à poser juste avant une coupe', duration: 0.9 },
  { id: 'ding', label: 'Ding', description: 'Clochette de révélation', duration: 1.4 },
  { id: 'sparkle', label: 'Étincelles', description: 'Scintillement, pour un détail qui apparaît', duration: 1.1 },
  { id: 'zap', label: 'Grésillement', description: 'Décrochage numérique, va avec le glitch', duration: 0.45 },
  { id: 'swipe', label: 'Swipe', description: 'Balayage court', duration: 0.4 },
  { id: 'wind', label: 'Souffle long', description: 'Transition ample, sur un fondu', duration: 1.8 },
  { id: 'pop', label: 'Pop', description: 'Apparition d’élément', duration: 0.3 },
  { id: 'click', label: 'Clic', description: 'Ponctuation sèche', duration: 0.08 },
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
 * Courbe de saturation douce, calculée une fois pour toutes.
 *
 * Une tangente hyperbolique plutôt qu'un écrêtage franc : la transition
 * progressive vers la limite ajoute surtout les premières harmoniques, celles
 * qui rendent le grave audible, là où un écrêtage dur en ajouterait des dizaines
 * et transformerait l'impact en grésillement.
 */
const SATURATION = (() => {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 3.2);
  }
  return curve;
})();

/**
 * Générateur pseudo-aléatoire à graine fixe.
 *
 * La réponse impulsionnelle doit être identique d'une exécution à l'autre :
 * `Math.random` ferait que la queue de réverbération entendue en
 * prévisualisation ne serait pas celle gravée à l'export.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

const impulseCache = new WeakMap<AnyAudioContext, AudioBuffer>();

/**
 * Réponse impulsionnelle d'une salle, fabriquée plutôt qu'enregistrée.
 *
 * Du bruit qui s'éteint, assombri par un filtre à un pôle. C'est cette
 * extinction plus rapide des aigus que des graves qui distingue une salle d'une
 * simple répétition : sans elle, la queue siffle et s'entend comme un artefact.
 */
function impulseResponse(ctx: AnyAudioContext): AudioBuffer {
  const cached = impulseCache.get(ctx);
  if (cached) return cached;

  const length = Math.floor(ctx.sampleRate * 1.3);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  // Une seule suite pour les deux canaux : ils reçoivent donc des valeurs
  // différentes, ce qui décorrèle la queue et lui donne sa largeur.
  const random = seeded(0x5eed);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let previous = 0;
    for (let i = 0; i < length; i++) {
      previous = previous * 0.72 + (random() * 2 - 1) * 0.28;
      data[i] = previous * Math.pow(1 - i / length, 2.6);
    }
  }

  impulseCache.set(ctx, buffer);
  return buffer;
}

/**
 * Départ de réverbération pour une destination donnée, mis en cache.
 *
 * Un seul convolueur pour tous les bruitages : la convolution est l'opération
 * la plus coûteuse du graphe, et en instancier un par déclenchement mettrait un
 * téléphone à genoux dès la troisième coupe.
 */
const reverbCache = new WeakMap<AudioNode, GainNode>();

function reverbSend(ctx: AnyAudioContext, dest: AudioNode): GainNode {
  const cached = reverbCache.get(dest);
  if (cached) return cached;

  const convolver = ctx.createConvolver();
  convolver.buffer = impulseResponse(ctx);
  const send = ctx.createGain();
  send.connect(convolver);
  convolver.connect(dest);

  reverbCache.set(dest, send);
  return send;
}

/** Branche une couche sur la sortie sèche, et sur la réverbération s'il y a lieu. */
function sendTo(node: AudioNode, dest: AudioNode, send: GainNode, wet: number): void {
  node.connect(dest);
  if (wet <= 0) return;

  const tap = node.context.createGain();
  tap.gain.value = wet;
  node.connect(tap);
  tap.connect(send);
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

/**
 * Source de bruit filtrée, éventuellement placée dans l'image stéréo.
 *
 * Le décalage de lecture sert à décorréler deux voies : les deux lisent le même
 * tampon, et les faire partir au même endroit produirait un signal identique à
 * gauche et à droite — c'est-à-dire un son mono, exactement ce qu'on cherchait
 * à éviter.
 */
function connectNoise(
  ctx: AnyAudioContext,
  when: number,
  duration: number,
  pan = 0,
  offset = 0,
): { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode; out: AudioNode } {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.connect(filter);
  filter.connect(gain);

  let out: AudioNode = gain;
  if (pan !== 0) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    gain.connect(panner);
    out = panner;
  }

  source.start(when, offset);
  source.stop(when + duration + 0.05);

  return { source, gain, filter, out };
}

/**
 * Grave d'impact, doublé de ses harmoniques.
 *
 * Deux couches issues du même oscillateur. La couche propre porte le poids sur
 * une vraie enceinte ; la couche saturée, filtrée au-dessus de 140 Hz, est la
 * seule qui survive à un haut-parleur de téléphone. Les jouer ensemble donne un
 * impact qui garde sa masse au casque sans disparaître sur l'appareil.
 */
function impact(
  ctx: AnyAudioContext,
  dest: AudioNode,
  send: GainNode,
  at: number,
  o: {
    from: number;
    to: number;
    glide: number;
    peak: number;
    attack: number;
    decay: number;
    wet: number;
    /** Poids des harmoniques face à la couche propre. */
    drive: number;
  },
): AudioScheduledSourceNode {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(o.from, at);
  osc.frequency.exponentialRampToValueAtTime(o.to, at + o.glide);

  /*
   * Les deux couches se partagent le niveau demandé, elles ne s'y ajoutent pas.
   *
   * Sans cette répartition, doubler un grave de ses harmoniques faisait monter
   * la crête d'autant — un « coup sec » passait de 1,45 à 2,15 — et le limiteur
   * commun, en écrasant cette crête, faisait plonger tout le reste du mixage à
   * chaque frappe. On entendait alors la musique pomper au rythme des impacts.
   */
  const share = 1 / (1 + o.drive);

  const clean = ctx.createGain();
  osc.connect(clean);
  sendTo(clean, dest, send, o.wet);
  envelope(clean, at, o.peak * share, o.attack, o.decay);

  const shaper = ctx.createWaveShaper();
  shaper.curve = SATURATION;
  const lift = ctx.createBiquadFilter();
  lift.type = 'highpass';
  lift.frequency.value = 140;
  const harmonic = ctx.createGain();

  osc.connect(shaper);
  shaper.connect(lift);
  lift.connect(harmonic);
  sendTo(harmonic, dest, send, o.wet);
  // Les harmoniques s'éteignent avant le fondamental : elles marquent la
  // frappe, c'est le grave qui doit rester après elle.
  envelope(harmonic, at, o.peak * o.drive * share, o.attack, o.decay * 0.72);

  osc.start(at);
  osc.stop(at + o.attack + o.decay + 0.12);
  return osc;
}

/**
 * Planifie un bruitage sur le contexte audio, à l'instant `when`.
 *
 * Renvoie les sources créées : l'appelant en a besoin pour les interrompre si
 * la lecture est mise en pause avant qu'elles n'aient fini de sonner. La queue
 * de réverbération, elle, s'éteint d'elle-même — l'interrompre net produirait
 * un claquement bien plus audible que le reste de la queue.
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

  const send = reverbSend(ctx, dest);

  switch (id) {
    case 'whoosh': {
      // Deux voies opposées dans l'image : le souffle traverse au lieu de
      // rester posé au centre, là où la voix se trouve déjà.
      for (const [pan, offset, delay] of [
        [-0.7, 0, 0],
        [0.7, 0.9, 0.02],
      ] as const) {
        const start = at + delay;
        const { gain: g, filter, source, out } = connectNoise(ctx, start, 0.6, pan, offset);
        sources.push(source);
        sendTo(out, dest, send, 0.35);
        filter.type = 'bandpass';
        // Q basse : une bande large laisse passer la matière du bruit. Trop
        // étroite, il ne reste qu'un sifflement fin qui ne s'entend pas.
        filter.Q.value = 0.6;
        filter.frequency.setValueAtTime(320, start);
        filter.frequency.exponentialRampToValueAtTime(3600, start + 0.3);
        filter.frequency.exponentialRampToValueAtTime(420, start + 0.6);
        envelope(g, start, level * 0.95, 0.08, 0.48);
      }
      break;
    }

    case 'boom': {
      sources.push(
        impact(ctx, dest, send, at, {
          from: 120,
          to: 34,
          glide: 0.5,
          peak: level * 1.4,
          attack: 0.006,
          decay: 1.5,
          wet: 0.5,
          drive: 0.55,
        }),
      );

      // Le corps : une couche de bruit grave qui donne sa matière à la frappe.
      const { gain: g, filter, source, out } = connectNoise(ctx, at, 0.35);
      sources.push(source);
      sendTo(out, dest, send, 0.5);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, at);
      filter.frequency.exponentialRampToValueAtTime(180, at + 0.3);
      envelope(g, at, level * 0.7, 0.004, 0.3);
      break;
    }

    case 'ding': {
      // Trois partiels non harmoniques : la sonorité tire vers la cloche.
      for (const [frequency, amplitude, decay] of [
        [1480, 0.95, 1],
        [2260, 0.5, 0.75],
        [3320, 0.25, 0.5],
      ] as const) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, at);
        osc.connect(g);
        sendTo(g, dest, send, 0.65);
        envelope(g, at, level * amplitude, 0.004, decay);
        osc.start(at);
        osc.stop(at + decay + 0.1);
        sources.push(osc);
      }
      break;
    }

    case 'riser': {
      const { gain: g, filter, source, out } = connectNoise(ctx, at, 1.2);
      sources.push(source);
      sendTo(out, dest, send, 0.3);
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(200, at);
      filter.frequency.exponentialRampToValueAtTime(7000, at + 1.15);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.9), at + 1.1);
      g.gain.linearRampToValueAtTime(0, at + 1.2);

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, at);
      osc.frequency.exponentialRampToValueAtTime(1500, at + 1.15);
      osc.connect(oscGain);
      sendTo(oscGain, dest, send, 0.3);
      oscGain.gain.setValueAtTime(0.0001, at);
      oscGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.36), at + 1.1);
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
      sendTo(g, dest, send, 0.18);
      envelope(g, at, level * 1.1, 0.004, 0.14);
      osc.start(at);
      osc.stop(at + 0.2);
      sources.push(osc);
      break;
    }

    case 'click': {
      const { gain: g, filter, source, out } = connectNoise(ctx, at, 0.06);
      sources.push(source);
      sendTo(out, dest, send, 0.1);
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2400, at);
      envelope(g, at, level * 0.9, 0.002, 0.05);
      break;
    }

    case 'swipe': {
      // Le balayage traverse l'image de gauche à droite, comme le geste.
      for (const [pan, offset, amplitude] of [
        [-0.8, 0, 1],
        [0.8, 1.3, 0.75],
      ] as const) {
        const start = at + (pan > 0 ? 0.05 : 0);
        const { gain: g, filter, source, out } = connectNoise(ctx, start, 0.32, pan, offset);
        sources.push(source);
        sendTo(out, dest, send, 0.25);
        filter.type = 'bandpass';
        filter.Q.value = 2.5;
        filter.frequency.setValueAtTime(3400, start);
        filter.frequency.exponentialRampToValueAtTime(620, start + 0.28);
        envelope(g, start, level * 1.0 * amplitude, 0.008, 0.28);
      }
      break;
    }

    case 'punch': {
      // Une transitoire sèche par-dessus un grave très court : c'est la
      // brièveté qui donne l'impression de frappe, pas le volume. La
      // réverbération reste basse pour la même raison — une queue longue
      // dissoudrait la netteté qui fait tout l'effet.
      sources.push(
        impact(ctx, dest, send, at, {
          from: 200,
          to: 52,
          glide: 0.11,
          peak: level * 1.4,
          attack: 0.003,
          decay: 0.3,
          wet: 0.18,
          drive: 0.7,
        }),
      );

      const { gain: g, filter, source, out } = connectNoise(ctx, at, 0.09);
      sources.push(source);
      sendTo(out, dest, send, 0.18);
      filter.type = 'bandpass';
      filter.Q.value = 0.9;
      filter.frequency.setValueAtTime(1800, at);
      envelope(g, at, level * 0.9, 0.002, 0.07);
      break;
    }

    case 'subdrop': {
      // La descente sous le seuil d'audition se ressent plus qu'elle ne
      // s'entend : c'est l'effet recherché sous un dévoilement. Les harmoniques
      // pèsent lourd ici — sans elles, ce bruitage n'existait tout simplement
      // pas sur un téléphone.
      sources.push(
        impact(ctx, dest, send, at, {
          from: 100,
          to: 26,
          glide: 1.15,
          peak: level * 1.5,
          attack: 0.05,
          decay: 1.5,
          wet: 0.3,
          drive: 0.8,
        }),
      );
      break;
    }

    case 'reverse': {
      // Enveloppe croissante puis coupure nette : l'oreille anticipe un
      // évènement, la coupe qui suit le lui donne. Aucune réverbération : une
      // queue survivrait à la coupure et détruirait précisément la rupture.
      const { gain: g, filter, source, out } = connectNoise(ctx, at, 0.9);
      sources.push(source);
      sendTo(out, dest, send, 0);
      filter.type = 'bandpass';
      filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(600, at);
      filter.frequency.exponentialRampToValueAtTime(5200, at + 0.85);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 1.2), at + 0.82);
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
        // Le scintillement vit sur sa queue : c'est elle qui relie les cinq
        // notes en un seul geste au lieu de cinq bips séparés.
        sendTo(g, dest, send, 0.8);
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
      sendTo(g, dest, send, 0.28);
      envelope(g, at, level * 0.7, 0.002, 0.26);
      osc.start(at);
      osc.stop(at + 0.32);
      sources.push(osc);

      // Une couche de bruit haute qui donne au décrochage sa matière
      // électrique, absente d'un carré seul.
      const { gain: n, filter, source, out } = connectNoise(ctx, at, 0.3, 0.4);
      sources.push(source);
      sendTo(out, dest, send, 0.28);
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3000, at);
      envelope(n, at, level * 0.38, 0.002, 0.26);
      break;
    }

    case 'wind': {
      for (const [pan, offset, amplitude] of [
        [-0.6, 0, 1],
        [0.6, 1.1, 0.85],
      ] as const) {
        const { gain: g, filter, source, out } = connectNoise(ctx, at, 1.5, pan, offset);
        sources.push(source);
        sendTo(out, dest, send, 0.4);
        filter.type = 'bandpass';
        filter.Q.value = 0.45;
        filter.frequency.setValueAtTime(260, at);
        filter.frequency.exponentialRampToValueAtTime(2200, at + 0.75);
        filter.frequency.exponentialRampToValueAtTime(320, at + 1.45);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.88 * amplitude), at + 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 1.45);
        g.gain.linearRampToValueAtTime(0, at + 1.5);
      }
      break;
    }
  }

  return sources;
}

import { Y_PAR_DEFAUT } from './captions.ts';
import type { Caption, CaptionStyleId } from './types.ts';

/**
 * Voix off : calage du texte sur le signal.
 *
 * Le problème n'est pas de transcrire — quand la voix vient d'un générateur, on
 * a déjà le texte exact, mot pour mot. Il n'est que de savoir *quand* chaque mot
 * est prononcé.
 *
 * Deux pistes ont été écartées avant celle-ci. L'API Web Speech ne prend pas de
 * fichier en entrée et envoie l'audio chez un tiers, ce qui contredit la seule
 * promesse que ce studio tient de bout en bout : rien ne sort du navigateur. Un
 * modèle de transcription en WebAssembly demande des dizaines de mégaoctets à
 * télécharger, ce qui condamne l'usage sur téléphone.
 *
 * Reste le signal lui-même. Une voix de synthèse est propre — pas de bruit de
 * fond, des silences francs entre les phrases — donc son enveloppe d'énergie
 * suffit à retrouver où l'on parle et où l'on se tait. On répartit ensuite les
 * mots connus sur les segments détectés, au prorata de leur nombre de syllabes.
 * L'approximation est celle du débit à l'intérieur d'une phrase, jamais celle du
 * découpage entre phrases : c'est exactement là où l'œil ne la voit pas.
 *
 * Tout ce qui est calculable vit ici, hors du navigateur et sans dépendance,
 * pour rester couvert par `npm test`. Le décodage du fichier, lui, appartient à
 * `audio.ts`.
 */

/** Un passage où l'on parle, en secondes depuis le début du fichier. */
export type SpeechSegment = { start: number; end: number };

export type SegmentOptions = {
  /**
   * Part de la dynamique au-dessus de laquelle on considère qu'on parle.
   *
   * Exprimée entre le plancher de bruit et la crête plutôt qu'en valeur
   * absolue : un fichier normalisé et un fichier enregistré bas doivent se
   * découper pareil.
   */
  threshold: number;
  /**
   * Silence en deçà duquel on ne coupe pas, en secondes.
   *
   * Entre deux syllabes, et surtout devant une occlusive (« p », « t », « k »),
   * l'énergie retombe au plancher pendant une fraction de seconde. Sans ce
   * seuil, chaque mot deviendrait un segment et le découpage n'aurait plus
   * aucun rapport avec les phrases.
   */
  minSilence: number;
  /** Durée en deçà de laquelle un passage est tenu pour un claquement parasite. */
  minSpeech: number;
  /**
   * Marge ajoutée de part et d'autre, en secondes.
   *
   * L'attaque d'une consonne passe sous le seuil : sans marge, le sous-titre
   * apparaît sur la deuxième lettre du mot.
   */
  padding: number;
};

export const DEFAULT_SEGMENT_OPTIONS: SegmentOptions = {
  threshold: 0.12,
  minSilence: 0.18,
  minSpeech: 0.09,
  padding: 0.04,
};

/** Pas de l'enveloppe, en secondes. Assez fin pour un mot, assez grossier pour rester léger. */
export const ENVELOPE_HOP = 0.01;

/**
 * Enveloppe d'énergie du signal, une valeur tous les `hop`.
 *
 * On mesure sur une fenêtre plus large que le pas : une fenêtre égale au pas
 * ferait apparaître les alternances de la fondamentale elle-même, alors qu'on
 * ne cherche que le contour.
 */
export function rmsEnvelope(samples: Float32Array, sampleRate: number, hop = ENVELOPE_HOP): Float32Array {
  const step = Math.max(1, Math.round(sampleRate * hop));
  const window = step * 3;
  const count = Math.max(1, Math.ceil(samples.length / step));
  const envelope = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const from = i * step;
    const to = Math.min(samples.length, from + window);
    let sum = 0;
    for (let s = from; s < to; s++) sum += samples[s] * samples[s];
    envelope[i] = to > from ? Math.sqrt(sum / (to - from)) : 0;
  }

  return envelope;
}

/** Valeur en dessous de laquelle se trouve `ratio` de l'enveloppe. */
function percentile(envelope: Float32Array, ratio: number): number {
  if (envelope.length === 0) return 0;
  const sorted = Float32Array.from(envelope).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

/**
 * Découpe l'enveloppe en passages parlés.
 *
 * Le plancher est pris au vingtième centile et non au minimum : une seule
 * image de silence absolu suffirait sinon à écraser le seuil vers zéro, et
 * le moindre souffle passerait pour de la parole.
 */
export function speechSegments(
  envelope: Float32Array,
  hop = ENVELOPE_HOP,
  options: Partial<SegmentOptions> = {},
): SpeechSegment[] {
  const { threshold, minSilence, minSpeech, padding } = { ...DEFAULT_SEGMENT_OPTIONS, ...options };
  if (envelope.length === 0) return [];

  const floor = percentile(envelope, 0.2);
  let peak = 0;
  for (const value of envelope) if (value > peak) peak = value;

  // Un fichier sans dynamique — silence complet, ou bourdon continu — n'a rien
  // à découper : le rendre en un seul segment vaut mieux qu'en mille.
  if (peak - floor < 1e-4) return [{ start: 0, end: envelope.length * hop }];

  const level = floor + (peak - floor) * threshold;

  const raw: SpeechSegment[] = [];
  let from = -1;
  for (let i = 0; i < envelope.length; i++) {
    const loud = envelope[i] > level;
    if (loud && from === -1) from = i;
    if (!loud && from !== -1) {
      raw.push({ start: from * hop, end: i * hop });
      from = -1;
    }
  }
  if (from !== -1) raw.push({ start: from * hop, end: envelope.length * hop });

  // Recollage des silences trop courts pour être des respirations.
  const merged: SpeechSegment[] = [];
  for (const segment of raw) {
    const last = merged[merged.length - 1];
    if (last && segment.start - last.end < minSilence) last.end = segment.end;
    else merged.push({ ...segment });
  }

  const total = envelope.length * hop;
  return merged
    .filter((segment) => segment.end - segment.start >= minSpeech)
    .map((segment) => ({
      start: Math.max(0, segment.start - padding),
      end: Math.min(total, segment.end + padding),
    }));
}

/**
 * Nombre de syllabes d'un mot, à la louche.
 *
 * On compte les groupes de voyelles, en retirant le « e » final muet du
 * français. La règle est fausse dans les cas particuliers — « paysage »,
 * « aïeul » — mais elle n'a pas à être juste dans l'absolu : elle sert à
 * répartir des mots sur une durée, et seule leur longueur *relative* compte.
 * Un mot bref reste bref, un mot long reste long, et c'est tout ce qu'on
 * demande.
 */
export function syllableCount(word: string): number {
  const letters = word
    .toLowerCase()
    // La décomposition ramène « é » à « e » suivi d'un accent, que le filtre
    // suivant écarte : les mots accentués comptent donc leurs voyelles.
    .normalize('NFD')
    .replace(/[^a-z]/g, '');
  if (letters.length === 0) return 0;

  const groups = letters.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 0;

  // « e » final muet, sauf s'il porte la seule voyelle du mot (« le », « de »).
  if (count > 1 && /e$/.test(letters)) count -= 1;

  return Math.max(1, count);
}

/** Un mot, l'instant où il est prononcé, et le passage parlé dont il fait partie. */
export type TimedWord = { text: string; start: number; end: number; segment: number };

/**
 * Répartit les mots du texte sur les passages parlés.
 *
 * En deux temps, et l'ordre compte. On attribue d'abord les mots *entiers* aux
 * segments, au prorata de leur durée ; on les étale ensuite à l'intérieur de
 * leur segment, au prorata de leurs syllabes.
 *
 * Étaler les mots sur toute la durée d'un coup serait plus court à écrire, mais
 * un mot finirait à cheval sur deux phrases : il resterait affiché pendant le
 * silence qui les sépare, et le calage paraîtrait avoir dérivé alors qu'il est
 * juste. Un mot est prononcé d'un seul souffle, il appartient donc à un seul
 * passage.
 */
export function alignWords(script: string, segments: SpeechSegment[]): TimedWord[] {
  const words = script.split(/\s+/).filter(Boolean);
  if (words.length === 0 || segments.length === 0) return [];

  const weights = words.map((word) => syllableCount(word) || 1);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const durations = segments.map((segment) => segment.end - segment.start);
  const totalSpeech = durations.reduce((sum, duration) => sum + duration, 0);
  if (totalSpeech <= 0) return [];

  // -- Attribution des mots aux segments -------------------------------------
  const buckets: number[][] = segments.map(() => []);
  let index = 0;
  let placed = 0;
  let elapsed = 0;

  for (let i = 0; i < segments.length && index < words.length; i++) {
    elapsed += durations[i];
    // Poids qui devrait avoir été distribué une fois ce segment rempli.
    const expected = (elapsed / totalSpeech) * totalWeight;

    while (index < words.length) {
      /*
       * Un mot est mis de côté pour chacun des segments suivants, sans jamais
       * priver le segment courant : un segment vide vaudrait un blanc à
       * l'écran au milieu d'une phrase entendue.
       */
      const reserve = Math.min(segments.length - i - 1, words.length - index - 1);
      if (words.length - index <= reserve) break;

      // On s'arrête dès que prendre le mot suivant éloignerait du cumul visé.
      const next = placed + weights[index];
      const isLast = i === segments.length - 1;
      if (!isLast && buckets[i].length > 0 && Math.abs(next - expected) > Math.abs(placed - expected)) break;

      buckets[i].push(index);
      placed = next;
      index++;
    }
  }

  // Les arrondis peuvent laisser un reliquat : il revient au dernier segment servi.
  if (index < words.length) {
    const last = buckets.reduce((best, bucket, i) => (bucket.length > 0 ? i : best), 0);
    while (index < words.length) buckets[last].push(index++);
  }

  // -- Mise en place à l'intérieur de chaque segment --------------------------
  const timed: TimedWord[] = [];

  buckets.forEach((bucket, i) => {
    if (bucket.length === 0) return;

    const spoken = bucket.reduce((sum, w) => sum + weights[w], 0);
    let cursor = segments[i].start;

    bucket.forEach((w, position) => {
      const share = (weights[w] / spoken) * durations[i];
      const isLast = position === bucket.length - 1;
      // Le dernier mot cale exactement sur la fin du segment : sans cela, les
      // arrondis laisseraient un blanc juste avant le silence.
      const end = isLast ? segments[i].end : cursor + share;
      timed.push({ text: words[w], start: cursor, end, segment: i });
      cursor = end;
    });
  });

  return timed;
}

export type BlockOptions = {
  /** Mots au maximum par sous-titre. Au-delà, l'œil ne lit plus, il balaye. */
  maxWords: number;
  /** Caractères au maximum par sous-titre, corps large oblige. */
  maxChars: number;
};

export const DEFAULT_BLOCK_OPTIONS: BlockOptions = { maxWords: 5, maxChars: 32 };

/**
 * Durée en deçà de laquelle un sous-titre ne se lit pas.
 *
 * Un découpage à la largeur laisse régulièrement un reste — un dernier mot,
 * parfois une élision d'une seule lettre — qui hérite de deux dixièmes de
 * seconde. À l'écran ce n'est pas un sous-titre, c'est un clignotement.
 */
const MIN_BLOCK = 0.35;

/**
 * Regroupe les mots calés en sous-titres affichables.
 *
 * Une coupure est forcée à chaque silence : un sous-titre à cheval sur deux
 * phrases se lit mal et, surtout, il resterait affiché pendant le blanc, ce qui
 * donne l'impression que le calage a dérivé alors qu'il est juste.
 */
export function groupIntoBlocks(words: TimedWord[], options: Partial<BlockOptions> = {}): TimedWord[][] {
  const { maxWords, maxChars } = { ...DEFAULT_BLOCK_OPTIONS, ...options };
  const blocks: TimedWord[][] = [];
  let current: TimedWord[] = [];

  for (const word of words) {
    const previous = current[current.length - 1];
    const width = current.reduce((sum, w) => sum + w.text.length + 1, 0) + word.text.length;
    // Changer de passage parlé, c'est avoir traversé un silence.
    const afterSilence = previous !== undefined && word.segment !== previous.segment;

    if (previous && (current.length >= maxWords || width > maxChars || afterSilence)) {
      blocks.push(current);
      current = [];
    }
    current.push(word);
  }

  if (current.length > 0) blocks.push(current);

  /*
   * Recollage des restes.
   *
   * On rend le bloc trop court à son voisin, de préférence au précédent — c'est
   * lui qui porte le début de la phrase. Jamais par-dessus un silence : mieux
   * vaut un sous-titre bref qu'un sous-titre qui reste affiché pendant un blanc.
   * On dépasse au besoin la largeur visée, un sous-titre un peu long valant
   * toujours mieux qu'un sous-titre illisible.
   */
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block[block.length - 1].end - block[0].start >= MIN_BLOCK) continue;

    const previous = blocks[i - 1];
    const next = blocks[i + 1];

    if (previous && previous[0].segment === block[0].segment) {
      previous.push(...block);
      blocks.splice(i, 1);
    } else if (next && next[0].segment === block[0].segment) {
      next.unshift(...block);
      blocks.splice(i, 1);
    }
  }

  return blocks;
}

export type AlignOptions = SegmentOptions &
  BlockOptions & {
    /** Instant de la timeline où débute le fichier de voix. */
    offset: number;
    style: CaptionStyleId;
    /** Hauteur des sous-titres produits, de 0 (haut) à 1 (bas). */
    y: number;
  };

/**
 * Fabrique les sous-titres d'une voix off à partir de son texte.
 *
 * `makeId` est fourni par l'appelant plutôt qu'importé : les identifiants
 * doivent être prévisibles dans les tests, et le générateur du studio ne l'est
 * pas.
 */
export function captionsFromVoice(
  script: string,
  segments: SpeechSegment[],
  makeId: () => string,
  options: Partial<AlignOptions> = {},
): Caption[] {
  const { offset = 0, style = 'karaoke', y = Y_PAR_DEFAUT } = options;
  const words = alignWords(script, segments);
  if (words.length === 0) return [];

  return groupIntoBlocks(words, options).map((block) => ({
    id: makeId(),
    text: block.map((word) => word.text).join(' '),
    start: offset + block[0].start,
    end: offset + block[block.length - 1].end,
    style,
    y,
  }));
}

/**
 * Facteur à appliquer au fond quand la voix parle.
 *
 * Renvoie une cible franche — pleine ou baissée — et non une rampe : le lissage
 * appartient au graphe audio, qui le fait avec une constante de temps plutôt
 * qu'image par image. Une rampe calculée ici dépendrait de la cadence
 * d'affichage, et s'entendrait par paliers sur une machine chargée.
 *
 * L'anticipation compte autant que la baisse elle-même : le fond doit être
 * descendu *avant* le premier mot, sans quoi on entend la musique plonger sous
 * la voix au lieu de lui faire place.
 */
export function duckTarget(
  segments: SpeechSegment[],
  time: number,
  depth: number,
  lead = 0.12,
  hold = 0.22,
): number {
  const speaking = segments.some((segment) => time >= segment.start - lead && time <= segment.end + hold);
  return speaking ? Math.max(0, 1 - depth) : 1;
}

/**
 * Décode un fichier de voix et en tire ses passages parlés.
 *
 * Le contexte audio est reçu en paramètre plutôt que créé ici, comme pour les
 * bruitages : le studio n'en possède qu'un, et les navigateurs limitent leur
 * nombre. Un contexte hors ligne convient tout aussi bien.
 *
 * L'URL attendue est une URL objet — le fichier ne quitte donc jamais l'onglet,
 * `fetch` ne fait que le relire depuis la mémoire.
 */
export async function analyseVoice(
  context: BaseAudioContext,
  url: string,
  options: Partial<SegmentOptions> = {},
): Promise<{ duration: number; segments: SpeechSegment[] }> {
  const buffer = await context.decodeAudioData(await (await fetch(url)).arrayBuffer());

  // Repli en mono : une voix est identique sur les deux canaux, mais un fichier
  // dont un canal serait vide donnerait une enveloppe deux fois trop basse.
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) mono[i] += data[i] / buffer.numberOfChannels;
  }

  return {
    duration: buffer.duration,
    segments: speechSegments(rmsEnvelope(mono, buffer.sampleRate), ENVELOPE_HOP, options),
  };
}

/**
 * Passages parlés de toutes les répliques, ramenés sur la timeline.
 *
 * C'est ce que consomme la baisse automatique du fond : elle raisonne en temps
 * de montage, alors que chaque réplique porte ses segments en temps de fichier.
 */
export function timelineSpeech(cues: { start: number; segments: SpeechSegment[] }[]): SpeechSegment[] {
  return cues
    .flatMap((cue) => cue.segments.map((s) => ({ start: cue.start + s.start, end: cue.start + s.end })))
    .sort((a, b) => a.start - b.start);
}

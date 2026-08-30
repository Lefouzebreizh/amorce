/**
 * Rendu hors ligne du mixage complet.
 *
 * ## Pourquoi il ne pouvait pas être réutilisé tel quel
 *
 * `AudioEngine` construit un graphe **vivant** : ses sources sont des
 * `MediaElementAudioSourceNode`, branchés sur les `<video>` et `<audio>` que
 * l'aperçu fait jouer. Un élément média n'avance qu'en temps réel — c'est
 * précisément ce dont l'export hors ligne cherche à se libérer, et un
 * `OfflineAudioContext` n'en accepte d'ailleurs aucun.
 *
 * Ce module refait donc le même graphe avec des sources décodées : chaque
 * fichier est lu une fois en `AudioBuffer`, puis programmé à son instant. Le
 * rendu se fait alors aussi vite que la machine le permet, et le résultat est
 * **identique à chaque exécution** — ce qu'un enregistrement temps réel ne peut
 * pas promettre.
 *
 * ## Ce qui est repris à l'identique, et pourquoi ça compte
 *
 * La structure des bus, les valeurs du limiteur et la courbe de plafond
 * viennent de `audio.ts` — la courbe y est importée plutôt que recopiée. Deux
 * courbes légèrement différentes ne s'entendraient que sur les crêtes, donc
 * jamais dans une mesure de sonie moyenne : l'export sonnerait autrement que
 * l'aperçu et personne ne saurait dire pourquoi.
 *
 * ## Ce qui change forcément
 *
 * L'atténuation sous la voix suit la parole en continu. En direct elle est
 * poussée à chaque image par `setTargetAtTime` ; ici elle est **programmée
 * d'avance** sur toute la durée, échantillonnée au pas de `PAS_DUCK`. C'est la
 * même courbe, écrite à l'avance au lieu d'être suivie.
 */

import { courbeDePlafond } from './audio.ts';
import { scheduleSfx } from './sfx.ts';
import { layoutClips } from './timeline.ts';
import { duckTarget, timelineSpeech } from './voice.ts';
import type { Project } from './types.ts';

/** Fréquence d'échantillonnage du rendu. Celle de tous les encodeurs visés. */
export const FREQUENCE = 48_000;

/** Pas d'échantillonnage de l'atténuation sous la voix, en secondes. */
const PAS_DUCK = 0.02;

/** Gain appliqué aux bruitages de synthèse, très courts. Voir `audio.ts`. */
const GAIN_SYNTHESE = 2.2;

/**
 * Décode un fichier en `AudioBuffer`, ou rend `null` s'il est illisible.
 *
 * L'URL attendue est une URL objet : le fichier ne quitte jamais l'onglet,
 * `fetch` ne fait que le relire depuis la mémoire. C'est le même geste que
 * `analyseVoice`, déjà déclaré à la barrière du moteur.
 *
 * Un fichier illisible ne fait pas échouer l'export : il manquera à
 * l'oreille, ce qui vaut mieux qu'un export refusé au bout de trois minutes.
 */
async function decoder(
  contexte: BaseAudioContext,
  url: string,
  cache: Map<string, Promise<AudioBuffer | null>>,
): Promise<AudioBuffer | null> {
  const connu = cache.get(url);
  if (connu) return connu;

  const promesse = (async () => {
    try {
      const octets = await (await fetch(url)).arrayBuffer();
      return await contexte.decodeAudioData(octets);
    } catch {
      return null;
    }
  })();

  cache.set(url, promesse);
  return promesse;
}

/** Programme une source décodée sur un bus, à un instant de la timeline. */
function poser(
  contexte: BaseAudioContext,
  buffer: AudioBuffer,
  bus: AudioNode,
  options: { debut: number; decalage: number; duree: number; gain: number; vitesse?: number },
): void {
  // Une durée nulle ou négative ferait lever `start` ; un décalage au-delà du
  // fichier ne rendrait que du silence, autant ne rien poser.
  if (options.duree <= 0 || options.decalage >= buffer.duration) return;

  const source = contexte.createBufferSource();
  source.buffer = buffer;
  if (options.vitesse !== undefined) {
    source.playbackRate.value = Math.max(0.1, Math.min(8, options.vitesse));
  }

  const gain = contexte.createGain();
  gain.gain.value = Math.max(0, Math.min(1, options.gain));

  source.connect(gain);
  gain.connect(bus);

  const restant = buffer.duration - options.decalage;
  source.start(Math.max(0, options.debut), options.decalage, Math.min(options.duree, restant));
}

/**
 * Rend le mixage entier et le renvoie prêt à encoder.
 *
 * La durée est celle du montage : le film et sa bande sonore doivent finir
 * ensemble, et c'est un des trois contrôles à faire sur tout fichier livré.
 */
export async function rendreMixage(project: Project, duree: number): Promise<AudioBuffer | null> {
  if (typeof OfflineAudioContext === 'undefined') return null;
  if (duree <= 0) return null;

  const contexte = new OfflineAudioContext(2, Math.ceil(duree * FREQUENCE), FREQUENCE);

  // --- Le même graphe que l'aperçu, dans le même ordre -----------------------

  const master = contexte.createGain();

  const limiteur = contexte.createDynamicsCompressor();
  limiteur.threshold.value = -6;
  limiteur.knee.value = 6;
  limiteur.ratio.value = 12;
  limiteur.attack.value = 0.003;
  limiteur.release.value = 0.12;

  const plafond = contexte.createWaveShaper();
  plafond.curve = courbeDePlafond();
  plafond.oversample = '4x';

  const sfxBus = contexte.createGain();
  sfxBus.connect(master);

  const synthBus = contexte.createGain();
  synthBus.gain.value = GAIN_SYNTHESE;
  synthBus.connect(sfxBus);

  const clipsBus = contexte.createGain();
  const musicBus = contexte.createGain();
  const voiceBus = contexte.createGain();

  const clipsDuck = contexte.createGain();
  const musicDuck = contexte.createGain();
  clipsBus.connect(clipsDuck);
  clipsDuck.connect(master);
  musicBus.connect(musicDuck);
  musicDuck.connect(master);

  // La voix ne subit aucune baisse : c'est elle qui la provoque.
  voiceBus.connect(master);

  master.connect(limiteur);
  limiteur.connect(plafond);
  plafond.connect(contexte.destination);

  const mix = project.mix;
  clipsBus.gain.value = Math.max(0, Math.min(1, mix.clips));
  sfxBus.gain.value = Math.max(0, Math.min(1, mix.sfx));
  musicBus.gain.value = Math.max(0, Math.min(1, mix.music));
  voiceBus.gain.value = Math.max(0, Math.min(1, mix.voice));

  // --- L'atténuation sous la voix, écrite d'avance --------------------------

  const segments = timelineSpeech(project.voices);
  if (segments.length > 0) {
    const profondeur = Math.max(0, Math.min(1, mix.ducking));
    for (let t = 0; t <= duree; t += PAS_DUCK) {
      const cible = duckTarget(segments, t, profondeur);
      clipsDuck.gain.setValueAtTime(cible, t);
      musicDuck.gain.setValueAtTime(cible, t);
    }
  }

  // --- Les sources -----------------------------------------------------------

  const cache = new Map<string, Promise<AudioBuffer | null>>();
  const attentes: Promise<void>[] = [];

  /*
   * Le son des plans suit exactement le montage.
   *
   * `layoutClips` donne à chaque plan sa place réelle, transitions comprises :
   * s'en écarter ferait dériver le son de l'image, et la dérive s'accumulerait
   * plan après plan sans que rien ne la signale avant la fin du film.
   */
  for (const item of layoutClips(project.clips)) {
    const asset = project.assets.find((a) => a.id === item.clip.assetId);
    if (!asset || asset.kind !== 'video' || !asset.hasAudio) continue;

    attentes.push(
      decoder(contexte, asset.url, cache).then((buffer) => {
        if (!buffer) return;
        poser(contexte, buffer, clipsBus, {
          debut: item.start,
          decalage: item.clip.inPoint,
          duree: item.end - item.start,
          gain: item.clip.volume,
          vitesse: item.clip.speed,
        });
      }),
    );
  }

  if (project.music) {
    const musique = project.music;
    attentes.push(
      decoder(contexte, musique.url, cache).then((buffer) => {
        if (!buffer) return;
        poser(contexte, buffer, musicBus, {
          debut: 0,
          decalage: musique.offset,
          duree: duree,
          gain: musique.gain,
        });
      }),
    );
  }

  for (const voix of project.voices) {
    attentes.push(
      decoder(contexte, voix.url, cache).then((buffer) => {
        if (!buffer) return;
        poser(contexte, buffer, voiceBus, {
          debut: voix.start,
          decalage: 0,
          duree: Math.min(voix.duration, duree - voix.start),
          gain: voix.gain,
        });
      }),
    );
  }

  /*
   * Les bruitages importés passent par `sfxBus`, jamais par `synthBus`.
   *
   * Le second porte une compensation de brièveté de 2,2 faite pour les sons de
   * synthèse. Un fichier déposé arrive déjà à son niveau : l'y faire passer le
   * ferait saturer. Les deux se règlent malgré tout d'une seule jauge, puisque
   * `synthBus` débouche sur `sfxBus`.
   */
  for (const echantillon of project.samples) {
    attentes.push(
      decoder(contexte, echantillon.url, cache).then((buffer) => {
        if (!buffer) return;
        poser(contexte, buffer, sfxBus, {
          debut: echantillon.start,
          decalage: 0,
          duree: Math.min(echantillon.duration, duree - echantillon.start),
          gain: echantillon.gain,
        });
      }),
    );
  }

  await Promise.all(attentes);

  // Les bruitages de synthèse se programment sans rien décoder : `scheduleSfx`
  // accepte n'importe quel contexte, hors ligne compris.
  for (const cue of project.cues) {
    if (cue.time > duree) continue;
    scheduleSfx(contexte, synthBus, cue.sfx, cue.time, cue.gain);
  }

  return contexte.startRendering();
}

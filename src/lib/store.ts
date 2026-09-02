'use client';

import { create } from 'zustand';
import { analyzeProject } from './analysis.ts';
import { HAUTEURS_LIBRES, Y_PAR_DEFAUT } from './captions.ts';
import { uid } from './id.ts';
import { applyAutoEdit } from './autoEdit.ts';
import { applyFinish, soundsOnCuts, tensionFills, thinCues } from './autoFinish.ts';
import type { SharedFile } from './share.ts';
import { captionsFromVoice } from './voice.ts';
import { chopped, emptyProject, layoutClips, totalDuration, withoutSilences } from './timeline.ts';
import type { QualityTier } from './quality.ts';
import {
  DEFAULT_CLIP,
  MIN_CLIP_DURATION,
  type Caption,
  type CaptionStyleId,
  type Clip,
  type MediaAsset,
  type MixSettings,
  type MusicTrack,
  type ExportPreset,
  type Project,
  type SfxId,
  type SampleCue,
  type SoundCue,
  type VoiceCue,
} from './types.ts';

/** Choix de qualité : « auto » laisse la surveillance décider. */
export type QualityChoice = 'auto' | QualityTier['id'];

/** Élément sélectionné dans l'éditeur : pilote le contenu du panneau de droite. */
export type Selection =
  | { kind: 'clip'; id: string }
  | { kind: 'caption'; id: string }
  | { kind: 'cue'; id: string }
  | null;

/** Un état antérieur du projet, conservé pour pouvoir y revenir. */
type Snapshot = { project: Project; label: string };

/** Profondeur de l'historique. Au-delà, les états les plus anciens tombent. */
const HISTORY_LIMIT = 60;

/**
 * Durée minimale d'un sous-titre ajouté à la main, en secondes.
 *
 * En deçà, il clignote au lieu de se lire. C'est la borne qui s'applique quand
 * la tête de lecture est si près de la fin qu'il n'y a plus deux secondes
 * devant elle.
 */
const MIN_CAPTION_SPAN = 0.8;

/**
 * Délai en deçà duquel deux modifications de même nature n'en font qu'une.
 *
 * Sans ce regroupement, un simple glissement de jauge produirait des dizaines
 * d'entrées et il faudrait autant d'annulations pour revenir en arrière.
 */
const COALESCE_MS = 600;

/**
 * Modifications susceptibles d'être regroupées.
 *
 * Uniquement celles qui viennent d'une commande continue — jauge qu'on fait
 * glisser, texte qu'on saisit — où chaque valeur intermédiaire n'a pas de sens
 * en soi. Un geste discret n'est jamais fondu dans le précédent : découper un
 * plan juste après l'avoir ajouté doit s'annuler en deux fois, sinon
 * l'annulation en défait plus que ce qu'on croyait.
 */
const COALESCING = new Set([
  'reglage',
  'texte-reglage',
  'son-reglage',
  'musique-reglage',
  'voix-reglage',
  'bruitage-reglage',
  'mixage',
  'nom',
]);

type StudioState = {
  project: Project;
  /** États antérieurs, du plus ancien au plus récent. */
  past: Snapshot[];
  /** États annulés, prêts à être rétablis. */
  future: Snapshot[];
  undo: () => void;
  redo: () => void;
  selection: Selection;
  /** Position de la tête de lecture, en secondes. */
  playhead: number;
  playing: boolean;
  /** Qualité demandée par l'utilisateur. */
  qualityChoice: QualityChoice;
  /**
   * Palier réellement appliqué.
   *
   * Écrit par la boucle de rendu, jamais pendant le rendu React : la valeur de
   * départ est donc une constante, identique côté serveur et côté navigateur,
   * et la surveillance la corrige dès les premières images.
   */
  effectiveQuality: QualityTier['id'];
  /** Vrai quand le filet de sécurité a repris la main sur un choix trop lourd. */
  qualityRescued: boolean;
  setQualityChoice: (choice: QualityChoice) => void;
  /**
   * Pourquoi le montage n'est pas conservé, ou null s'il l'est.
   *
   * Hors du projet, donc hors de l'historique : c'est un état de la machine, pas
   * une décision de l'utilisateur, et l'annuler n'aurait aucun sens.
   */
  storageError: string | null;
  /**
   * Fichiers reçus par le bouton « Partager », en attente d'une destination.
   *
   * Rien dans un fichier audio ne dit s'il s'agit d'une réplique ou d'un
   * bruitage : c'est à l'utilisateur de trancher, et ils patientent ici en
   * attendant. Hors du projet, donc hors de l'historique — tant qu'ils ne sont
   * pas importés, ils n'en font pas partie.
   */
  sharedFiles: SharedFile[];
  setSharedFiles: (files: SharedFile[]) => void;
  /** Définition retenue pour le fichier produit. */
  exportPreset: ExportPreset['id'];
  setExportPreset: (id: ExportPreset['id']) => void;

  // -- Médias ---------------------------------------------------------------
  addAssets: (assets: MediaAsset[]) => void;
  removeAsset: (assetId: string) => void;

  /**
   * Monte tout d'un coup à partir des rushes importés.
   *
   * Passe par `mutate`, donc s'annule. Ce n'était pas le cas jusqu'ici : le
   * geste le plus destructeur du studio — il remplace plans, textes et
   * bruitages d'un seul coup — était le seul à écrire l'état directement,
   * donc le seul qu'on ne pouvait pas défaire. Pire, l'annulation suivante
   * remontait alors à un état antérieur sans le dire.
   */
  montageExpress: () => void;

  /** Ajoute des rushes à la fin du montage, sans toucher au reste. */
  ajouterAuMontage: (assetIds: string[]) => void;

  // -- Clips ----------------------------------------------------------------
  appendClip: (assetId: string) => void;
  updateClip: (id: string, patch: Partial<Clip>) => void;
  removeClip: (id: string) => void;
  duplicateClip: (id: string) => void;
  /** Découpe un plan en morceaux d'environ `target` secondes. */
  chopClip: (id: string, target?: number) => void;
  cutSilences: (id: string, segments: { start: number; end: number }[]) => void;
  /** Cale un texte dicté sur la parole mesurée d'un plan. */
  captionsFromClip: (
    id: string,
    script: string,
    segments: { start: number; end: number }[],
  ) => void;
  /** Pose un bruitage sur chaque raccord qui n'en a pas encore. */
  addSoundsOnCuts: () => void;
  /** Écarte les bruitages en trop, pour rendre du silence entre les impacts. */
  thinSounds: () => void;
  /** Relance l'attention là où l'analyse a repéré un creux. */
  fillTensionGaps: (moments: number[]) => void;
  /** Pose d'un coup textes, bruitages et découpe, sans rien remplacer. */
  applyRecommended: (setId: string) => void;
  moveClip: (from: number, to: number) => void;
  splitClipAtPlayhead: () => void;

  // -- Sous-titres ----------------------------------------------------------
  addCaption: (style?: CaptionStyleId) => void;
  updateCaption: (id: string, patch: Partial<Caption>) => void;
  removeCaption: (id: string) => void;

  // -- Bruitages ------------------------------------------------------------
  addCue: (sfx: SfxId, time?: number) => void;
  updateCue: (id: string, patch: Partial<SoundCue>) => void;
  removeCue: (id: string) => void;

  // -- Bruitages importés ---------------------------------------------------
  addSamples: (cues: SampleCue[]) => void;
  updateSample: (id: string, patch: Partial<SampleCue>) => void;
  removeSample: (id: string) => void;

  // -- Voix off -------------------------------------------------------------
  addVoices: (cues: VoiceCue[]) => void;
  updateVoice: (id: string, patch: Partial<VoiceCue>) => void;
  removeVoice: (id: string) => void;
  /** Fabrique les sous-titres d'une réplique à partir de son texte. */
  alignVoice: (id: string) => void;

  // -- Musique --------------------------------------------------------------
  setMusic: (music: MusicTrack | null) => void;
  /** Ajuste l'équilibre entre les trois sources sonores. */
  setMix: (patch: Partial<MixSettings>) => void;
  updateMusic: (patch: Partial<MusicTrack>) => void;

  // -- Lecture --------------------------------------------------------------
  select: (selection: Selection) => void;
  setPlayhead: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  renameProject: (name: string) => void;
  duration: () => number;
};

/** Ramène une valeur dans l'intervalle [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Remet la tête de lecture dans les bornes du montage.
 *
 * Raccourcir ou supprimer un plan raccourcit le montage, et la tête de lecture
 * peut se retrouver au-delà de la fin. Le lecteur affiche alors une position
 * supérieure à la durée totale — vu sur un montage ramené à 0,1 s dont la tête
 * restait à 2,1 s — et le curseur de défilement bute en butée sans correspondre
 * à ce qui est affiché.
 */
function reclamp<T extends { project: Project; playhead: number }>(state: T): T {
  const limit = totalDuration(state.project.clips);
  return state.playhead > limit ? { ...state, playhead: limit } : state;
}

export const useStudio = create<StudioState>((set, get) => {
  /** Nature et instant de la dernière modification, pour le regroupement. */
  let lastLabel = '';
  let lastAt = 0;

  /**
   * Applique une modification du projet en la rendant annulable.
   *
   * Les changements qui ne touchent pas au projet — sélection, tête de lecture,
   * réglages d'affichage — passent directement par `set` : les inscrire dans
   * l'historique obligerait à annuler plusieurs fois pour défaire une seule
   * action réelle.
   */
  const mutate = (label: string, producer: (state: StudioState) => Partial<StudioState>) =>
    set((state) => {
      const patch = producer(state);
      if (!patch.project || patch.project === state.project) return patch;

      const now = Date.now();
      const merge = COALESCING.has(label) && label === lastLabel && now - lastAt < COALESCE_MS;
      lastLabel = label;
      lastAt = now;

      return {
        ...patch,
        past: merge ? state.past : [...state.past, { project: state.project, label }].slice(-HISTORY_LIMIT),
        future: [],
      };
    });

  return {
  project: emptyProject(),
  past: [],
  future: [],

  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;

      // Le regroupement est rompu : sans cela, la modification suivante
      // viendrait se fondre dans une entrée qui n'existe plus.
      lastLabel = '';
      return {
        project: previous.project,
        past: state.past.slice(0, -1),
        future: [{ project: state.project, label: previous.label }, ...state.future].slice(0, HISTORY_LIMIT),
        selection: null,
        playing: false,
        playhead: Math.min(state.playhead, totalDuration(previous.project.clips)),
      };
    }),

  redo: () =>
    set((state) => {
      const [next, ...rest] = state.future;
      if (!next) return state;

      lastLabel = '';
      return {
        project: next.project,
        past: [...state.past, { project: state.project, label: next.label }].slice(-HISTORY_LIMIT),
        future: rest,
        selection: null,
        playing: false,
        playhead: Math.min(state.playhead, totalDuration(next.project.clips)),
      };
    }),

  selection: null,
  playhead: 0,
  playing: false,
  qualityChoice: 'auto',
  effectiveQuality: 'high',
  qualityRescued: false,
  storageError: null,
  sharedFiles: [],
  setSharedFiles: (sharedFiles) => set({ sharedFiles }),
  exportPreset: 'full',
  setExportPreset: (exportPreset) => set({ exportPreset }),
  // Un nouveau choix efface l'avertissement : l'utilisateur a repris la main.
  setQualityChoice: (qualityChoice) => set({ qualityChoice, qualityRescued: false }),

  addAssets: (assets) =>
    mutate('import', (state) => ({ project: { ...state.project, assets: [...state.project.assets, ...assets] } })),

  removeAsset: (assetId) =>
    mutate('import-retrait', (state) => {
      const asset = state.project.assets.find((a) => a.id === assetId);
      if (asset) URL.revokeObjectURL(asset.url);
      return reclamp({
        ...state,
        project: {
          ...state.project,
          assets: state.project.assets.filter((a) => a.id !== assetId),
          // Un clip ne peut pas survivre à la disparition de son média source.
          clips: state.project.clips.filter((c) => c.assetId !== assetId),
        },
      });
    }),

  montageExpress: () =>
    mutate('montage-express', (state) => ({
      project: applyAutoEdit(state.project),
      selection: null,
      playhead: 0,
      playing: false,
    })),

  /*
   * L'ajout existait déjà plan par plan (`appendClip`), mais nulle part depuis
   * l'étape d'import — la seule porte pour faire entrer un rush de plus dans un
   * montage en cours était le montage express, qui efface tout le reste. Ajouter
   * une vidéo revenait donc à perdre ses textes et ses bruitages.
   *
   * Une seule entrée d'historique pour le lot : c'est un geste unique de
   * l'utilisateur, et l'annuler doit tout reprendre d'un coup.
   */
  ajouterAuMontage: (assetIds) =>
    mutate('montage-ajout', (state) => {
      const nouveaux = assetIds
        .map((id) => state.project.assets.find((a) => a.id === id))
        .filter((a): a is MediaAsset => a !== undefined);
      if (nouveaux.length === 0) return state;

      const clips: Clip[] = nouveaux.map((asset, rang) => ({
        ...DEFAULT_CLIP,
        id: uid('clip'),
        assetId: asset.id,
        outPoint: asset.duration,
        // Même règle que `appendClip` : le tout premier plan démarre sec.
        transition:
          state.project.clips.length === 0 && rang === 0 ? 'cut' : DEFAULT_CLIP.transition,
      }));

      return {
        project: { ...state.project, clips: [...state.project.clips, ...clips] },
        selection: { kind: 'clip', id: clips[0].id },
      };
    }),

  appendClip: (assetId) =>
    mutate('ajout-plan', (state) => {
      const asset = state.project.assets.find((a) => a.id === assetId);
      if (!asset) return state;
      const clip: Clip = {
        ...DEFAULT_CLIP,
        id: uid('clip'),
        assetId,
        outPoint: asset.duration,
        // Le tout premier clip n'a rien à enchaîner : il démarre sec.
        transition: state.project.clips.length === 0 ? 'cut' : DEFAULT_CLIP.transition,
      };
      return {
        project: { ...state.project, clips: [...state.project.clips, clip] },
        selection: { kind: 'clip', id: clip.id },
      };
    }),

  updateClip: (id, patch) =>
    mutate('reglage', (state) =>
      reclamp({
        ...state,
        project: {
          ...state.project,
          clips: state.project.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        },
      }),
    ),

  removeClip: (id) =>
    mutate('retrait-plan', (state) =>
      reclamp({
        ...state,
        project: { ...state.project, clips: state.project.clips.filter((c) => c.id !== id) },
        selection: state.selection?.kind === 'clip' && state.selection.id === id ? null : state.selection,
      }),
    ),

  /**
   * Insère une copie du plan juste après l'original.
   *
   * Les rushes générés par IA durent souvent deux ou trois secondes : sans
   * duplication, il devient impossible d'atteindre les quinze à trente secondes
   * qui font un format court tenable. La copie garde ses points d'entrée et de
   * sortie — c'est en la retouchant qu'on obtient une variation plutôt qu'une
   * répétition.
   */
  duplicateClip: (id) =>
    mutate('duplication', (state) => {
      const index = state.project.clips.findIndex((c) => c.id === id);
      if (index === -1) return state;

      const copy: Clip = { ...state.project.clips[index], id: uid('clip') };
      const clips = [...state.project.clips];
      clips.splice(index + 1, 0, copy);
      return {
        project: { ...state.project, clips },
        selection: { kind: 'clip', id: copy.id },
      };
    }),

  /**
   * Découpe un plan en morceaux réguliers.
   *
   * C'est le geste que réclame l'analyse quand un plan s'étire, et le plus
   * coûteux à faire à la main : il faudrait déplacer la tête de lecture et
   * couper une dizaine de fois de suite. Les morceaux s'enchaînent en coupe
   * franche, la cadence la plus nerveuse.
   */
  /**
   * Retire les blancs d'un plan, à partir des passages parlés relevés ailleurs.
   *
   * L'analyse est asynchrone — il faut décoder l'audio — et le magasin ne l'est
   * pas : c'est l'appelant qui relève les passages, et cette action ne fait que
   * poser le résultat. Séparer les deux garde l'action instantanée, donc
   * annulable comme n'importe quelle autre modification.
   */
  cutSilences: (id, segments) =>
    mutate('coupe des blancs', (state) => {
      const index = state.project.clips.findIndex((c) => c.id === id);
      if (index === -1) return state;

      const pieces = withoutSilences(state.project.clips[index], segments, () => uid('clip'));
      // Rendre le plan inchangé signifie qu'il n'y avait rien à retirer : on
      // n'écrit alors pas d'entrée dans l'historique pour rien.
      if (pieces.length === 1 && pieces[0] === state.project.clips[index]) return state;

      /*
       * La sélection reste sur le plan.
       *
       * Le premier morceau garde l'identité du plan d'origine, donc le panneau
       * de réglage reste ouvert et le compte rendu — « blancs retirés » —
       * s'affiche. En vidant la sélection, on repliait le panneau au moment
       * exact où il avait quelque chose à dire : on appuyait, l'écran se vidait,
       * et rien n'indiquait que quoi que ce soit s'était produit.
       */
      const clips = [...state.project.clips];
      clips.splice(index, 1, ...pieces);
      return reclamp({ ...state, project: { ...state.project, clips } });
    }),

  /**
   * Sous-titre un plan à partir de ce qu'on y dit.
   *
   * Le calage d'un texte sur la parole existait déjà, mais seulement pour une
   * voix off importée. Or le cas le plus courant est l'inverse : on se filme
   * en parlant, et la parole est **dans le rush**. Il fallait alors écrire
   * chaque sous-titre à la main, un par un, en cherchant ses bornes à la
   * jauge — le travail le plus long d'un montage court.
   *
   * Trois conversions séparent les segments du rush des sous-titres du
   * montage, et les oublier produit des textes qui ne s'affichent jamais :
   *
   * Les segments sont relevés sur le **fichier entier**, le plan n'en montre
   * qu'une tranche : on écarte ce qui tombe hors de `[inPoint, outPoint]`.
   *
   * Le temps du fichier n'est pas celui du montage : un plan joué deux fois
   * plus vite montre deux secondes de source par seconde de montage.
   *
   * Et le plan commence quelque part sur la ligne de temps : `placed.start`
   * s'ajoute en dernier.
   */
  captionsFromClip: (id, script, segments) =>
    mutate('sous-titres', (state) => {
      const place = layoutClips(state.project.clips).find((p) => p.clip.id === id);
      if (!place || script.trim() === '') return state;

      const { clip } = place;
      const vitesse = Math.max(0.1, clip.speed);
      const dansLePlan = segments
        .map((s) => ({
          start: Math.max(s.start, clip.inPoint),
          end: Math.min(s.end, clip.outPoint),
        }))
        .filter((s) => s.end > s.start)
        // Du temps de fichier au temps de montage, origine au début du plan.
        .map((s) => ({
          start: (s.start - clip.inPoint) / vitesse,
          end: (s.end - clip.inPoint) / vitesse,
        }));

      if (dansLePlan.length === 0) return state;

      const limite = totalDuration(state.project.clips);
      const produits = captionsFromVoice(script, dansLePlan, () => uid('cap'), {
        offset: place.start,
      })
        .map((caption) => ({
          ...caption,
          // Jamais au-delà du plan : un sous-titre qui déborde s'afficherait
          // sur le plan suivant, dont il ne dit rien.
          end: Math.min(caption.end, place.end, limite > 0 ? limite : caption.end),
        }))
        .filter((caption) => caption.end > caption.start && caption.start < place.end);

      if (produits.length === 0) return state;

      return {
        ...state,
        project: {
          ...state.project,
          // Ceux du plan sont remplacés, jamais complétés : relancer le calage
          // après avoir corrigé une faute doublerait tout le texte.
          captions: [
            ...state.project.captions.filter(
              (c) => !(c.start >= place.start - 1e-6 && c.start < place.end && !c.voiceId),
            ),
            ...produits,
          ],
        },
      };
    }),

  chopClip: (id, target = 2) =>
    mutate('decoupage', (state) => {
      const index = state.project.clips.findIndex((c) => c.id === id);
      if (index === -1) return state;

      const pieces = chopped(state.project.clips[index], target, () => uid('clip'));
      if (pieces.length < 2) return state;

      const clips = [...state.project.clips];
      clips.splice(index, 1, ...pieces);
      return reclamp({ ...state, project: { ...state.project, clips }, selection: null });
    }),

  /**
   * Pose un bruitage sur chaque raccord.
   *
   * Les raccords déjà sonorisés sont laissés tels quels : la fonction peut être
   * relancée après un nouveau découpage sans empiler les sons au même endroit.
   */
  addSoundsOnCuts: () =>
    mutate('sons-auto', (state) => {
      const added = soundsOnCuts(state.project.clips, state.project.cues, () => uid('sfx'));
      if (added.length === 0) return state;
      return { project: { ...state.project, cues: [...state.project.cues, ...added] } };
    }),

  thinSounds: () =>
    mutate('allegement', (state) => {
      const gardes = thinCues(state.project.cues, totalDuration(state.project.clips));
      if (gardes.length === state.project.cues.length) return state;
      // La sélection peut désigner un bruitage qu'on vient d'écarter : la vider
      // évite un panneau de réglages ouvert sur un objet qui n'existe plus.
      return { project: { ...state.project, cues: gardes }, selection: null };
    }),

  /** Pose une ponctuation sonore aux instants signalés par l'analyse. */
  fillTensionGaps: (moments) =>
    mutate('relance', (state) => {
      const added = tensionFills(moments, state.project.cues, () => uid('sfx'));
      if (added.length === 0) return state;
      return { project: { ...state.project, cues: [...state.project.cues, ...added] } };
    }),

  /**
   * Pose d'un coup tout ce que la notation récompense.
   *
   * Une seule entrée d'historique pour l'ensemble : c'est un geste unique du
   * point de vue de l'utilisateur, et devoir l'annuler en quinze fois serait
   * pire que de ne pas pouvoir l'annuler.
   */
  applyRecommended: (setId) =>
    mutate('reglages-recommandes', (state) =>
      reclamp({
        ...state,
        project: applyFinish(state.project, analyzeProject(state.project), setId, () => uid('auto')),
        selection: null,
      }),
    ),

  moveClip: (from, to) =>
    mutate('deplacement', (state) => {
      const clips = [...state.project.clips];
      if (from < 0 || from >= clips.length || to < 0 || to >= clips.length) return state;
      const [moved] = clips.splice(from, 1);
      clips.splice(to, 0, moved);
      // Réordonner change les transitions applicables, donc la durée totale.
      return reclamp({ ...state, project: { ...state.project, clips } });
    }),

  splitClipAtPlayhead: () =>
    mutate('coupe', (state) => {
      const { clips } = state.project;
      const placed = layoutClips(clips);
      // Chaque moitié doit rester au-dessus du plancher, sinon la coupe crée un
      // fragment invisible que l'utilisateur devra retrouver pour le supprimer.
      const target = placed.find(
        (p) =>
          state.playhead > p.start + MIN_CLIP_DURATION && state.playhead < p.end - MIN_CLIP_DURATION,
      );
      if (!target) return state;

      const clip = target.clip;
      // Position de la coupe dans le média source.
      const cutSource = clip.inPoint + (state.playhead - target.start) * clip.speed;
      const head: Clip = { ...clip, outPoint: cutSource };
      const tail: Clip = { ...clip, id: uid('clip'), inPoint: cutSource, transition: 'cut', transitionDuration: 0 };

      const index = clips.findIndex((c) => c.id === clip.id);
      const next = [...clips];
      next.splice(index, 1, head, tail);
      return { project: { ...state.project, clips: next }, selection: { kind: 'clip', id: tail.id } };
    }),

  /**
   * Ajoute un sous-titre à la position de lecture.
   *
   * Le texte par défaut est neutre, et non une accroche toute faite : la même
   * phrase que celle posée par le montage express produisait deux sous-titres
   * identiques, superposés à l'écran, sans que rien ne signale qu'il y en avait
   * deux.
   *
   * La hauteur est décalée si un autre sous-titre occupe déjà l'instant visé,
   * pour la même raison : deux textes au même endroit se lisent comme un seul
   * texte abîmé.
   */
  addCaption: (style = 'punch') =>
    mutate('ajout-texte', (state) => {
      /*
       * Un sous-titre posé après la dernière image n'existe pas.
       *
       * Il ne s'affiche jamais, ne compte dans aucune couverture, et rien à
       * l'écran ne le dit : on le voit dans la liste, on le croit posé. C'est
       * arrivé en ajoutant un texte avec la tête de lecture au bout du montage
       * — 14,7 s → 16,7 s sur une vidéo de 14,7 s. On le ramène donc dans les
       * bornes, quitte à le raccourcir.
       */
      const limit = totalDuration(state.project.clips);
      const end = limit > 0 ? Math.min(limit, state.playhead + 2) : state.playhead + 2;
      const start = limit > 0 ? Math.max(0, Math.min(state.playhead, end - MIN_CAPTION_SPAN)) : state.playhead;

      const occupied = state.project.captions
        .filter((c) => c.start < end && c.end > start)
        .map((c) => c.y);

      /*
       * On monte par paliers jusqu'à trouver une hauteur libre, sans jamais
       * sortir de la bande que les trois plateformes laissent visible.
       *
       * Les paliers étaient `[0.5, 0.32, 0.66, 0.2, 0.78]` : trois d'entre eux,
       * dont celui par défaut, posaient le texte sous l'habillage — 66 % et
       * 78 % sont dans la colonne de boutons de TikTok, 50 % franchit déjà la
       * marge que la fermeture d'Instagram à 63 % impose une fois la hauteur du
       * texte comptée.
       *
       * Le déplacement des sous-titres dans la bande sûre avait touché la voix
       * off et les gabarits, et manqué ce chemin-ci — qui est précisément celui
       * que le guide recommande, et donc le plus emprunté.
       */
      const free = HAUTEURS_LIBRES.find((y) => occupied.every((taken) => Math.abs(taken - y) > 0.08));

      const caption: Caption = {
        id: uid('cap'),
        text: 'Ton texte ici',
        start,
        end,
        style,
        // Toutes les hauteurs prises : mieux vaut un texte superposé dans la
        // bande qu'un texte seul sous l'habillage d'une plateforme.
        y: free ?? Y_PAR_DEFAUT,
      };
      return {
        project: { ...state.project, captions: [...state.project.captions, caption] },
        selection: { kind: 'caption', id: caption.id },
      };
    }),

  updateCaption: (id, patch) =>
    mutate('texte-reglage', (state) => ({
      project: {
        ...state.project,
        captions: state.project.captions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    })),

  removeCaption: (id) =>
    mutate('retrait-texte', (state) => ({
      project: { ...state.project, captions: state.project.captions.filter((c) => c.id !== id) },
      selection: state.selection?.kind === 'caption' && state.selection.id === id ? null : state.selection,
    })),

  addCue: (sfx, time) =>
    mutate('ajout-son', (state) => {
      const cue: SoundCue = { id: uid('sfx'), sfx, time: time ?? state.playhead, gain: 0.8 };
      return {
        project: { ...state.project, cues: [...state.project.cues, cue] },
        selection: { kind: 'cue', id: cue.id },
      };
    }),

  updateCue: (id, patch) =>
    mutate('son-reglage', (state) => ({
      project: { ...state.project, cues: state.project.cues.map((c) => (c.id === id ? { ...c, ...patch } : c)) },
    })),

  removeCue: (id) =>
    mutate('retrait-son', (state) => ({
      project: { ...state.project, cues: state.project.cues.filter((c) => c.id !== id) },
      selection: state.selection?.kind === 'cue' && state.selection.id === id ? null : state.selection,
    })),

  setMix: (patch) =>
    mutate('mixage', (state) => ({
      project: { ...state.project, mix: { ...state.project.mix, ...patch } },
    })),

  addSamples: (cues) =>
    mutate('ajout-bruitage', (state) => ({
      project: { ...state.project, samples: [...state.project.samples, ...cues] },
    })),

  updateSample: (id, patch) =>
    mutate('bruitage-reglage', (state) => ({
      project: {
        ...state.project,
        samples: state.project.samples.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    })),

  removeSample: (id) =>
    mutate('retrait-bruitage', (state) => {
      const cue = state.project.samples.find((c) => c.id === id);
      if (cue) URL.revokeObjectURL(cue.url);
      return { project: { ...state.project, samples: state.project.samples.filter((c) => c.id !== id) } };
    }),

  addVoices: (cues) =>
    mutate('ajout-voix', (state) => ({
      project: { ...state.project, voices: [...state.project.voices, ...cues] },
    })),

  updateVoice: (id, patch) =>
    mutate('voix-reglage', (state) => ({
      project: {
        ...state.project,
        voices: state.project.voices.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      },
    })),

  /**
   * Retire une réplique, et avec elle les sous-titres qu'elle avait produits.
   *
   * Les garder laisserait à l'écran un texte que plus rien ne prononce, et il
   * faudrait les retrouver un par un pour les effacer. Le geste reste annulable,
   * ce qui suffit à couvrir le regret.
   */
  removeVoice: (id) =>
    mutate('retrait-voix', (state) => {
      const cue = state.project.voices.find((v) => v.id === id);
      if (cue) URL.revokeObjectURL(cue.url);
      return {
        project: {
          ...state.project,
          voices: state.project.voices.filter((v) => v.id !== id),
          captions: state.project.captions.filter((c) => c.voiceId !== id),
        },
      };
    }),

  alignVoice: (id) =>
    mutate('calage-voix', (state) => {
      const cue = state.project.voices.find((v) => v.id === id);
      if (!cue) return state;

      /*
       * Un sous-titre posé après la dernière image n'existe pas.
       *
       * Une réplique placée trop tard produisait des sous-titres au-delà de la
       * fin du montage — vu à 13,9 s sur une vidéo de 13,6 s. Ils ne
       * s'affichaient jamais, ne comptaient dans aucune couverture, et rien à
       * l'écran ne disait pourquoi le calage semblait n'avoir rien fait.
       *
       * Ceux qui débordent sont ramenés à la fin, ceux qui commencent après
       * sont écartés : mieux vaut perdre une phrase que d'en garder une
       * invisible.
       */
      const limit = totalDuration(state.project.clips);

      const produced = captionsFromVoice(cue.script, cue.segments, () => uid('cap'), {
        offset: cue.start,
      })
        .filter((caption) => limit <= 0 || caption.start < limit)
        .map((caption) => ({
          ...caption,
          end: limit > 0 ? Math.min(caption.end, limit) : caption.end,
          voiceId: id,
        }))
        .filter((caption) => caption.end > caption.start);

      return {
        project: {
          ...state.project,
          // Les sous-titres de cette réplique sont remplacés, jamais complétés.
          captions: [...state.project.captions.filter((c) => c.voiceId !== id), ...produced],
        },
      };
    }),

  setMusic: (music) =>
    mutate('musique', (state) => {
      if (state.project.music) URL.revokeObjectURL(state.project.music.url);
      return { project: { ...state.project, music } };
    }),

  updateMusic: (patch) =>
    mutate('musique-reglage', (state) => ({
      project: { ...state.project, music: state.project.music ? { ...state.project.music, ...patch } : null },
    })),

  select: (selection) => set({ selection }),
  setPlayhead: (time) => set((state) => ({ playhead: clamp(time, 0, totalDuration(state.project.clips)) })),
  setPlaying: (playing) => set({ playing }),
  renameProject: (name) => mutate('nom', (state) => ({ project: { ...state.project, name } })),
  duration: () => totalDuration(get().project.clips),
  };
});

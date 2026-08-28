import { SFX_PER_10S, type Analysis } from './analysis.ts';
import { chopped, layoutClips, totalDuration } from './timeline.ts';
import {
  type Caption,
  type CaptionStyleId,
  type CinemaSettings,
  type Clip,
  type LookId,
  type Project,
  type SfxId,
  type SoundCue,
} from './types.ts';

/**
 * Poser d'un coup les réglages recommandés.
 *
 * Le studio guide une consigne à la fois — juste pour un débutant, épuisant pour
 * qui monte sa dixième vidéo : il faut traverser sept écrans pour appliquer des
 * réglages toujours identiques. Ce module les applique tous ensemble, sur un
 * montage **existant**. C'est ce qui le distingue de `autoEdit`, qui part des
 * rushes et remplace les plans.
 *
 * Règle qui gouverne tout ce qui suit : **on remplit ce qui manque, on n'écrase
 * jamais**. Un sous-titre déjà calé sur une voix off représente un travail que
 * personne n'accepterait de perdre en touchant un bouton nommé « recommandé ».
 *
 * Deux choses restent hors d'atteinte, et l'interface doit le dire plutôt que de
 * laisser espérer. Le studio ne voit pas les images : il propose des trames dont
 * les textes sont cohérents entre eux, avec des crochets à compléter, jamais un
 * texte qui parlerait du film. Et il ne peut pas inventer une musique.
 */

/** Au-delà, un plan s'étire et l'attention retombe — le seuil de `guide.ts`. */
const LONG_SHOT = 3.5;

/** Durée visée par le découpage d'un plan trop long. */
const CHOP_TARGET = 2;

/** En deçà, un trou entre deux textes ne mérite pas qu'on y pose un emplacement. */
const MIN_GAP = 1.5;

/** Écart en deçà duquel deux bruitages n'en font qu'un à l'oreille. */
const CUE_SPACING = 0.15;

export type CaptionSlot = {
  /** Texte à crochets, ou chaîne vide pour un emplacement à remplir. */
  text: string;
  style: CaptionStyleId;
  color?: string;
  scale?: number;
  y: number;
  /** Début, en fraction de la durée du montage. */
  at: number;
  /** Durée, en fraction de la durée du montage. */
  span: number;
};

export type CaptionSet = {
  id: string;
  label: string;
  /** Ce que la trame raconte, en une phrase. */
  why: string;
  /**
   * Rendu qui va avec la trame.
   *
   * Une bande-annonce n'a pas la couleur d'un tutoriel. Le rendu n'étant noté
   * nulle part, personne ne pense à le régler — et un montage sans parti pris
   * visuel reste une suite de plans, quelle que soit sa note.
   *
   * Il n'est appliqué que si l'utilisateur n'a rien choisi lui-même : `cinema`
   * est ce que pose le montage express, `naturel` est l'absence de choix. Tout
   * autre rendu est une décision, et ne se remplace pas.
   */
  look?: LookId;
  slots: CaptionSlot[];
};

/**
 * Trames de textes.
 *
 * Chaque trame est cohérente **avec elle-même** : une ouverture qui nomme, une
 * ou deux relances qui tiennent, une chute qui referme. C'est cette structure
 * qui est réutilisable d'une vidéo à l'autre, pas les mots — d'où les crochets,
 * repris de l'assistant d'accroche.
 *
 * Les positions sont des fractions de la durée : la même trame doit tomber juste
 * sur treize secondes comme sur trente. Seule l'ouverture est épinglée à zéro,
 * la notation exigeant un texte dans la toute première demi-seconde.
 *
 * **Les trames ne s'inventent pas.** Les quatre dernières viennent des formats
 * que la ligne éditoriale a déjà retenus (`/tiktok`) : le gabarit en quatre
 * temps — épreuve, déclic, action, ouverture — qui est la forme d'une histoire
 * vraie racontée à quelqu'un, et les trois formats nommés qui reposent sur
 * l'honnêteté du chiffre. En ajouter vingt de génériques serait pire que trois :
 * plus de choix, aucun qui soit celui de la chaîne.
 *
 * Les crochets marquent ce que **personne ne peut écrire à sa place** — ses
 * chiffres, ses délais, ses décisions. Les remplir d'une valeur plausible
 * détruit exactement ce qui fait marcher ces formats-là.
 */
export const CAPTION_SETS: CaptionSet[] = [
  {
    id: 'bande-annonce',
    label: 'Bande-annonce',
    why: 'Un titre, une menace, un dévoilement, une question qui appelle la suite.',
    look: 'blockbuster',
    slots: [
      { text: '[TITRE] — ÉPISODE [02]', style: 'neon', color: '#ffe14d', scale: 1.3, y: 0.22, at: 0, span: 0.17 },
      { text: '[Ce qui menace]', style: 'punch', y: 0.72, at: 0.22, span: 0.2 },
      { text: '[Ce qui se réveille]', style: 'karaoke', color: '#ffe14d', y: 0.72, at: 0.48, span: 0.19 },
      { text: 'QUEL [ROYAUME] TOMBE ENSUITE ?', style: 'punch', color: '#ff5c68', scale: 1.3, y: 0.3, at: 0.83, span: 0.17 },
    ],
  },
  {
    id: 'tutoriel',
    label: 'Tutoriel',
    why: 'Une promesse chiffrée, les étapes annoncées, ce qu’il faut retenir.',
    slots: [
      { text: '[3] erreurs qui tuent tes vues', style: 'punch', color: '#ffe14d', y: 0.28, at: 0, span: 0.17 },
      { text: '[La première]', style: 'karaoke', y: 0.72, at: 0.22, span: 0.2 },
      { text: '[La deuxième]', style: 'karaoke', y: 0.72, at: 0.48, span: 0.19 },
      { text: '[Fais ça à la place]', style: 'punch', color: '#22e37a', y: 0.3, at: 0.83, span: 0.17 },
    ],
  },
  {
    id: 'histoire',
    label: 'Histoire',
    why: 'Une situation, un basculement, ce qu’on en retire. Le récit se regarde jusqu’au bout.',
    look: 'argentique',
    slots: [
      { text: 'Le jour où j’ai [tout perdu]', style: 'punch', y: 0.28, at: 0, span: 0.18 },
      { text: '[Ce qui s’est passé]', style: 'karaoke', y: 0.72, at: 0.24, span: 0.2 },
      { text: '[Le moment où tout bascule]', style: 'punch', color: '#ffe14d', y: 0.3, at: 0.5, span: 0.18 },
      { text: '[Ce que j’en ai tiré]', style: 'minimal', y: 0.7, at: 0.82, span: 0.18 },
    ],
  },
  {
    id: 'epreuve-declic',
    label: 'Épreuve → déclic',
    why: 'Le gabarit qui retient : ce qui n’allait pas, l’instant où ça bascule, ce qu’on a fait, puis on rend la main.',
    slots: [
      { text: 'Pendant [trois semaines], [ce qui n’allait pas]', style: 'punch', y: 0.28, at: 0, span: 0.2 },
      { text: 'Puis [ce que j’ai vu / entendu]', style: 'karaoke', color: '#ffe14d', y: 0.72, at: 0.26, span: 0.2 },
      { text: '[Ce que j’ai fait, concrètement]', style: 'karaoke', y: 0.72, at: 0.52, span: 0.22 },
      { text: 'Et toi, [ta version] ?', style: 'minimal', y: 0.68, at: 0.82, span: 0.18 },
    ],
  },
  {
    id: 'resultat-dabord',
    label: 'Le résultat d’abord',
    why: 'Le résultat d’abord, la méthode ensuite. On ne regarde une méthode que si on a vu ce qu’elle donne.',
    look: 'cinema',
    slots: [
      { text: '[Ce que ça donne maintenant]', style: 'punch', color: '#ffe14d', scale: 1.2, y: 0.24, at: 0, span: 0.18 },
      { text: 'Il y a [deux mois] : [l’état d’avant]', style: 'minimal', y: 0.72, at: 0.24, span: 0.18 },
      { text: '[Ce qui a changé]', style: 'karaoke', y: 0.72, at: 0.48, span: 0.22 },
      { text: '[L’outil / le geste] — c’est tout', style: 'punch', y: 0.3, at: 0.82, span: 0.18 },
    ],
  },
  {
    id: 'chiffres-du-jour',
    label: 'Les chiffres du jour',
    why: 'Le format qui ne marche que s’il est vrai : ses vrais nombres, sans arrondir vers le haut.',
    slots: [
      { text: 'Jour [N] : [le chiffre]', style: 'punch', color: '#ffe14d', scale: 1.25, y: 0.26, at: 0, span: 0.2 },
      { text: '[Ce qui a marché]', style: 'karaoke', y: 0.72, at: 0.26, span: 0.22 },
      { text: '[Ce qui n’a rien donné]', style: 'karaoke', color: '#ff5c68', y: 0.72, at: 0.54, span: 0.2 },
      { text: 'Demain : [la prochaine tentative]', style: 'minimal', y: 0.68, at: 0.82, span: 0.18 },
    ],
  },
  {
    id: 'erreur-corrigee',
    label: 'L’erreur que j’ai laissée passer',
    why: 'On apprend plus d’un échec raconté que d’un conseil. Le prix payé se dit avant le remède.',
    look: 'argentique',
    slots: [
      { text: 'J’ai perdu [combien de temps] sur [quoi]', style: 'punch', y: 0.28, at: 0, span: 0.2 },
      { text: 'La cause : [ce que je croyais]', style: 'karaoke', y: 0.72, at: 0.26, span: 0.22 },
      { text: 'En vrai : [ce qui se passait]', style: 'karaoke', color: '#ffe14d', y: 0.72, at: 0.54, span: 0.2 },
      { text: '[Ce que je fais maintenant]', style: 'punch', y: 0.3, at: 0.82, span: 0.18 },
    ],
  },
];

export function captionSet(id: string): CaptionSet {
  return CAPTION_SETS.find((s) => s.id === id) ?? CAPTION_SETS[0];
}

/**
 * Bruitages de raccord, alternés.
 *
 * Le même souffle répété à chaque coupe cesse d'être entendu au bout de trois
 * occurrences : c'est la variation qui maintient l'effet.
 */
const RACCORD_CYCLE: SfxId[] = ['boom', 'whoosh', 'punch', 'swipe', 'whoosh', 'subdrop'];

/** Vrai si aucun bruitage ne sonne déjà à cet instant. */
function free(cues: SoundCue[], time: number, spacing = CUE_SPACING): boolean {
  return !cues.some((c) => Math.abs(c.time - time) < spacing);
}

/**
 * Un bruitage sur chaque raccord qui n'en a pas encore.
 *
 * C'est ce qui transforme une succession de plans en rythme perçu, et c'est ce
 * que la notation récompense le plus franchement côté son.
 */
export function soundsOnCuts(clips: Clip[], existing: SoundCue[], makeId: () => string): SoundCue[] {
  const placed = layoutClips(clips);
  const added: SoundCue[] = [];
  const seen = () => [...existing, ...added];

  // Un impact sur la toute première image : c'est lui qui fait lever les yeux.
  if (free(seen(), 0.02)) added.push({ id: makeId(), sfx: 'punch', time: 0.02, gain: 0.9 });

  placed.slice(1).forEach((item, index) => {
    const at = Math.max(0, item.start);
    if (free(seen(), at)) {
      added.push({ id: makeId(), sfx: RACCORD_CYCLE[index % RACCORD_CYCLE.length], time: at, gain: 0.85 });
    }
  });

  return added;
}

/** Une ponctuation là où l'analyse a vu l'attention retomber. */
export function tensionFills(moments: number[], existing: SoundCue[], makeId: () => string): SoundCue[] {
  const added: SoundCue[] = [];

  for (const moment of moments) {
    const at = Math.max(0, moment + 0.3);
    if (free([...existing, ...added], at, 0.2)) {
      added.push({ id: makeId(), sfx: 'sparkle', time: at, gain: 0.7 });
    }
  }

  return added;
}

/** Vrai si un texte occupe déjà tout ou partie de cet intervalle. */
function occupied(captions: Caption[], start: number, end: number): boolean {
  return captions.some((c) => c.start < end && c.end > start);
}

/**
 * Pose la trame, puis des emplacements vides dans les trous restants.
 *
 * Un emplacement vide ne compte dans aucune couverture — `captionCoverage`
 * écarte les textes vides — et c'est voulu : il sert à dire *où* il reste à
 * écrire, pas à gonfler la note d'un texte qui n'existe pas.
 */
function captionsFor(
  set: CaptionSet,
  existing: Caption[],
  duration: number,
  makeId: () => string,
): Caption[] {
  if (duration <= 0) return [];

  const added: Caption[] = [];
  const all = () => [...existing, ...added];

  for (const slot of set.slots) {
    const start = slot.at * duration;
    const end = Math.min(duration, start + slot.span * duration);
    if (end - start < 0.4) continue;
    if (occupied(all(), start, end)) continue;

    added.push({
      id: makeId(),
      text: slot.text,
      start,
      end,
      style: slot.style,
      y: slot.y,
      ...(slot.color ? { color: slot.color } : {}),
      ...(slot.scale ? { scale: slot.scale } : {}),
    });
  }

  // Les trous qui restent, du plus tôt au plus tard.
  const busy = all()
    .map((c) => [c.start, c.end] as const)
    .sort((a, b) => a[0] - b[0]);

  const relance = set.slots[1] ?? set.slots[0];
  let cursor = 0;

  for (const [start, end] of [...busy, [duration, duration] as const]) {
    if (start - cursor >= MIN_GAP) {
      added.push({
        id: makeId(),
        text: '',
        start: cursor + 0.1,
        end: start - 0.1,
        style: relance.style,
        y: relance.y,
      });
    }
    cursor = Math.max(cursor, end);
  }

  return added;
}

/**
 * Écarte les bruitages en trop, pour rendre du silence entre les impacts.
 *
 * Le remède inverse de `soundsOnCuts`, et il en a besoin : trop de bruitages
 * fatigue autant qu'aucun, et proposer d'en ajouter à un montage saturé revient
 * à conseiller ce qui abîme. On garde le premier de chaque intervalle plutôt
 * que d'en choisir un « meilleur » : leur ordre porte le rythme du montage, et
 * un tri sur le niveau le détruirait.
 */
export function thinCues(cues: SoundCue[], duration: number): SoundCue[] {
  if (duration <= 0 || cues.length === 0) return cues;

  const vise = Math.max(2, Math.round((duration / 10) * SFX_PER_10S.max));
  if (cues.length <= vise) return cues;

  const ecart = duration / vise;
  const ordonnes = [...cues].sort((a, b) => a.time - b.time);
  const gardes: SoundCue[] = [];

  for (const cue of ordonnes) {
    const dernier = gardes[gardes.length - 1];
    // La tolérance absorbe l'arrondi du calcul d'écart : sans elle, un impact
    // tombant pile sur la limite serait écarté sans raison.
    if (!dernier || cue.time - dernier.time >= ecart - 1e-6) gardes.push(cue);
  }

  return gardes;
}

/**
 * Rendu à appliquer, ou celui déjà en place s'il a été choisi.
 *
 * `naturel` est l'absence de parti pris, `cinema` est ce que le montage express
 * pose sans qu'on le lui demande : ni l'un ni l'autre n'est une décision. Tout
 * autre rendu en est une, et on n'y touche pas.
 */
export function cinemaFor(set: CaptionSet, actuel: CinemaSettings): CinemaSettings {
  const choisi = actuel.look !== 'naturel' && actuel.look !== 'cinema';
  if (choisi || !set.look) return actuel;

  return { ...actuel, look: set.look, intensity: Math.max(actuel.intensity, 0.85) };
}

export type FinishResult = {
  clips: Clip[];
  captions: Caption[];
  cues: SoundCue[];
  cinema: CinemaSettings;
};

/**
 * Construit tout ce que la notation récompense, sans rien remplacer.
 *
 * `makeId` est fourni par l'appelant plutôt qu'importé : les identifiants
 * doivent être prévisibles dans les tests, et le générateur du studio ne l'est
 * pas.
 */
export function buildFinish(
  project: Project,
  analysis: Analysis,
  setId: string,
  makeId: () => string,
): FinishResult {
  // Les plans qui s'étirent d'abord : ils changent la durée sur laquelle tout
  // le reste se répartit.
  const clips = project.clips
    .flatMap((clip) => {
      const shown = (clip.outPoint - clip.inPoint) / Math.max(0.1, clip.speed);
      return shown > LONG_SHOT ? chopped(clip, CHOP_TARGET, makeId) : [clip];
    })
    // Une ouverture qui avance vaut mieux qu'un plan fixe, et la notation le sait.
    .map((clip, index) => (index === 0 && clip.motion === 'none' ? { ...clip, motion: 'zoomIn' as const } : clip));

  const duration = totalDuration(clips);
  const captions = captionsFor(captionSet(setId), project.captions, duration, makeId);

  const cues = [
    ...soundsOnCuts(clips, project.cues, makeId),
    ...tensionFills(
      analysis.slumps.map((s) => s.start),
      project.cues,
      makeId,
    ),
  ];

  return {
    clips,
    captions,
    cues,
    // Le rendu n'est pas noté : on ne corrige que l'absence de parti pris.
    cinema: cinemaFor(captionSet(setId), project.cinema),
  };
}

/** Applique le résultat au projet, en conservant tout ce qui existait. */
export function applyFinish(
  project: Project,
  analysis: Analysis,
  setId: string,
  makeId: () => string,
): Project {
  const finish = buildFinish(project, analysis, setId, makeId);

  return {
    ...project,
    clips: finish.clips,
    captions: [...project.captions, ...finish.captions],
    cues: [...project.cues, ...finish.cues],
    cinema: finish.cinema,
  };
}

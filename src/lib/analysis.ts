import { crochetsARemplir } from './captions.ts';
import { groupesSemblables } from './ressemblance.ts';
import { layoutClips, totalDuration, type PlacedClip } from './timeline.ts';
import type { Caption, Project } from './types.ts';

/**
 * Analyse du montage.
 *
 * Ce moteur note la **structure du montage** — rythme des coupes, force du
 * hook, ponctuation sonore, couverture en texte, tenue de la tension. Il ne
 * regarde pas le contenu des images : il ne sait pas si le plan est beau ni si
 * la punchline est drôle. Ce qu'il sait faire, c'est repérer ce qui fait
 * décrocher mécaniquement — un début mou, un plan qui traîne, un trou de
 * plusieurs secondes sans rien pour relancer l'attention.
 *
 * Toutes les cibles ci-dessous visent le format vertical court.
 */

/** Fenêtre d'attention décisive : si c'est raté ici, le reste ne sera pas vu. */
export const HOOK_WINDOW = 3;

/** Fréquence d'échantillonnage de la courbe de tension, en Hz. */
const SAMPLE_RATE = 20;

/** En dessous de ce niveau, l'attention du spectateur retombe. */
const LOW_TENSION = 0.28;

/** Durée à partir de laquelle un passage mou devient un décrochage. */
const SLUMP_MIN_DURATION = 2.5;

export type CriterionId = 'hook' | 'rythme' | 'tension' | 'texte' | 'son' | 'format';

export type Criterion = {
  id: CriterionId;
  label: string;
  /** Note brute de 0 à 1. */
  score: number;
  /** Poids dans la note finale, en points sur 100. */
  weight: number;
  /** Ce que mesure le critère, en une phrase. */
  detail: string;
  /**
   * Le geste à faire pour gagner des points, en une phrase impérative.
   *
   * Une note sans consigne ne sert à rien : savoir que le rythme vaut 0 sur 20
   * ne dit pas quoi toucher. La consigne nomme donc l'outil et l'endroit, avec
   * les valeurs mesurées, plutôt qu'un conseil de portée générale.
   */
  remedy: string;
};

/** Un passage où la tension retombe trop longtemps. */
export type TensionSlump = {
  start: number;
  end: number;
  duration: number;
};

export type Advice = {
  /** Points de note récupérables en corrigeant ce point. */
  impact: number;
  message: string;
};

/**
 * Un défaut qui empêche un montage d'être bon, quoi que valent les autres.
 *
 * Ce n'est pas un critère de plus : c'est ce qui **plafonne** la note. La
 * distinction vient d'une remarque de l'utilisateur, et elle était juste — une
 * somme pondérée ne sait pas dire « celle-là, non ». Mesuré sur le cas le plus
 * défavorable : une vidéo carrée, plan strictement fixe, cinquante secondes,
 * celle qui fait 6 % de rétention réelle sur TikTok, décrochait **82 sur 100**
 * parce que trois critères pleins portaient soixante-dix points à eux seuls.
 */
export type Bloquant = {
  id: string;
  /** Ce qui ne va pas, en une phrase, du point de vue de la personne. */
  probleme: string;
  /** Le geste qui le règle. Jamais « il faudrait », toujours quoi faire. */
  remede: string;
};

export type Analysis = {
  /** Note globale sur 100. */
  score: number;
  /**
   * Ce qui plafonne la note. Vide quand rien ne bloque.
   *
   * L'ordre compte : le premier est celui qui coûte le plus cher à laisser.
   */
  bloquants: Bloquant[];
  /** Appréciation courte associée à la note. */
  verdict: string;
  criteria: Criterion[];
  /** Courbe de tension échantillonnée, valeurs de 0 à 1. */
  curve: { time: number; value: number }[];
  slumps: TensionSlump[];
  advice: Advice[];
  duration: number;
  shotCount: number;
  /** Durée moyenne d'un plan, en secondes. */
  averageShot: number;
};

/**
 * Note une valeur selon une plage idéale.
 *
 * Renvoie 1 dans l'intervalle `[idealMin, idealMax]`, puis décroît linéairement
 * jusqu'à 0 aux bornes `hardMin` / `hardMax`.
 */
export function band(
  value: number,
  idealMin: number,
  idealMax: number,
  hardMin: number,
  hardMax: number,
): number {
  if (value >= idealMin && value <= idealMax) return 1;
  if (value < idealMin) {
    if (value <= hardMin) return 0;
    return (value - hardMin) / (idealMin - hardMin);
  }
  if (value >= hardMax) return 0;
  return (hardMax - value) / (hardMax - idealMax);
}

/** Impulsion qui retombe : pleine à l'instant du choc, nulle après `decay`. */
function pulse(elapsed: number, decay: number): number {
  if (elapsed < 0 || elapsed > decay) return 0;
  return 1 - elapsed / decay;
}

/** Part de la timeline couverte par au moins un sous-titre. */
export function captionCoverage(captions: Caption[], duration: number): number {
  if (duration <= 0 || captions.length === 0) return 0;

  const intervals = captions
    // Un sous-titre sans texte n'affiche rien : le compter comme couvert
    // gonflerait la note d'un écran resté vide. Les emplacements posés par
    // « Poser les réglages » sont là pour dire où écrire, pas pour noter.
    .filter((c) => c.text.trim().length > 0)
    .map((c) => [Math.max(0, Math.min(c.start, c.end)), Math.min(duration, Math.max(c.start, c.end))] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  let covered = 0;
  let cursorStart = -1;
  let cursorEnd = -1;

  for (const [start, end] of intervals) {
    if (start > cursorEnd) {
      if (cursorEnd > cursorStart) covered += cursorEnd - cursorStart;
      cursorStart = start;
      cursorEnd = end;
    } else {
      cursorEnd = Math.max(cursorEnd, end);
    }
  }
  if (cursorEnd > cursorStart) covered += cursorEnd - cursorStart;

  return covered / duration;
}

/**
 * Construit la courbe de tension.
 *
 * Chaque évènement de montage injecte de l'énergie qui retombe ensuite : une
 * coupe relance l'attention pendant environ une seconde, un bruitage un peu
 * moins, tandis qu'un sous-titre affiché ou un mouvement de caméra entretient
 * un niveau de fond tant qu'ils durent.
 */
export function tensionCurve(project: Project): { time: number; value: number }[] {
  const placed = layoutClips(project.clips);
  const duration = placed.length === 0 ? 0 : placed[placed.length - 1].end;
  if (duration <= 0) return [];

  // Une coupe au tout début ne compte pas : rien ne précède pour contraster.
  const cuts = placed.slice(1).map((p) => ({ time: p.start, strength: p.clip.transition === 'cut' ? 1 : 0.85 }));
  const samples: { time: number; value: number }[] = [];
  const step = 1 / SAMPLE_RATE;

  for (let time = 0; time <= duration; time += step) {
    let energy = 0.12; // Bruit de fond : une vidéo qui défile n'est jamais à zéro.

    for (const cut of cuts) energy += 0.75 * cut.strength * pulse(time - cut.time, 1.1);
    for (const cue of project.cues) energy += 0.55 * cue.gain * pulse(time - cue.time, 0.9);

    for (const caption of project.captions) {
      if (time < caption.start || time > caption.end) continue;
      // Un texte accroche fort à son apparition, puis devient du décor.
      energy += 0.2 + 0.35 * pulse(time - caption.start, 0.8);
    }

    const layer = placed.find((p) => time >= p.start && time < p.end) ?? placed[placed.length - 1];
    if (layer.clip.motion !== 'none') energy += 0.18;
    if (layer.clip.speed > 1.15) energy += 0.12;

    samples.push({ time, value: Math.min(1, energy) });
  }

  return samples;
}

/** Repère les passages où la tension reste trop longtemps au plancher. */
export function findSlumps(curve: { time: number; value: number }[]): TensionSlump[] {
  const slumps: TensionSlump[] = [];
  let start: number | null = null;

  for (const sample of curve) {
    if (sample.value < LOW_TENSION) {
      if (start === null) start = sample.time;
    } else if (start !== null) {
      if (sample.time - start >= SLUMP_MIN_DURATION) {
        slumps.push({ start, end: sample.time, duration: sample.time - start });
      }
      start = null;
    }
  }

  const last = curve[curve.length - 1];
  if (start !== null && last && last.time - start >= SLUMP_MIN_DURATION) {
    slumps.push({ start, end: last.time, duration: last.time - start });
  }

  return slumps;
}

/**
 * Densité de bruitages visée, pour dix secondes de montage.
 *
 * Exportée parce que la notation n'est plus seule à s'en servir : l'interface
 * doit savoir s'il en manque avant de proposer d'en poser. Le bouton était
 * offert sans condition, et conseillait donc d'en ajouter à un montage déjà
 * saturé. Mesuré : à partir de trois bruitages pour dix secondes, poser un
 * impact sur chaque coupe fait **baisser** le critère « son » — 0,60 à 0,45,
 * puis 0,22 à six, puis zéro à onze. La note globale, elle, pouvait monter,
 * parce que les mêmes bruitages nourrissent la tension : c'est ce qui masquait
 * les dégâts.
 */
export const SFX_PER_10S = { min: 1.2, max: 6 };

/** Note les trois premières secondes, là où le spectateur décide de rester. */
function scoreHook(project: Project, placed: PlacedClip[], duration: number): number {
  if (placed.length === 0) return 0;

  let score = 0;

  // Un texte d'accroche très tôt : le levier le plus puissant du format court.
  const earlyCaption = project.captions.find((c) => c.start <= 1.2 && c.end > c.start);
  if (earlyCaption) score += earlyCaption.start <= 0.5 ? 0.4 : 0.3;

  // Une première coupe rapide prouve au spectateur qu'il va se passer quelque chose.
  const firstCut = placed[1]?.start ?? duration;
  score += 0.3 * band(firstCut, 0.6, 2.2, 0, HOOK_WINDOW + 1.5);

  // Une ponctuation sonore dans la première seconde ancre l'attention.
  if (project.cues.some((c) => c.time <= 1)) score += 0.15;

  // Un plan d'ouverture qui bouge vaut mieux qu'un plan fixe.
  if (placed[0].clip.motion !== 'none') score += 0.15;

  return Math.min(1, score);
}

/** Analyse complète du montage. */
export function analyzeProject(project: Project): Analysis {
  const placed = layoutClips(project.clips);
  const duration = totalDuration(project.clips);
  const shotCount = placed.length;

  if (shotCount === 0 || duration <= 0) {
    return {
      score: 0,
      // Un montage vide n'a pas de defaut bloquant : il n'a rien du tout, et
      // le guide dit deja quoi faire.
      bloquants: [],
      verdict: 'Montage vide',
      criteria: [],
      curve: [],
      slumps: [],
      advice: [{ impact: 100, message: 'Ajoute un premier clip à la timeline pour lancer l’analyse.' }],
      duration: 0,
      shotCount: 0,
      averageShot: 0,
    };
  }

  const curve = tensionCurve(project);
  const slumps = findSlumps(curve);
  const averageShot = duration / shotCount;
  const coverage = captionCoverage(project.captions, duration);
  // Les bruitages importés comptent autant que ceux de synthèse : à l'oreille
  // rien ne les distingue, et n'en retenir qu'une sorte notait à zéro un
  // montage entièrement ponctué de fichiers déposés.
  const cuesPer10s = ((project.cues.length + project.samples.length) / duration) * 10;
  const hasVoice = project.voices.some((v) => v.duration > 0);

  // Le plan le plus long donne le meilleur signal d'un montage qui s'endort.
  const longestShot = Math.max(...placed.map((p) => p.duration));
  const slumpRatio = slumps.reduce((sum, s) => sum + s.duration, 0) / duration;

  const hook = scoreHook(project, placed, duration);
  const rythme = 0.65 * band(averageShot, 1.1, 2.8, 0.25, 7) + 0.35 * band(longestShot, 0, 3.5, 0, 9);
  const tension = Math.max(0, 1 - slumpRatio * 2.2 - Math.min(0.35, slumps.length * 0.08));
  const texte = band(coverage, 0.55, 0.95, 0, 1.01);
  /*
   * Le son se juge sur trois apports, non sur deux.
   *
   * La voix off n'y pesait rien : un montage entièrement porté par une voix —
   * le cas de toute vidéo qui raconte quelque chose — était noté comme un
   * montage muet, et le guide continuait à réclamer des bruitages par-dessus
   * une bande déjà pleine.
   *
   * La ponctuation garde la part principale : c'est elle qui donne le rythme,
   * et c'est le seul apport dont l'absence s'entend immédiatement.
   */
  const son = Math.min(
    1,
    0.6 * band(cuesPer10s, SFX_PER_10S.min, SFX_PER_10S.max, 0, 14) + (project.music ? 0.2 : 0) + (hasVoice ? 0.2 : 0),
  );
  const format = 0.7 * band(duration, 7, 35, 2, 90) + 0.3 * verticalShare(project);

  const hasEarlyCaption = project.captions.some((c) => c.start <= 1.2 && c.end > c.start);

  const criteria: Criterion[] = [
    {
      id: 'hook',
      label: 'Hook',
      score: hook,
      weight: 30,
      detail: `Les ${HOOK_WINDOW} premières secondes : texte d’accroche, première coupe, impact sonore.`,
      remedy: !hasEarlyCaption
        ? 'Ouvre Accroche et choisis une formule : elle se posera sur la toute première image.'
        : shotCount === 1
          ? 'Il n’y a qu’un seul plan : rien ne bouge dans les 3 premières secondes. Coupe-le en deux dans Monter, avec les ciseaux ✂ au-dessus de la timeline.'
          : 'Rapproche ta première coupe (vise avant 2 s), et pose un bruitage sur la première seconde dans Son.',
    },
    {
      id: 'rythme',
      label: 'Rythme',
      score: rythme,
      weight: 20,
      detail: `Cadence des coupes — ${averageShot.toFixed(1)} s par plan, le plus long fait ${longestShot.toFixed(1)} s.`,
      remedy:
        longestShot > 3.5
          ? `Ton plan le plus long fait ${longestShot.toFixed(1)} s. Place la tête de lecture dedans et touche les ciseaux ✂ pour le couper en deux, autant de fois qu’il faut pour descendre sous 3 s.`
          : averageShot < 1.1
            ? 'Tes plans s’enchaînent trop vite pour être lus. Rallonge-les dans Monter, avec le curseur « Fin dans le rush ».'
            : 'Varie la longueur des plans : une alternance court / long se remarque plus qu’une cadence régulière.',
    },
    {
      id: 'tension',
      label: 'Tension',
      score: tension,
      weight: 20,
      detail:
        slumps.length === 0
          ? 'Aucune retombée d’attention prolongée détectée.'
          : `${slumps.length} passage${slumps.length > 1 ? 's' : ''} où l’attention retombe trop longtemps.`,
      remedy:
        slumps.length === 0
          ? 'Rien à corriger ici.'
          : `Touche un passage signalé plus bas pour y aller, puis fais-y arriver quelque chose : une coupe, un bruitage ou l’apparition d’un texte.`,
    },
    {
      id: 'texte',
      label: 'Sous-titres',
      score: texte,
      weight: 15,
      detail: `${Math.round(coverage * 100)} % de la vidéo est couverte par du texte à l’écran.`,
      remedy:
        coverage < 0.55
          ? `Tu es à ${Math.round(coverage * 100)} %, vise 70 %. Dans Accroche, avance la tête de lecture et touche « + Ajouter » à chaque nouvelle idée.`
          : 'Le texte sature l’image. Raccourcis quelques sous-titres pour laisser respirer entre deux phrases.',
    },
    {
      id: 'son',
      label: 'Son',
      score: son,
      weight: 10,
      detail: `${cuesPer10s.toFixed(1)} bruitage${cuesPer10s >= 2 ? 's' : ''} pour 10 s${project.music ? ', musique de fond' : ''}${hasVoice ? ', voix off' : ''}${!project.music && !hasVoice ? ', ni musique ni voix off' : ''}.`,
      remedy:
        project.cues.length + project.samples.length === 0
          ? 'Ouvre Son, place-toi sur une coupe et pose un Whoosh. Écoute chaque bruitage avec ♪ avant de le poser.'
          : !project.music
            ? 'Ajoute une musique de fond dans Son : elle soude les plans entre eux.'
            : // La musique passe avant : elle s'importe en un geste, là où une voix
              // off est un tournage en soi. On ne réclame pas le plus lourd d'abord.
              !hasVoice
              ? 'Ajoute une voix off dans Son : elle porte le propos, et ses sous-titres se calent tout seuls.'
              : 'Ponctue davantage tes coupes avec des bruitages.',
    },
    {
      id: 'format',
      label: 'Format',
      score: format,
      weight: 5,
      detail: `Durée totale de ${duration.toFixed(1)} s et cadrage des sources.`,
      remedy:
        duration > 35
          ? `${duration.toFixed(0)} s, c’est long. Raccourcis ou supprime des plans pour descendre sous 35 s.`
          : duration < 7
            ? 'Trop court. Ajoute un rush, ou duplique un plan existant depuis Monter.'
            : 'Durée idéale. Vérifie que tes rushes sont bien verticaux.',
    },
  ];

  const somme = Math.round(criteria.reduce((sum, c) => sum + c.score * c.weight, 0));
  const bloquants = defautsBloquants(project, { coverage, longestShot });

  /*
   * Un defaut bloquant PLAFONNE la note, il ne la penalise pas.
   *
   * C'etait une somme ponderee, et une somme ne sait pas dire « celle-la,
   * non » : quatre crochets non remplis coutaient treize points quand
   * l'accroche en rapportait trente. Mesure sur une video carree, plan
   * strictement fixe, cinquante secondes — celle qui fait 6 % de retention
   * reelle : 82 sur 100.
   *
   * Le plafond ne remplace pas les criteres, il les borne. Un montage sans
   * defaut bloquant est note exactement comme avant ; un montage qui en porte
   * un ne peut pas depasser `PLAFOND_BLOQUE`, quel que soit le reste. C'est ce
   * que veut dire « bien monte avant d'etre viral ».
   */
  const score = bloquants.length > 0 ? Math.min(somme, PLAFOND_BLOQUE) : somme;

  return {
    score,
    bloquants,
    verdict: verdictFor(score),
    criteria,
    curve,
    slumps,
    advice: buildAdvice(criteria, slumps, project, { averageShot, longestShot, coverage, duration }),
    duration,
    shotCount,
    averageShot,
  };
}

/** Note maximale d'un montage qui porte au moins un défaut bloquant. */
export const PLAFOND_BLOQUE = 40;

/** Couverture texte en deçà de laquelle la vidéo ne se suit plus sans le son. */
const COUVERTURE_BLOQUANTE = 0.25;

/** Durée au-delà de laquelle un plan seul endort le film. */
const PLAN_QUI_DORT = 6;

/**
 * Les défauts qui empêchent un montage d'être bon, quoi que valent les autres.
 *
 * Chacun est mesuré, jamais estimé, et chacun a été rencontré sur un vrai
 * montage livré puis rejeté. Ils sont rendus dans l'ordre de ce qu'ils coûtent
 * à laisser : un texte de gabarit non rempli part à l'écran et se lit, une
 * vidéo sans texte ne se suit pas sans le son, un cadrage répété n'avance nulle
 * part, un plan qui dort perd le spectateur, un format non vertical est rogné
 * par la plateforme.
 *
 * Ce qui n'est **pas** ici : tout ce qui relève du goût. Le plafond ne juge pas
 * si un montage est beau — il constate qu'il n'est pas fini.
 */
export function defautsBloquants(
  project: Project,
  mesures: { coverage: number; longestShot: number },
): Bloquant[] {
  const trouves: Bloquant[] = [];

  /*
   * Les crochets des gabarits, gravés dans le fichier.
   *
   * Constaté sur un montage livré : quatre textes sur quatre étaient des trous
   * — « [Ce qui menace] », « QUEL [ROYAUME] TOMBE ENSUITE ? ». Aucune mesure ne
   * le disait, la couverture texte était même bonne puisqu'il y avait du texte.
   * C'est le défaut le plus visible d'une vidéo publiée, et le seul que
   * personne ne pardonne.
   */
  const aRemplir = crochetsARemplir(project.captions);
  if (aRemplir.length > 0) {
    trouves.push({
      id: 'crochets',
      probleme: `${aRemplir.length} texte${aRemplir.length > 1 ? 's' : ''} du gabarit ${
        aRemplir.length > 1 ? 'restent' : 'reste'
      } à remplir`,
      remede: 'Remplace ce qui est entre crochets par tes mots, dans Accroche.',
    });
  }

  // Sans texte, une vidéo verticale ne se suit pas : la majorité la regarde
  // sans le son, et le sous-titrage n'est pas un ornement.
  if (mesures.coverage < COUVERTURE_BLOQUANTE && project.clips.length > 0) {
    trouves.push({
      id: 'texte-absent',
      probleme: `Du texte sur ${Math.round(mesures.coverage * 100)} % de la vidéo seulement`,
      remede: 'Ajoute des textes dans Accroche : on regarde sans le son.',
    });
  }

  /*
   * Des plans qui montrent la même chose.
   *
   * Un montage peut avoir la bonne cadence, la bonne durée et la bonne note, et
   * n'avancer nulle part. Constaté sur un montage rejeté : neuf rushes, dont
   * sept au même cadrage, et toutes les mesures au vert.
   */
  const montes = new Set(project.clips.map((c) => c.assetId));
  const groupes = groupesSemblables(project.assets.filter((a) => montes.has(a.id)));
  const plusGrand = groupes[0]?.length ?? 0;
  if (plusGrand > 2) {
    trouves.push({
      id: 'ressemblance',
      probleme: `${plusGrand} rushes montrent presque la même image`,
      remede: 'Un plan large, un gros plan, un objet — varie les cadrages.',
    });
  }

  if (mesures.longestShot > PLAN_QUI_DORT) {
    trouves.push({
      id: 'plan-qui-dort',
      probleme: `Un plan dure ${mesures.longestShot.toFixed(1)} s sans rien changer`,
      remede: `Découpe-le : au-delà de ${PLAN_QUI_DORT} s sans coupe, on décroche.`,
    });
  }

  /*
   * Un format qui n'est pas vertical.
   *
   * Le test était `height >= width`, donc **un carré passait pour vertical** et
   * marquait plein. Relevé sur une vidéo carrée réellement publiée : 6 % de
   * rétention moyenne, décrochage à la première seconde. La plateforme rogne ou
   * encadre, et le résultat se voit tout de suite.
   */
  const nonVerticaux = project.clips.filter((clip) => {
    const asset = project.assets.find((a) => a.id === clip.assetId);
    return asset ? asset.height <= asset.width : false;
  }).length;
  if (nonVerticaux > 0) {
    trouves.push({
      id: 'format',
      probleme: `${nonVerticaux} plan${nonVerticaux > 1 ? 's ne sont pas' : ' n’est pas'} au format vertical`,
      remede: 'Reprends des rushes en 9:16 : un carré ou un paysage est rogné.',
    });
  }

  return trouves;
}

/** Part des clips dont la source est strictement plus haute que large. */
function verticalShare(project: Project): number {
  if (project.clips.length === 0) return 0;
  const vertical = project.clips.filter((clip) => {
    const asset = project.assets.find((a) => a.id === clip.assetId);
    // Strictement plus haut que large : le test était `>=`, et **un carré
    // passait donc pour vertical**. Relevé sur une vidéo 1080 × 1080 réellement
    // publiée : 6 % de rétention moyenne. Un carré n'est pas un format vertical,
    // c'est un format que la plateforme encadre.
    return asset ? asset.height > asset.width : false;
  }).length;
  return vertical / project.clips.length;
}

function verdictFor(score: number): string {
  if (score >= 85) return 'Potentiel viral';
  if (score >= 70) return 'Prêt à poster';
  if (score >= 50) return 'Correct, mais ça décroche';
  if (score >= 30) return 'À retravailler';
  return 'Le spectateur ne restera pas';
}

/** Conseils concrets, triés par nombre de points récupérables. */
function buildAdvice(
  criteria: Criterion[],
  slumps: TensionSlump[],
  project: Project,
  stats: { averageShot: number; longestShot: number; coverage: number; duration: number },
): Advice[] {
  const advice: Advice[] = [];
  const lost = (id: CriterionId) => {
    const c = criteria.find((x) => x.id === id)!;
    return Math.round((1 - c.score) * c.weight);
  };

  const hookLoss = lost('hook');
  if (hookLoss > 2) {
    if (!project.captions.some((c) => c.start <= 1.2)) {
      advice.push({
        impact: hookLoss,
        message: 'Aucune accroche texte dans la première seconde. Pose une phrase qui crée une question dès l’image 1.',
      });
    } else {
      advice.push({
        impact: hookLoss,
        message: 'Le hook manque d’impact : coupe plus tôt, ajoute un bruitage sur la première seconde ou anime le plan d’ouverture.',
      });
    }
  }

  for (const slump of slumps.slice(0, 3)) {
    advice.push({
      impact: Math.round(Math.min(20, slump.duration * 3)),
      message: `Descente de tension de ${slump.duration.toFixed(1)} s à partir de ${slump.start.toFixed(1)} s : coupe dedans, ajoute un bruitage ou fais apparaître du texte.`,
    });
  }

  if (stats.longestShot > 3.5) {
    advice.push({
      impact: lost('rythme'),
      message: `Ton plan le plus long dure ${stats.longestShot.toFixed(1)} s. Au-delà de 3 s sans évènement, le pouce repart.`,
    });
  }

  const texteLoss = lost('texte');
  if (texteLoss > 2) {
    advice.push({
      impact: texteLoss,
      message:
        stats.coverage < 0.55
          ? `Seulement ${Math.round(stats.coverage * 100)} % de la vidéo est sous-titrée. Vise 70 % : la majorité regarde sans le son.`
          : 'Le texte est présent en continu et sature l’image. Laisse respirer entre deux phrases.',
    });
  }

  const sonLoss = lost('son');
  if (sonLoss > 2) {
    advice.push({
      impact: sonLoss,
      message: project.cues.length === 0
        ? 'Aucun bruitage. Un whoosh sur les transitions et un impact sur les moments clés changent radicalement la perception du rythme.'
        : 'Ponctue davantage les coupes avec des bruitages, et ajoute une musique de fond.',
    });
  }

  if (stats.duration > 45) {
    advice.push({
      impact: lost('format'),
      message: `${stats.duration.toFixed(0)} s, c’est long pour ce format. Sous 35 s, le taux de complétion grimpe nettement.`,
    });
  } else if (stats.duration < 7) {
    advice.push({
      impact: lost('format'),
      message: 'Moins de 7 s : trop court pour installer quoi que ce soit. Ajoute un plan ou deux.',
    });
  }

  return advice.sort((a, b) => b.impact - a.impact);
}

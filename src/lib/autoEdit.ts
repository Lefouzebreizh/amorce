import { CAPTION_SETS, captionsFor } from './autoFinish.ts';
import { uid } from './id.ts';
import { MOUVEMENTS_ALTERNES, totalDuration } from './timeline.ts';
import {
  DEFAULT_CLIP,
  type Caption,
  type Clip,
  type MediaAsset,
  type Project,
  type SfxId,
  type SoundCue,
  type TransitionKind,
} from './types.ts';

/**
 * Montage express.
 *
 * Assemble un projet complet à partir des seuls rushes importés, sans rien
 * demander. L'objectif n'est pas de produire le meilleur montage possible —
 * c'est de faire passer quelqu'un qui n'a jamais monté d'une pile de fichiers à
 * un résultat regardable, qu'il pourra ensuite retoucher plan par plan.
 *
 * Les choix appliqués sont ceux que l'analyse récompense : plans courts,
 * ouverture qui bouge, transitions ponctuées de bruitages, rendu cinéma dosé.
 */

/** Durée visée pour un plan. Au-delà de 3 s sans évènement, l'attention lâche. */
const TARGET_SHOT = 2.1;

/**
 * Durée visée pour le montage entier.
 *
 * La longueur d'un plan était fixe : deux secondes un, quel que soit le nombre
 * de rushes. Plus on importait, plus le film s'allongeait — mesuré, douze
 * rushes donnaient 21,9 s, vingt en donnaient 36,3 et trente 54,3. Au-delà de
 * quarante-cinq secondes le guide réclame ensuite de raccourcir, une fois par
 * plan : le montage express fabriquait donc lui-même le travail qu'il annonçait
 * éviter.
 *
 * Vingt-deux secondes est la cible : assez pour installer une idée, sous les
 * trente-cinq où la part de spectateurs qui vont au bout décroche. La longueur
 * du plan s'y adapte au lieu de la subir — avec beaucoup de rushes, les plans
 * raccourcissent, ce qui donne au passage le montage nerveux que le format
 * court demande.
 */
const DUREE_VISEE = 22;

/*
 * Ce qu'un plan doit durer **à l'écran** pour être lu.
 *
 * Le chiffre n'est pas choisi ici : c'est le bas de la bande que `analysis.ts`
 * récompense — `band(averageShot, 1.1, 2.8, …)`. Le montage express produisait
 * un film que sa propre analyse pénalisait, et le guide lui répondait « tes
 * plans s'enchaînent trop vite pour être lus ». Une application qui se
 * contredit d'un module à l'autre donne exactement l'impression de n'importe
 * quoi qu'on lui a reprochée.
 */
const MIN_SHOT_VU = 1.1;

/*
 * La longueur de **coupe** minimale, qui n'est pas la même chose.
 *
 * Une transition recouvre la fin d'un plan et le début du suivant : mesuré,
 * 0,29 s disparaissent à chaque raccord. Un plancher de coupe à 0,90 s laissait
 * donc 0,61 s vues — moitié moins que ce que l'analyse demande, et personne ne
 * le voyait parce que les deux durées portent le même nom dans la tête de qui
 * lit le code.
 *
 * Mesuré sur le montage express : vingt rushes donnaient 0,81 s vues,
 * vingt-huit et au-delà 0,61 s, quel que soit le nombre de rushes.
 */
const MIN_SHOT = 1.4;

/*
 * Le nombre de plans que l'express se permet.
 *
 * Deux bornes de `analysis.ts` se rencontrent ici, et au-delà d'un certain
 * nombre de rushes elles ne peuvent plus être tenues ensemble : un plan doit
 * durer au moins `MIN_SHOT_VU`, et un film au-delà de 35 s est pénalisé —
 * c'est là que la part de spectateurs qui vont au bout décroche.
 *
 * On tranche du côté du film : les rushes en trop restent dans la
 * bibliothèque, disponibles pour la suite. Ce n'est pas une perte
 * silencieuse — le bouton annonce combien il en prend, et dit pourquoi.
 */
const DUREE_MAX = 35;
export const PLANS_MAX = Math.floor(DUREE_MAX / MIN_SHOT_VU);

/** Transitions alternées, pour éviter la monotonie d'un effet répété. */
const TRANSITION_CYCLE: TransitionKind[] = ['zoomPunch', 'whipPan', 'fade', 'slideUp', 'flash'];

/**
 * Le bruitage d'un raccord suit la transition qui le porte.
 *
 * Il suivait un compteur qui tourne — `RACCORD_CYCLE[(index - 1) % 6]` — donc
 * **le rang du plan, et rien d'autre**. Deux jeux de rushes sans aucun rapport,
 * du moment qu'ils faisaient le même nombre de plans, recevaient la même suite
 * de sons au son près. C'est ce que le propriétaire a entendu et nommé
 * « plaqué automatiquement, sans rapport avec le contenu ».
 *
 * La table ci-dessous rattache chaque son au **geste visible** qu'il
 * accompagne : un balayé reçoit un souffle qui balaye, un fondu reçoit une
 * descente et jamais un impact, un éclair reçoit un éclat. Ce n'est pas de la
 * décoration cohérente pour le plaisir : un impact sur un fondu s'entend comme
 * une erreur, parce que l'oreille attend ce que l'œil annonce.
 *
 * La variation que l'ancien cycle cherchait ne disparaît pas — elle vient
 * désormais de la variation des transitions, qui est elle-même visible.
 */
const SFX_PAR_TRANSITION: Record<TransitionKind, SfxId> = {
  cut: 'punch',
  zoomPunch: 'boom',
  whipPan: 'whoosh',
  slideUp: 'swipe',
  flash: 'sparkle',
  glitch: 'zap',
  fade: 'subdrop',
};

/**
 * Les transitions qui appellent une anticipation, et celles qui la refusent.
 *
 * L'aspiration `reverse` annonce un choc. Posée avant un fondu, elle annonce
 * quelque chose qui n'arrive pas.
 */
const TRANSITIONS_A_ANTICIPER: TransitionKind[] = ['zoomPunch', 'whipPan', 'flash', 'glitch'];

/** Texte d'accroche déposé par défaut, explicitement à remplacer. */
export const PLACEHOLDER_HOOK = 'Attends la fin 👀';

/**
 * Découpe un rush en un plan de durée utile.
 *
 * `keepWhole` conserve le rush entier au lieu de le ramener à la durée visée.
 * C'est ce qu'il faut faire quand tout le propos tient dans un seul fichier :
 * le tronquer couperait la voix en plein milieu, et rien à l'écran ne dirait
 * qu'il manque six secondes de parole.
 */
function cutFromAsset(
  asset: MediaAsset,
  index: number,
  keepWhole: boolean,
  visee = TARGET_SHOT,
): Clip | null {
  if (asset.duration <= 0.2) return null;

  // On entre après le tout début : les premières images d'un rendu IA sont
  // souvent noires ou instables, le temps que la scène s'établisse. Sur un rush
  // qu'on garde entier, même cette amorce est conservée : elle peut porter les
  // premiers mots.
  const lead = keepWhole ? 0 : Math.min(asset.duration * 0.08, 0.4);
  const available = asset.duration - lead;
  const length = keepWhole ? available : Math.max(MIN_SHOT, Math.min(visee, available));

  if (length < 0.3) return null;

  return {
    ...DEFAULT_CLIP,
    id: uid('clip'),
    assetId: asset.id,
    inPoint: lead,
    outPoint: Math.min(asset.duration, lead + length),
    // Le premier plan doit démarrer sec : une transition sur du vide ne veut
    // rien dire, et ferait perdre les précieuses premières images.
    transition: index === 0 ? 'cut' : TRANSITION_CYCLE[(index - 1) % TRANSITION_CYCLE.length],
    transitionDuration: 0.3,
    // Une ouverture qui avance vaut mieux qu'un plan fixe, et aucun plan ne
    // reste immobile ensuite : voir `MOUVEMENTS_ALTERNES`.
    motion: index === 0 ? 'zoomIn' : MOUVEMENTS_ALTERNES[index % MOUVEMENTS_ALTERNES.length],
  };
}

export type AutoEditResult = {
  clips: Clip[];
  captions: Caption[];
  cues: SoundCue[];
};

/** Construit un montage complet à partir des rushes. */
export function buildAutoEdit(assets: MediaAsset[]): AutoEditResult {
  /*
   * Un seul rush : tout le propos y est, y compris ce qu'on y entend. On le
   * garde entier. Avec plusieurs rushes, on est face à une suite de plans à
   * enchaîner, et les couper court est précisément ce qu'on attend.
   *
   * Une image fixe ne relève pas de ce raisonnement : elle ne porte aucune
   * parole qu'on couperait en plein milieu, et la garder entière donnerait
   * six secondes d'immobilité — le plan le plus sûrement pénalisé par
   * l'analyse, et le plus sûrement passé par le spectateur.
   */
  const keepWhole = assets.length === 1 && assets[0].kind !== 'image';

  /*
   * La longueur d'un plan suit le nombre de rushes, bornée des deux côtés.
   *
   * En deçà de `MIN_SHOT` un plan n'a pas le temps d'être lu ; au-delà de
   * `TARGET_SHOT` l'attention lâche. Entre les deux, on vise la durée du film
   * plutôt que celle du plan.
   */
  const retenus = keepWhole ? assets : assets.slice(0, PLANS_MAX);
  const utilisables = Math.max(1, retenus.filter((a) => a.duration > 0.2).length);
  const visee = keepWhole
    ? TARGET_SHOT
    : Math.max(MIN_SHOT, Math.min(TARGET_SHOT, DUREE_VISEE / utilisables));

  const clips = retenus
    .map((asset, index) => cutFromAsset(asset, index, keepWhole, visee))
    .filter((clip): clip is Clip => clip !== null)
    // Le premier plan retenu doit porter les réglages d'ouverture, même si des
    // rushes trop courts ont été écartés en amont.
    .map((clip, index) => (index === 0 ? { ...clip, transition: 'cut' as const, motion: 'zoomIn' as const } : clip));

  if (clips.length === 0) return { clips: [], captions: [], cues: [] };

  const duration = totalDuration(clips);

  /*
   * L'accroche, puis la trame qui tient le reste de la durée.
   *
   * Ce tableau ne portait qu'**un** élément, écrit en dur, quelle que soit la
   * durée du montage : 2,4 s de texte sur trente secondes de film, soit 12,8 %
   * de couverture là où `analysis.ts` en exige 55 pour ne pas pénaliser. Le
   * produit savait donc noter ce qu'il venait lui-même de produire, et le
   * notait mal — sans que rien ne le signale, parce que le seul contrôle
   * existant vérifiait qu'un texte est *visible*.
   *
   * Les créneaux viennent de `autoFinish`, et c'est exprès : ce sont les mêmes
   * que le bouton « Poser les réglages » propose, aux mêmes instants. Les deux
   * gestes s'accordent au lieu de proposer deux squelettes différents, et le
   * second n'a plus rien à ajouter derrière le premier.
   *
   * Les crochets restent des crochets. Un texte plausible écrit à la place de
   * l'utilisateur est la seule chose que ce studio ne fera jamais : ce sont
   * ses mots qui portent la vidéo, pas les nôtres.
   */
  const accroche: Caption = {
    id: uid('cap'),
    text: PLACEHOLDER_HOOK,
    start: 0,
    end: Math.min(2.4, duration),
    style: 'punch',
    y: 0.28,
  };

  const captions: Caption[] = [
    accroche,
    ...captionsFor(CAPTION_SETS[0], [accroche], duration, () => uid('cap')),
  ];

  /*
   * Les bruitages ponctuent, ils ne tapissent pas.
   *
   * Un souffle était posé sur **chaque** raccord, plus une aspiration juste
   * avant : deux par coupe. L'analyse de ce même dépôt tient pourtant qu'un bon
   * montage porte 1,2 à 6 bruitages pour dix secondes — et le montage express
   * en posait 10,8 avec six rushes, 32,8 avec trente. Cinq fois le maximum
   * qu'il se donne à lui-même : soixante souffles en dix-huit secondes, et une
   * note pénalisée par sa propre mesure.
   *
   * On vise donc le milieu de la bande, quatre pour dix secondes, et on garde
   * un raccord sur `pasBruitage`. Les autres coupes restent nues — c'est ce qui
   * rend audibles celles qui sonnent.
   */
  /*
   * On compte les **raccords sonorisés**, pas le pas.
   *
   * Raisonner en pas retombe à un dès que les plans sont peu nombreux, et
   * l'aspiration qui accompagne chaque souffle double alors le total : mesuré,
   * douze rushes rendaient encore 12,8 bruitages pour dix secondes. Deux
   * raccords sonorisés pour dix secondes, portant au plus deux sons chacun,
   * donnent les quatre visés — au milieu de la bande que l'analyse juge bonne.
   */
  const RACCORDS_SONORISES_PAR_10S = 2;
  const raccords = Math.max(1, clips.length - 1);
  const voulus = Math.max(1, Math.round((duration / 10) * RACCORDS_SONORISES_PAR_10S));
  const pasBruitage = Math.max(1, Math.round(raccords / voulus));

  /*
   * Un rush qui porte déjà sa bande son n'en reçoit aucun par-dessus.
   *
   * C'est la moitié de la correction qui compte le plus, et la seule qui parle
   * vraiment de **contenu** : `hasAudio` dit que quelque chose s'entend déjà
   * dans ce plan — quelqu'un qui parle, le plus souvent. Un souffle posé
   * là-dessus ne ponctue rien, il recouvre. Le dépôt le savait déjà pour le
   * montage à la main — « le rush qui porte déjà sa bande son et qu'on
   * recouvre », dans `/montage-sans-refaire` — et le montage express le
   * faisait quand même, à chaque coupe.
   *
   * La règle vaut pour tous les sons plaqués, pas seulement les raccords :
   * l'impact d'ouverture, l'aspiration, la ponctuation de mi-plan et la note
   * finale tombent tous sur de l'image et du son qui existent.
   */
  const porteSonPropre = (clip: Clip) =>
    assets.find((asset) => asset.id === clip.assetId)?.hasAudio === true;

  const cues: SoundCue[] = [];
  let cursor = 0;

  // Un impact sur la toute première image : le son fait partie de l'accroche
  // autant que le texte, et c'est lui qui fait lever les yeux. Sauf si le
  // premier plan parle déjà — on n'ouvre pas en couvrant une phrase.
  if (!porteSonPropre(clips[0])) {
    cues.push({ id: uid('sfx'), sfx: 'punch', time: 0.02, gain: 0.9 });
  }

  clips.forEach((clip, index) => {
    const clipLength = (clip.outPoint - clip.inPoint) / clip.speed;
    const muet = !porteSonPropre(clip);

    if (index > 0) {
      cursor -= clip.transitionDuration;
      const at = Math.max(0, cursor);

      // Un raccord sur `pasBruitage` reçoit un souffle : c'est ce qui
      // transforme une succession de plans en rythme perçu. Les autres restent
      // nus, et c'est ce qui rend audibles ceux qui sonnent.
      if ((index - 1) % pasBruitage === 0 && muet) {
        cues.push({ id: uid('sfx'), sfx: SFX_PAR_TRANSITION[clip.transition], time: at, gain: 0.85 });

        /*
         * L'aspiration ne se pose que si le plan précédent est assez long pour
         * la porter. Sur des plans courts, une anticipation de 0,55 s tombe
         * avant la coupe **précédente** : elle n'annonce plus rien, elle brouille
         * ce qui vient de sonner.
         *
         * Et elle ne se pose que devant un choc : annoncer un fondu par une
         * aspiration promet un impact qui n'arrive jamais.
         */
        if (at > 1.2 && TRANSITIONS_A_ANTICIPER.includes(clip.transition) && !porteSonPropre(clips[index - 1])) {
          cues.push({ id: uid('sfx'), sfx: 'reverse', time: at - 0.55, gain: 0.55 });
        }
      }
    }

    cursor += clipLength;

    // Un plan qui s'étire est le premier endroit où l'attention retombe : on y
    // pose une ponctuation à mi-parcours plutôt que de le laisser nu. Un plan
    // qui parle, lui, ne s'étire pas dans le silence — il n'a rien à relancer.
    if (clipLength > 3.2 && muet) {
      cues.push({ id: uid('sfx'), sfx: 'sparkle', time: cursor - clipLength / 2, gain: 0.6 });
    }
  });

  // Une note finale signale que c'est terminé et appelle la boucle suivante —
  // sauf si le dernier plan parle jusqu'au bout, où elle couperait la chute.
  if (duration > 1.5 && !porteSonPropre(clips[clips.length - 1])) {
    cues.push({ id: uid('sfx'), sfx: 'ding', time: Math.max(0, duration - 0.45), gain: 0.8 });
  }

  return { clips, captions, cues };
}

/** Applique le montage express à un projet, en conservant les rushes. */
export function applyAutoEdit(project: Project): Project {
  const { clips, captions, cues } = buildAutoEdit(project.assets);
  return {
    ...project,
    clips,
    captions,
    cues,
    cinema: { ...project.cinema, look: project.cinema.look === 'naturel' ? 'cinema' : project.cinema.look },
  };
}

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

/** En dessous, un plan n'a pas le temps d'être lu. */
const MIN_SHOT = 0.9;

/** Transitions alternées, pour éviter la monotonie d'un effet répété. */
const TRANSITION_CYCLE: TransitionKind[] = ['zoomPunch', 'whipPan', 'fade', 'slideUp', 'flash'];

/**
 * Bruitages de raccord, alternés eux aussi.
 *
 * Le même souffle répété à chaque coupe cesse d'être entendu au bout de trois
 * occurrences : c'est la variation qui maintient l'effet.
 */
const RACCORD_CYCLE: SfxId[] = ['boom', 'whoosh', 'punch', 'swipe', 'whoosh', 'subdrop'];

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
  const utilisables = Math.max(1, assets.filter((a) => a.duration > 0.2).length);
  const visee = keepWhole
    ? TARGET_SHOT
    : Math.max(MIN_SHOT, Math.min(TARGET_SHOT, DUREE_VISEE / utilisables));

  const clips = assets
    .map((asset, index) => cutFromAsset(asset, index, keepWhole, visee))
    .filter((clip): clip is Clip => clip !== null)
    // Le premier plan retenu doit porter les réglages d'ouverture, même si des
    // rushes trop courts ont été écartés en amont.
    .map((clip, index) => (index === 0 ? { ...clip, transition: 'cut' as const, motion: 'zoomIn' as const } : clip));

  if (clips.length === 0) return { clips: [], captions: [], cues: [] };

  const duration = totalDuration(clips);

  const captions: Caption[] = [
    {
      id: uid('cap'),
      text: PLACEHOLDER_HOOK,
      start: 0,
      end: Math.min(2.4, duration),
      style: 'punch',
      y: 0.28,
    },
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

  const cues: SoundCue[] = [];
  let cursor = 0;

  // Un impact sur la toute première image : le son fait partie de l'accroche
  // autant que le texte, et c'est lui qui fait lever les yeux.
  cues.push({ id: uid('sfx'), sfx: 'punch', time: 0.02, gain: 0.9 });

  clips.forEach((clip, index) => {
    const clipLength = (clip.outPoint - clip.inPoint) / clip.speed;

    if (index > 0) {
      cursor -= clip.transitionDuration;
      const at = Math.max(0, cursor);

      // Un raccord sur `pasBruitage` reçoit un souffle : c'est ce qui
      // transforme une succession de plans en rythme perçu. Les autres restent
      // nus, et c'est ce qui rend audibles ceux qui sonnent.
      if ((index - 1) % pasBruitage === 0) {
        cues.push({ id: uid('sfx'), sfx: RACCORD_CYCLE[(index - 1) % RACCORD_CYCLE.length], time: at, gain: 0.85 });

        /*
         * L'aspiration ne se pose que si le plan précédent est assez long pour
         * la porter. Sur des plans courts, une anticipation de 0,55 s tombe
         * avant la coupe **précédente** : elle n'annonce plus rien, elle brouille
         * ce qui vient de sonner.
         */
        if (at > 1.2) {
          cues.push({ id: uid('sfx'), sfx: 'reverse', time: at - 0.55, gain: 0.55 });
        }
      }
    }

    cursor += clipLength;

    // Un plan qui s'étire est le premier endroit où l'attention retombe : on y
    // pose une ponctuation à mi-parcours plutôt que de le laisser nu.
    if (clipLength > 3.2) {
      cues.push({ id: uid('sfx'), sfx: 'sparkle', time: cursor - clipLength / 2, gain: 0.6 });
    }
  });

  // Une note finale signale que c'est terminé et appelle la boucle suivante.
  if (duration > 1.5) {
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

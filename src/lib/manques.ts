import { HOOK_WINDOW, type Analysis } from './analysis.ts';
import { layoutClips, type PlacedClip } from './timeline.ts';
import type { Project } from './types.ts';

/**
 * Détection des manques d'un montage.
 *
 * Ce module répond à une seule question : **qu'est-ce qui manque à ce montage
 * pour tenir debout ?** Il rend une liste de besoins — une fenêtre, un
 * problème, ce que devrait apporter l'élément absent — et il s'arrête là.
 *
 * Il ne sait pas qui comble. Ni fournisseur, ni modèle, ni tarif, ni requête :
 * aucun nom de service n'apparaît dans ce fichier et aucun n'y a sa place. La
 * raison n'est pas esthétique. Le moteur de montage d'Amorce **ne connaît pas
 * le réseau** (`CLAUDE.md §4`), et c'est l'invariant qui porte la promesse du
 * produit ; une détection qui saurait appeler quelqu'un serait le premier pas
 * qui la casse. Séparés, le besoin s'éprouve hors ligne, en bibliothèque
 * standard, et il reste vrai le jour où la façon de le combler change.
 *
 * Il ne remplace rien non plus. Comme `autoFinish`, il ajoute : un manque est
 * toujours un endroit où il n'y a **rien**, jamais un endroit où il y a
 * quelque chose de moyen. Juger ce qui existe est le travail d'`analyzeProject`.
 *
 * ## Ce qui décide qu'un trou est un manque
 *
 * Le principe directeur du projet est de toujours prendre l'option la moins
 * chère **à qualité égale**. Appliqué ici, il ne porte pas sur le choix d'un
 * fournisseur — il porte plus haut : *fabriquer un plan pour boucher un trou
 * qu'une coupe, un texte ou un bruitage bouchait gratuitement est de l'argent
 * dépensé contre un défaut qui ne coûtait rien.*
 *
 * Chaque détecteur épuise donc les remèdes gratuits avant de déclarer un
 * besoin. Tant qu'un rush déposé dort sans être monté, aucun trou ne justifie
 * d'en fabriquer un : la matière est déjà sur l'appareil.
 *
 * ## Le creux de tension ne sert pas de déclencheur, et c'est mesuré
 *
 * La première rédaction de ce module déclarait un manque de matière sur un
 * creux de `findSlumps` dont la fenêtre portait déjà un texte et un bruitage —
 * l'idée étant que les calques gratuits avaient été essayés. **Ce détecteur ne
 * pouvait jamais se déclencher**, et un test l'a montré avant la première
 * fusion : dans `tensionCurve`, un sous-titre affiché apporte 0,2 par-dessus le
 * bruit de fond de 0,12, soit 0,32, quand le plancher d'un creux est à 0,28. Un
 * texte à l'écran interdit donc le creux. « Creux » et « fenêtre habillée »
 * s'excluent par construction, et leur conjonction est l'ensemble vide.
 *
 * Ce qui décide n'est pas la courbe, c'est **l'image**. Un plan qui ne change
 * pas et qui dure ne se rattrape ni en coupant — sur un contenu immobile, une
 * coupe ne se lit pas comme une coupe mais comme un zoom, et une suite de ces
 * coupes-là fatigue au lieu de relancer (`tiktok/notice-de-montage.md`, sixième
 * règle) — ni en empilant des calques, qui remontent la note sans rien changer
 * à ce qu'on regarde. C'est le seul cas où la matière manque vraiment alors
 * qu'il reste des secondes à couper, et c'est celui-là qu'on détecte.
 *
 * Le creux reste utile, mais comme **témoin** : quand il recouvre le plan, il
 * est reporté dans la mesure. Il ne conditionne rien.
 */

/** Ce qu'il faudrait poser là où il n'y a rien. */
export type NatureDuManque =
  /** De la matière visuelle à insérer dans le montage — un plan, une image. */
  | 'matiere'
  /** De quoi ouvrir : le tout premier écran, celui qui décide du reste. */
  | 'accroche'
  /** L'image qui représente la vidéo avant qu'on la lance. */
  | 'miniature';

export type Manque = {
  id: string;
  nature: NatureDuManque;
  /**
   * La fenêtre du montage concernée, en secondes.
   *
   * `null` pour ce qui ne vit pas sur la timeline — une miniature n'a pas
   * d'instant.
   */
  fenetre: { debut: number; fin: number } | null;
  /** Ce qui ne va pas, en une phrase, du point de vue de la personne. */
  probleme: string;
  /**
   * Ce que l'élément absent doit apporter — jamais comment le fabriquer.
   *
   * C'est la frontière du module : on décrit un besoin, pas une commande.
   */
  attendu: string;
  /** Ce qui a été mesuré et qui déclenche le besoin. Toujours des nombres. */
  mesure: string;
};

/**
 * En dessous, l'ouverture ne retient personne.
 *
 * `scoreHook` cumule quatre apports qui valent 0,4 / 0,3 / 0,15 / 0,15. À 0,45
 * il en manque au moins deux, dont toujours l'un des deux gros : ni texte tôt,
 * ni première coupe rapide. C'est le seuil en dessous duquel aucun réglage ne
 * rattrape l'ouverture — il faut y poser quelque chose qui n'existe pas.
 */
export const HOOK_FAIBLE = 0.45;

/**
 * Durée au-delà de laquelle un plan qui ne change pas se met à coûter.
 *
 * Ce n'est pas un nombre choisi ici : `analyzeProject` note la longueur du plus
 * long plan par `band(longestShot, 0, 3.5, 0, 9)` — plein jusqu'à 3,5 s, puis
 * décroissant jusqu'à zéro à neuf. 3,5 s est donc la borne que le dépôt a déjà
 * mesurée pour « ce plan traîne », et la reprendre évite d'en inventer une
 * seconde qui divergerait à la première retouche.
 */
export const PLAN_QUI_DORT = 3.5;

/**
 * Durée à partir de laquelle un montage mérite sa miniature.
 *
 * En dessous, il n'est pas publiable : `format` note zéro sous deux secondes,
 * et une vidéo qu'on ne publie pas n'a pas besoin d'une image de couverture.
 */
export const DUREE_PUBLIABLE = 7;

/** Le plan qui couvre cet instant, s'il existe. */
function planA(places: PlacedClip[], instant: number): PlacedClip | undefined {
  return places.find((p) => instant >= p.start && instant < p.end);
}

/**
 * Les rushes déposés que le montage n'utilise pas.
 *
 * C'est le remède le moins cher de tous : la matière est déjà sur l'appareil,
 * elle ne coûte ni un centime ni un aller-retour réseau. Tant qu'il en reste
 * un, aucun trou ne justifie d'en fabriquer.
 */
export function matiereInutilisee(project: Project): string[] {
  const employes = new Set(project.clips.map((c) => c.assetId));
  return project.assets.filter((a) => !employes.has(a.id)).map((a) => a.id);
}

/** Le creux de tension qui recouvre ce plan, s'il y en a un. */
function creuxSur(analysis: Analysis, place: PlacedClip) {
  return analysis.slumps.find((s) => s.start < place.end && s.end > place.start);
}

/**
 * Ce qui manque à ce montage, du plus coûteux à laisser au moins coûteux.
 *
 * Fonction pure : mêmes entrées, même sortie, aucun effet de bord, aucun accès
 * au réseau ni au disque. Elle prend l'analyse plutôt que de la refaire —
 * `CLAUDE.md §6` : une mesure refaite deux fois est une mesure payée deux fois.
 */
export function detecterManques(project: Project, analysis: Analysis): Manque[] {
  if (analysis.shotCount === 0 || analysis.duration <= 0) return [];

  const manques: Manque[] = [];
  const places = layoutClips(project.clips);
  const resteDeLaMatiere = matiereInutilisee(project).length > 0;

  // 1. L'accroche. Elle passe en premier parce que c'est le seul manque dont
  //    le coût est le montage entier : ce qui n'est pas vu n'a pas de note.
  const hook = analysis.criteria.find((c) => c.id === 'hook');
  const premier = places[0];
  if (hook && hook.score < HOOK_FAIBLE && premier.clip.motion === 'none' && !resteDeLaMatiere) {
    manques.push({
      id: 'accroche',
      nature: 'accroche',
      fenetre: { debut: 0, fin: Math.min(HOOK_WINDOW, analysis.duration) },
      probleme: "L'ouverture ne retient pas : rien ne bouge et rien ne se dit dans les trois premières secondes.",
      attendu: 'Un premier écran qui donne envie de rester — une image forte, ou un carton qui pose la promesse.',
      mesure: `hook ${hook.score.toFixed(2)} sur 1 · premier plan fixe · première coupe à ${(places[1]?.start ?? analysis.duration).toFixed(2)} s`,
    });
  }

  // 2. Les plans qui dorment. Un plan immobile qui dure est le seul endroit où
  //    la matière manque pour de bon : ni la coupe ni les calques n'y peuvent
  //    quelque chose, seule une image qui change relance.
  if (!resteDeLaMatiere) {
    for (const place of places) {
      if (place.clip.motion !== 'none') continue;
      if (place.duration <= PLAN_QUI_DORT) continue;

      const creux = creuxSur(analysis, place);
      manques.push({
        id: `plan-${place.start.toFixed(2)}`,
        nature: 'matiere',
        fenetre: { debut: place.start + PLAN_QUI_DORT, fin: place.end },
        probleme: `Le même cadre tient ${place.duration.toFixed(1)} s sans que rien n'y change : couper davantage ne ferait qu'un zoom, et un calque de plus ne changerait pas ce qu'on regarde.`,
        attendu: "De la matière visuelle qui change l'image sur la fin du plan.",
        mesure:
          `plan ${place.start.toFixed(2)} → ${place.end.toFixed(2)} s, fixe` +
          (creux ? ` · creux de tension de ${creux.duration.toFixed(1)} s dessus` : ''),
      });
    }
  }

  // 3. La miniature. Elle ne vit pas sur la timeline et ne dépend d'aucune
  //    mesure de montage : dès qu'une vidéo est publiable, elle en veut une, et
  //    rien dans le projet ne peut en tenir lieu — un rush n'est pas une
  //    couverture.
  if (analysis.duration >= DUREE_PUBLIABLE) {
    manques.push({
      id: 'miniature',
      nature: 'miniature',
      fenetre: null,
      probleme: "La vidéo n'a pas d'image de couverture : c'est elle qui décide du clic, avant que la première seconde existe.",
      attendu: 'Une image verticale qui tient à la taille d’une vignette et dit de quoi il s’agit sans lire un mot.',
      mesure: `${analysis.duration.toFixed(1)} s de montage · ${analysis.shotCount} plans`,
    });
  }

  return manques;
}

import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Titre } from './titre';

/**
 * AZNAROTH — EP02 · Les quatre sceaux.
 *
 * Le scénario vit dans `tiktok/feuilleton-ep02.md`, écrit avant les rushes.
 * Ce fichier n'en est que l'habillage : titres blancs et carton doré sur fond
 * NOIR, sans rush ni son.
 *
 * Le noir n'est pas un fond, c'est un canal alpha du pauvre : dans CapCut on
 * pose ce calque au-dessus des rushes et on lui met le mode de fusion
 * « Écran » (Screen). Le noir disparaît, le blanc et l'or restent. Retenu
 * plutôt qu'un vrai canal alpha parce que CapCut Android ouvre le H.264 sans
 * discuter, là où son support du WebM alpha est incertain.
 */

/**
 * ⚠ CES INSTANTS SONT ATTENDUS, PAS MESURÉS.
 *
 * `feuilleton-ep02.md` laisse ses instants entre crochets à dessein, et écrit
 * pourquoi : « un instant plausible écrit d'avance est un instant qu'on croira
 * mesuré dans trois semaines ». Les valeurs ci-dessous sont donc dérivées du
 * seul chiffre que l'EP01 ait mesuré — 3,04 syllabes par seconde — et de la
 * structure en trois actes. Elles servent à voir le montage tourner, pas à le
 * caler.
 *
 * Dès que la voix existe : relever ses trois passages à l'enveloppe, reporter
 * les instants dans `feuilleton-ep02.md`, puis ici. Le nom de cette constante
 * dit son état ; le renommer sans mesurer serait le seul vrai défaut possible.
 */
export const FRISE_ATTENDUE = [
  // Acte 1 — l'après. Le titan de dos, la caméra glisse vers l'horizon.
  // « Count. » — 1 syllabe, ≈ 0,3 s de parole, tenue jusqu'à la lecture.
  { texte: 'COUNT', debut: 30, duree: 36 },

  // Acte 2 — la lueur. Un second sceau se fend, petit dans le cadre.
  // « Zero-Four, seal broken. » — 6 syllabes, ≈ 2,0 s, plus 0,3 s de queue.
  { texte: 'ZERO-FOUR — SEAL BROKEN', debut: 174, duree: 69 },

  // Acte 3 — le champ large, cinq marques sur l'horizon.
  // La carte entre 0,20 s APRÈS la coupe (image 300 → 306) : une ligne qui
  // devance la parole se lit mal, et l'image de la révélation s'appartient une
  // demi-seconde. Elle ne se scinde jamais — « THE SHADOW TITANS » seul
  // livrerait le « s » de la révélation avant que l'image ne le montre.
  { texte: 'THE SHADOW TITANS ARE WAKING', debut: 306, duree: 87 },
] as const;

/**
 * Le carton de titre ne fait PAS partie de ce calque, et c'est une correction
 * qui vient d'un composite regardé.
 *
 * En mode de fusion « Écran », le noir devient transparent — c'est tout
 * l'intérêt. Mais cela vaut aussi pour le fond du carton : posé en Écran sur
 * un plan clair, l'or se dilue dans l'image et le titre disparaît. Vérifié sur
 * un dragon en contre-jour : illisible.
 *
 * Le carton se rend donc à part (`npm run build:carton`) et se pose dans
 * CapCut comme un **clip normal**, en fusion Normale, après le dernier rush.
 * Il est opaque, il n'a rien à laisser passer.
 *
 * Sa place dans la frise reste ici pour mémoire : il commence à l'image 417,
 * après 0,8 s de vide — la tête du titan qui tourne. À l'EP01, les 3,1 s sans
 * texte sont ce qui fait exister le titre ; ici l'image occupe ce vide, raison
 * de plus pour n'y rien écrire.
 */
export const CARTON = { debut: 417, duree: 48 };

/** 465 images = 15,5 s à 30 i/s — la durée visée par le feuilleton, celle de l'EP01. */
export const DUREE_TOTALE = 465;

export const Ep02: React.FC = () => {
  return (
    <AbsoluteFill className="bg-black">
      {FRISE_ATTENDUE.map((t) => (
        <Sequence key={t.debut} from={t.debut} durationInFrames={t.duree}>
          <Titre texte={t.texte} duree={t.duree} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

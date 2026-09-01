import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Titre } from './titre';
import { CartonFin } from './carton-fin';

/**
 * CYBER HYDRA TITAN — épisode 2.
 *
 * L'habillage seul : titres blancs et carton doré sur fond NOIR, sans rush.
 * Le noir n'est pas un fond, c'est un canal alpha du pauvre : dans CapCut on
 * pose ce calque sur les rushes et on lui met le mode de fusion « Écran »
 * (Screen). Le noir disparaît, le blanc et l'or restent.
 *
 * Ce chemin a été retenu plutôt qu'un vrai canal alpha parce que CapCut
 * Android ouvre le H.264 sans discuter, là où son support du WebM alpha et
 * des séquences PNG est incertain.
 */

/** Une frise éditable : c'est le seul endroit à toucher pour changer l'épisode. */
export const FRISE = [
  { texte: 'CYBER HYDRA TITAN', debut: 0, duree: 75 },
  { texte: 'PROTOCOLE ROMPU', debut: 120, duree: 70 },
  { texte: 'ELLE APPREND DE CHAQUE TÊTE COUPÉE', debut: 260, duree: 90 },
] as const;

export const FIN = { debut: 470, duree: 62 };

/** 532 images = 17,73 s à 30 i/s — la durée de l'épisode 1, prise comme repère. */
export const DUREE_TOTALE = FIN.debut + FIN.duree;

export const Ep02: React.FC = () => {
  return (
    <AbsoluteFill className="bg-black">
      {FRISE.map((t) => (
        <Sequence key={t.debut} from={t.debut} durationInFrames={t.duree}>
          <Titre texte={t.texte} duree={t.duree} />
        </Sequence>
      ))}

      <Sequence from={FIN.debut} durationInFrames={FIN.duree}>
        <CartonFin titre="AZNAROTH" sousTitre="Épisode 2" duree={FIN.duree} />
      </Sequence>
    </AbsoluteFill>
  );
};

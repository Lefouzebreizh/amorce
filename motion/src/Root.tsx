import React from 'react';
import { Composition } from 'remotion';
import './style.css';
import { Ep02, DUREE_TOTALE } from './ep02';
import { CartonFin } from './carton-fin';

/**
 * 1080 × 1920 à 30 images/seconde, et ce n'est pas négociable :
 * ce sont les valeurs que le protocole de publication contrôle sur le fichier
 * exporté. Rendre à 24 ou 60 obligerait CapCut à rééchantillonner.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Ep02"
        component={Ep02}
        durationInFrames={DUREE_TOTALE}
        fps={30}
        width={1080}
        height={1920}
      />

      {/* Le carton seul, pour le réexporter sans refaire tout l'épisode. */}
      <Composition
        id="CartonFin"
        component={CartonFin}
        durationInFrames={48}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ titre: 'FAILLE ZÉRO-CINQ', sousTitre: 'EP02 · Les quatre sceaux', duree: 48 }}
      />
    </>
  );
};

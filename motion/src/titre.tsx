import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { ZoneSure } from './zone-sure';

/**
 * Un titre de l'épisode, animé image par image.
 *
 * Tout est calculé depuis `useCurrentFrame()` : aucune transition CSS, qui
 * dépendrait de l'horloge du navigateur et sauterait des images au rendu.
 * Remotion fabrique chaque image isolément — une animation CSS ne saurait
 * même pas où elle en est.
 */
export const Titre: React.FC<{
  texte: string;
  /** Durée totale à l'écran, en images. */
  duree: number;
}> = ({ texte, duree }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ENTRÉE — un ressort, pas une rampe. L'œil lit une rampe linéaire comme
  // mécanique ; un ressort légèrement amorti se lit comme un geste.
  const entree = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 130 },
    durationInFrames: 12,
  });

  // SORTIE — 8 images de fondu, calées sur la fin. Une coupe nette sur un
  // texte donne un clignotement qu'on remarque sans savoir le nommer.
  const sortie = interpolate(frame, [duree - 8, duree], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  const opacite = entree * sortie;
  // Le titre monte de 26 px en arrivant : un déplacement court suffit, et
  // au-delà le texte quitte sa place avant que l'œil l'ait accroché.
  const montee = interpolate(entree, [0, 1], [26, 0]);

  return (
    <ZoneSure>
      <h1
        className="w-full text-center font-black uppercase text-white"
        style={{
          opacity: opacite,
          transform: `translateY(${montee}px)`,
          // 82 px : lisible en vignette, et deux lignes tiennent largement
          // dans les 33 % de hauteur que la zone sûre laisse.
          fontSize: 82,
          lineHeight: 1.12,
          letterSpacing: '0.01em',
          // `balance` répartit les mots entre les lignes plutôt que de laisser
          // un mot seul en bas. Sans lui, « CYBER HYDRA / TITAN » devient
          // « CYBER HYDRA TITAN » sur une ligne et une veuve sur la suivante.
          textWrap: 'balance',
          // Le halo détache le texte d'un fond chargé — un rush de volcan
          // passe du noir au blanc en quelques pixels.
          textShadow:
            '0 0 24px rgba(0,0,0,.95), 0 0 8px rgba(0,0,0,.9), 0 4px 18px rgba(0,0,0,.8)',
          fontFamily:
            'Inter, "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif',
        }}
      >
        {texte}
      </h1>
    </ZoneSure>
  );
};

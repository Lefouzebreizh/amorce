import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { CARTON_LARGEUR_PCT } from './zone';

/**
 * Le carton de fin — doré sur noir.
 *
 * La direction artistique de la série a été tranchée le 31/08/2026 : on GARDE
 * le cyan des rushes, parce que c'est l'éclairage des plans et qu'il ne se
 * repeint pas. L'or ne vit donc que sur le carton, où il n'y a pas de rush à
 * contredire — et c'est là que l'affiche est citée.
 */
export const CartonFin: React.FC<{
  titre: string;
  sousTitre?: string;
  duree: number;
}> = ({ titre, sousTitre, duree }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const apparition = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 90 },
    durationInFrames: 18,
  });

  // Le trait doré se trace au lieu d'apparaître : un geste, pas un état.
  const trait = interpolate(frame, [6, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Une respiration très lente sur la lueur. 0,04 d'amplitude : en dessous on
  // ne la voit pas, au-dessus ça pulse — et le public visé sursaute.
  const souffle = 1 + 0.04 * Math.sin((frame / fps) * 1.6);

  const fondu = interpolate(frame, [duree - 10, duree], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const OR = '#E8B04B';

  return (
    <AbsoluteFill className="items-center justify-center bg-black" style={{ opacity: fondu }}>
      <div
        className="flex flex-col items-center"
        style={{ opacity: apparition, transform: `scale(${interpolate(apparition, [0, 1], [0.94, 1])})` }}
      >
        <h2
          className="text-center font-black uppercase"
          style={{
            color: OR,
            fontSize: 96,
            lineHeight: 1.06,
            letterSpacing: '0.04em',
            // Même LARGEUR que la zone sûre, mais centrée sur le cadre là où
            // la zone sûre ne l'est pas (22 → 88 %, centre à 55 %). Le carton
            // tient donc 17 → 83 % : son bord gauche entre de 5 points dans la
            // bande des boutons Facebook. Assumé — le carton est une carte de
            // fin plein écran, pas un titre posé sur un rush — et `tests/
            // zone-sure.test.mts` fige l'écart pour qu'il ne dérive pas seul.
            maxWidth: 1080 * (CARTON_LARGEUR_PCT / 100),
            textWrap: 'balance',
            textShadow: `0 0 ${40 * souffle}px rgba(232,176,75,.45)`,
            fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif',
          }}
        >
          {titre}
        </h2>

        <div
          className="mt-10 h-[3px] origin-center"
          style={{ width: 360 * trait, background: OR, boxShadow: `0 0 18px ${OR}` }}
        />

        {sousTitre ? (
          <p
            className="mt-10 text-center uppercase"
            style={{
              color: 'rgba(232,176,75,.78)',
              fontSize: 34,
              letterSpacing: '0.34em',
              opacity: interpolate(frame, [20, 34], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
              fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif',
            }}
          >
            {sousTitre}
          </p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

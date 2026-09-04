import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

/**
 * TEST — pas un habillage de production comme `ep02.tsx`.
 *
 * Question posée : Remotion (code, procédural) peut-il produire seul
 * l'ouverture « rune qui s'active → vortex qui s'ouvre » d'Aznaroth, ou
 * faut-il un outil de génération vidéo IA (Higgsfield) dès qu'il s'agit de
 * matière organique/magique ? Réponse mesurée dans le rapport qui accompagne
 * ce fichier, pas ici — ce composant est la moitié « code » de la comparaison.
 *
 * Volontairement sans créature ni druide : c'est ce que du SVG/CSS animé
 * image par image sait faire — de la géométrie, de la lumière, du mouvement
 * de caméra. Un corps organique crédible n'est pas dans ce registre, et
 * personne ne le prétend ici.
 */

const DUREE = 150; // 5 s à 30 i/s — la durée d'une ouverture, pas d'un plan complet.

const CENTRE_X = 540;
const CENTRE_Y = 860; // un peu au-dessus du centre : laisse le vortex grandir vers le bas

const AMBRE = '#ff9d4d';
const AMBRE_VIF = '#ffcf8a';
const VIOLET = '#7b5cff';

/** Une marque runique : un segment qui s'embrase à son tour de la rotation. */
const Marque: React.FC<{ angleDeg: number; rayon: number; frame: number; debut: number }> = ({
  angleDeg,
  rayon,
  frame,
  debut,
}) => {
  const a = (angleDeg * Math.PI) / 180;
  const x1 = CENTRE_X + Math.cos(a) * (rayon - 22);
  const y1 = CENTRE_Y + Math.sin(a) * (rayon - 22);
  const x2 = CENTRE_X + Math.cos(a) * (rayon + 22);
  const y2 = CENTRE_Y + Math.sin(a) * (rayon + 22);

  const allume = spring({ frame: frame - debut, fps: 30, config: { damping: 12, stiffness: 120 } });
  const opacite = interpolate(allume, [0, 1], [0, 1]);

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={AMBRE_VIF}
      strokeWidth={7}
      strokeLinecap="round"
      opacity={opacite}
      style={{ filter: `drop-shadow(0 0 ${10 * opacite}px ${AMBRE})` }}
    />
  );
};

/** Une fissure qui part du centre — le sol qui cède avant que le vortex ne perce. */
const Fissure: React.FC<{ angleDeg: number; longueur: number; frame: number; debut: number }> = ({
  angleDeg,
  longueur,
  frame,
  debut,
}) => {
  const a = (angleDeg * Math.PI) / 180;
  const jitter = Math.sin(angleDeg * 12.9) * 14; // une fissure n'est jamais droite
  const xMid = CENTRE_X + Math.cos(a) * longueur * 0.55 + jitter;
  const yMid = CENTRE_Y + Math.sin(a) * longueur * 0.55 - jitter;
  const xEnd = CENTRE_X + Math.cos(a) * longueur;
  const yEnd = CENTRE_Y + Math.sin(a) * longueur;

  const trace = interpolate(frame, [debut, debut + 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  // longueur totale approx (segment brisé) — sert au dasharray
  const d = `M ${CENTRE_X} ${CENTRE_Y} L ${xMid} ${yMid} L ${xEnd} ${yEnd}`;

  return (
    <path
      d={d}
      fill="none"
      stroke={AMBRE}
      strokeWidth={3}
      strokeLinecap="round"
      opacity={trace}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - trace}
      style={{ filter: `drop-shadow(0 0 6px ${AMBRE})` }}
    />
  );
};

const Particule: React.FC<{ index: number; frame: number }> = ({ index, frame }) => {
  const angle0 = (index / 14) * 360;
  const vitesse = 2.4 + (index % 5) * 0.35;
  const rayonDepart = 420 + (index % 4) * 60;
  const debut = 95 + index * 2;

  const t = Math.max(0, frame - debut);
  // spirale vers le centre : le rayon décroît, l'angle avance — l'aspiration du vortex
  const rayon = Math.max(30, rayonDepart - t * vitesse);
  const angle = angle0 + t * (4 + (index % 3));
  const a = (angle * Math.PI) / 180;
  const x = CENTRE_X + Math.cos(a) * rayon;
  const y = CENTRE_Y + Math.sin(a) * rayon * 0.7; // vortex légèrement aplati, effet de profondeur

  const opacite = interpolate(t, [0, 15, 140], [0, 1, 0], { extrapolateRight: 'clamp' });
  const taille = 4 + (index % 3) * 2;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - taille / 2,
        top: y - taille / 2,
        width: taille,
        height: taille,
        borderRadius: '50%',
        background: index % 3 === 0 ? VIOLET : AMBRE_VIF,
        opacity: opacite,
        boxShadow: `0 0 ${taille * 2}px ${index % 3 === 0 ? VIOLET : AMBRE}`,
      }}
    />
  );
};

export const RuneVortexTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Mouvement dès la première image, contrainte de rétention : un lent
  // travelling avant plutôt qu'un cadre figé pendant que la rune s'allume.
  const pousse = interpolate(frame, [0, DUREE], [1, 1.1], { easing: Easing.inOut(Easing.quad) });

  // L'anneau se dessine en deux passes décalées (extérieur puis intérieur).
  const anneauExt = interpolate(frame, [0, 34], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const anneauInt = interpolate(frame, [10, 46], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  const rayonExt = 190;
  const perimExt = 2 * Math.PI * rayonExt;
  const rayonInt = 150;
  const perimInt = 2 * Math.PI * rayonInt;

  // Glyphe central : un losange qui pulse une fois allumé.
  const glyphe = spring({ frame: frame - 40, fps: 30, config: { damping: 10, stiffness: 90 } });
  const pulsation = 1 + Math.sin(frame / 5) * 0.04 * Math.min(1, Math.max(0, (frame - 55) / 20));

  // Le vortex : naît au sol vers l'image 90, grandit en ressort.
  const vortex = spring({ frame: frame - 92, fps: 30, config: { damping: 15, stiffness: 60 }, durationInFrames: 55 });
  const vortexTaille = interpolate(vortex, [0, 1], [0, 560]);
  const rotation = frame * 3.4;

  // Lueur globale : la scène s'éclaire à mesure que la rune puis le vortex prennent.
  const lueurRune = interpolate(frame, [15, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lueurVortex = interpolate(frame, [90, 140], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const marques = Array.from({ length: 8 }, (_, i) => i);
  const fissures = Array.from({ length: 10 }, (_, i) => i);
  const particules = Array.from({ length: 14 }, (_, i) => i);

  return (
    <AbsoluteFill style={{ background: '#050507', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${pousse})`,
          transformOrigin: '50% 50%',
        }}
      >
        {/* Sol de pierre — dégradés seulement, aucun asset externe */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(120% 90% at 50% 20%, #14151a 0%, #0a0a0c 55%, #050507 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.35,
            background:
              'repeating-linear-gradient(115deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 2px, transparent 2px, transparent 26px)',
          }}
        />

        {/* Lueur ambiante qui monte avec l'activation */}
        <div
          style={{
            position: 'absolute',
            left: CENTRE_X - 500,
            top: CENTRE_Y - 500,
            width: 1000,
            height: 1000,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,157,77,${0.22 * lueurRune}) 0%, rgba(123,92,255,${0.12 * lueurVortex}) 45%, transparent 70%)`,
            filter: 'blur(6px)',
          }}
        />

        {/* Fissures au sol */}
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
          {fissures.map((i) => (
            <Fissure key={i} angleDeg={(i / fissures.length) * 360 + 11} longueur={230 + (i % 3) * 40} frame={frame} debut={58 + i * 3} />
          ))}
        </svg>

        {/* La rune */}
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
          <circle
            cx={CENTRE_X}
            cy={CENTRE_Y}
            r={rayonExt}
            fill="none"
            stroke={AMBRE}
            strokeWidth={5}
            strokeDasharray={perimExt}
            strokeDashoffset={perimExt * (1 - anneauExt)}
            opacity={0.55 + 0.45 * anneauExt}
            style={{ filter: `drop-shadow(0 0 ${14 * lueurRune}px ${AMBRE})` }}
          />
          <circle
            cx={CENTRE_X}
            cy={CENTRE_Y}
            r={rayonInt}
            fill="none"
            stroke={AMBRE_VIF}
            strokeWidth={3}
            strokeDasharray={perimInt}
            strokeDashoffset={-perimInt * (1 - anneauInt)}
            opacity={0.5 + 0.5 * anneauInt}
            style={{ filter: `drop-shadow(0 0 ${10 * lueurRune}px ${AMBRE_VIF})` }}
          />
          {marques.map((i) => (
            <Marque key={i} angleDeg={(i / marques.length) * 360} rayon={rayonExt} frame={frame} debut={18 + i * 3} />
          ))}
          <g
            transform={`translate(${CENTRE_X} ${CENTRE_Y}) scale(${0.4 + glyphe * 0.6 * pulsation}) rotate(45)`}
            opacity={glyphe}
          >
            <rect x={-46} y={-46} width={92} height={92} fill="none" stroke={AMBRE_VIF} strokeWidth={6}
              style={{ filter: `drop-shadow(0 0 ${16 * glyphe}px ${AMBRE_VIF})` }} />
          </g>
        </svg>

        {/* Le vortex qui s'ouvre au sol */}
        {vortexTaille > 2 && (
          <div
            style={{
              position: 'absolute',
              left: CENTRE_X - vortexTaille / 2,
              top: CENTRE_Y - vortexTaille * 0.32,
              width: vortexTaille,
              height: vortexTaille * 0.64,
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: `0 0 ${80 * vortex}px ${20 * vortex}px rgba(123,92,255,${0.35 * vortex})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: -vortexTaille * 0.3,
                background: `conic-gradient(from ${rotation}deg, ${VIOLET}, ${AMBRE} 25%, #1a0a2e 50%, ${AMBRE_VIF} 75%, ${VIOLET})`,
                filter: 'blur(2px)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: '18%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.85) 60%, transparent 100%)',
              }}
            />
          </div>
        )}

        {/* Particules aspirées vers le vortex */}
        {particules.map((i) => (
          <Particule key={i} index={i} frame={frame} />
        ))}
      </div>

      {/* Vignette cinéma — fixe, hors du push-in */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 90% at 50% 45%, transparent 45%, rgba(0,0,0,0.65) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export const DUREE_RUNE_VORTEX = DUREE;

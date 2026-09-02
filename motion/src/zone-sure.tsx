import React from 'react';
import { ZONE } from './zone';

// Les bornes vivent dans `zone.ts`, sans JSX, pour qu'un test puisse les lire.
// Réexportées ici : `ZONE` s'importait depuis ce fichier, et déplacer une
// constante sans laisser son ancien chemin casse les appelants en silence.
export { ZONE };

/**
 * Le défaut que ce composant rend impossible.
 *
 * Sur l'épisode 1 publié, deux titres au même endroit, à la même police :
 * « RIFT ZERO FIVE » tenait de 26,9 % à 70,3 % — dégagé. « THE SHADOW TITAN
 * AWAKENS », plus long, avait été ÉTIRÉ d'un bord à l'autre pour tenir sur
 * une ligne : 9,8 % à 94,7 %. Mangé à gauche par Facebook, au ras du bord à
 * droite.
 *
 * La parade n'est pas de rétrécir la police quand le texte est long — c'est
 * de FIXER LA BOÎTE et de laisser le texte passer à la ligne. Un titre trop
 * long descend alors d'une ligne au lieu de sortir du cadre, et la hauteur
 * disponible (12 → 45 %) est bien assez grande pour l'accueillir : elle n'est
 * jamais le facteur limitant, la largeur l'est toujours.
 */
export const ZoneSure: React.FC<{
  children: React.ReactNode;
  /** Affiche le cadre de la zone — pour vérifier dans le studio, jamais au rendu. */
  debug?: boolean;
}> = ({ children, debug = false }) => {
  return (
    <div
      className="absolute flex flex-col items-center justify-start"
      style={{
        left: `${ZONE.gauchePct}%`,
        width: `${ZONE.droitePct - ZONE.gauchePct}%`,
        top: `${ZONE.hautPct}%`,
        height: `${ZONE.basPct - ZONE.hautPct}%`,
        outline: debug ? '4px solid rgba(255,0,0,.55)' : undefined,
      }}
    >
      {children}
    </div>
  );
};

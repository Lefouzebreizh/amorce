import React from 'react';

/**
 * La zone sûre d'une vidéo verticale, et la seule raison d'être de ce projet.
 *
 * Une vidéo 9:16 n'est jamais vue en plein cadre : l'habillage de la
 * plateforme en mange les bords, et ce n'est pas le même sur les trois. C'est
 * leur INTERSECTION qui décide, jamais la plus permissive — une même vidéo
 * part sur TikTok, Instagram et Facebook.
 *
 * Les bornes ci-dessous sont relevées sur le terrain de référence (Redmi
 * Note 12 Plus), jamais déduites des chartes des plateformes, qui ne disent
 * rien de la barre système ni des bulles de profil.
 */
export const ZONE = {
  /** 12 % : sous cette ligne on passe derrière la barre système de Facebook. */
  hautPct: 12,
  /** 45 % : au-delà on entre dans la colonne de droite de TikTok. */
  basPct: 45,
  /** 22 % : les boutons de gauche de Facebook occupent 14 à 22 %. */
  gauchePct: 22,
  /** 88 % : au-delà on est au ras du bord, qu'un écran arrondi rogne. */
  droitePct: 88,
} as const;

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

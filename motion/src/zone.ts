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
 *
 * Ces valeurs vivent ici, dans un module SANS JSX, et non dans
 * `zone-sure.tsx` où elles étaient : `node --test` sait dépouiller les types
 * mais pas le JSX, si bien qu'un test ne pouvait pas les lire. Un invariant
 * que rien ne peut relire n'est pas un invariant, c'est une intention.
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
 * La largeur du carton de fin, en pourcentage du cadre.
 *
 * Elle vaut celle de la zone sûre — mais le carton, lui, est CENTRÉ sur le
 * cadre, là où la zone sûre ne l'est pas. Même largeur, position différente :
 * la constante est partagée pour que le test puisse confronter les deux au
 * lieu de recopier un nombre que personne ne remettrait à jour.
 */
export const CARTON_LARGEUR_PCT = ZONE.droitePct - ZONE.gauchePct;

/** Les bords d'une boîte de cette largeur, centrée sur le cadre. */
export const boiteCentree = (largeurPct: number) => ({
  gauchePct: (100 - largeurPct) / 2,
  droitePct: (100 + largeurPct) / 2,
});

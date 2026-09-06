/*
 * Les motifs de métier qui remplissent les cadres d'une démonstration.
 *
 * POURQUOI CE FICHIER EXISTE.
 *
 * Les trois cadres de `generer.mjs` portaient tous le même pictogramme
 * d'appareil photo. Sur une page livrée au client c'est juste : ils disent
 * « vos photos iront là ». Sur `exemple.html`, qui sert d'unique aperçu du
 * produit à un prospect, trois fois le même appareil photo se lit « il n'a
 * rien à montrer » — et c'est le seul bloc qu'un artisan regarde vraiment.
 *
 * CE QUE CES DESSINS N'ONT PAS LE DROIT D'ÊTRE.
 *
 * `generer.mjs` porte une règle, et elle gouverne tout ce fichier :
 *
 *     « Rien n'est fabriqué qui puisse passer pour un vrai chantier : le dépôt
 *       interdit le faux témoignage, et une image de synthèse présentée comme
 *       une réalisation en serait un. »
 *
 * Une jolie scène de toiture dans un bloc intitulé « Mes réalisations » serait
 * exactement ce faux témoignage. Donc : **trait schématique, jamais une
 * image**. Pas d'aplat qui imite une matière, pas de perspective, pas d'ombre
 * portée, pas de dégradé dans le sujet. Ce qu'on dessine se lit comme un
 * pictogramme au premier coup d'œil, et personne ne peut le prendre pour une
 * photo.
 *
 * Le cadre pointillé reste, pour la même raison qu'avant : c'est lui qui dit
 * « il manquera quelque chose ici ». Et la légende continue de dire
 * « emplacement d'une photo de chantier ». Le motif ne remplace pas la photo,
 * il dit de quel métier elle parlera.
 *
 * TROIS MOTIFS PAR MÉTIER, PAS UN RÉPÉTÉ.
 *
 * Les trois cadres portent déjà trois légendes différentes — « Avant / après »,
 * « Une finition », « Le chantier fini ». Un même dessin trois fois les
 * démentirait. Chaque métier a donc trois motifs qui suivent ces légendes :
 * la vue d'ensemble, le détail, l'ouvrage terminé.
 *
 * Tout est tracé dans une boîte de 400 × 300, en `stroke` de la teinte d'accent
 * du métier — jamais en `fill` de couleur pleine, qui ferait « image ».
 */

/*
 * Un métier inconnu ne prend pas un dessin au hasard.
 *
 * `null` renvoie le générateur à son pictogramme d'appareil photo, qui est le
 * bon défaut : il ne dit rien de faux sur un métier qu'on ne connaît pas.
 */
export const MOTIF_PAR_DEFAUT = null;

/*
 * Chaque entrée est le contenu interne d'un `<g>` déjà positionné et déjà
 * coloré par `generer.mjs`. Les motifs n'ont donc ni couleur ni épaisseur
 * écrites en dur : ils héritent de la charte du métier, comme le reste de la
 * page. C'est ce qui fait qu'un modèle « paysagiste » vert et un modèle
 * « serrurier » ambre ne se distinguent pas seulement par leur bandeau.
 */
const MOTIFS = {
  couvreur: [
    // Vue d'ensemble : deux pans de toit et leur faîtage.
    '<path d="M60 190 200 110 340 190"/><path d="M60 190h280"/><path d="M200 110v80"/>' +
      '<path d="M104 163h192M126 176h148"/>',
    /*
     * Détail : les rangs d'ardoises, en écailles.
     *
     * Le premier dessin était fait de lignes droites à joints décalés — c'est
     * un appareillage de briques, donc le motif du maçon. Deux métiers qui
     * partagent un dessin ne prouvent plus que la page est remise au métier,
     * ce qui est l'argument même de la galerie. L'écaille ne se confond avec
     * rien.
     */
    '<path d="M88 130q24-28 48 0q24-28 48 0q24-28 48 0q24-28 48 0q24-28 48 0"/>' +
      '<path d="M64 176q24-28 48 0q24-28 48 0q24-28 48 0q24-28 48 0q24-28 48 0"/>' +
      '<path d="M88 222q24-28 48 0q24-28 48 0q24-28 48 0q24-28 48 0q24-28 48 0"/>',
    /*
     * L'ouvrage fini : la gouttière, sa descente et ses colliers.
     *
     * Le premier dessin ajoutait une ligne à l'intérieur du chéneau et une
     * barre au pied de la descente : à la taille où le cadre l'affiche, ça se
     * lisait « table », pas « gouttière ». Le coude au pied de la
     * descente la nomme à lui seul ; le collier qu'on avait ajouté ensuite
     * croisait le tuyau et redonnait une croix.
     */
    '<path d="M76 118h248v42H76z"/><path d="M288 160v78l-30 26"/>',
  ],

  electricien: [
    // Vue d'ensemble : le tableau et ses rangées de disjoncteurs.
    '<path d="M110 96h180v148H110z"/><path d="M110 146h180M110 196h180"/>' +
      '<path d="M152 118v10M196 118v10M240 118v10M152 168v10M196 168v10M240 168v10"/>',
    // Détail : une prise murale.
    '<circle cx="200" cy="170" r="62"/><circle cx="176" cy="158" r="9"/>' +
      '<circle cx="224" cy="158" r="9"/><path d="M200 196v14"/>',
    // L'ouvrage fini : le circuit qui court et alimente un point.
    '<path d="M78 210h58l24-56 30 112 26-84 22 44h84"/><circle cx="322" cy="210" r="16"/>',
  ],

  macon: [
    // Vue d'ensemble : l'appareillage d'un mur, joints décalés.
    '<path d="M76 112h248v152H76z"/><path d="M76 150h248M76 188h248M76 226h248"/>' +
      '<path d="M158 112v38M240 112v38M117 150v38M199 150v38M281 150v38' +
      'M158 188v38M240 188v38M117 226v38M281 226v38"/>',
    // Détail : le fil à plomb, qui dit l'aplomb sans rien imiter.
    '<path d="M200 84v122"/><path d="M182 206h36l-18 34z"/><path d="M140 84h120"/>',
    // L'ouvrage fini : une ouverture avec son linteau et son seuil.
    '<path d="M92 244V128h216v116"/><path d="M84 128h232"/><path d="M84 244h232"/>' +
      '<path d="M148 244v-72h104v72"/>',
  ],

  serrurier: [
    // Vue d'ensemble : la porte et son point de fermeture.
    '<path d="M126 84h148v176H126z"/><circle cx="246" cy="172" r="9"/>' +
      '<path d="M126 122h148"/>',
    // Détail : le cylindre et son panneton.
    '<circle cx="200" cy="140" r="46"/><path d="M182 178h36l-8 74h-20z"/>' +
      '<circle cx="200" cy="140" r="14"/>',
    // L'ouvrage fini : le pêne engagé dans la gâche.
    '<path d="M96 128h116v88H96z"/><path d="M212 158h58v28h-58"/>' +
      '<path d="M288 112v120"/><path d="M270 158h18v28h-18"/>',
  ],

  paysagiste: [
    // Vue d'ensemble : une haie taillée et son alignement.
    '<path d="M76 226h248"/><path d="M96 226v-64h208v64"/>' +
      '<path d="M132 162v64M170 162v64M208 162v64M246 162v64M284 162v64"/>',
    // Détail : un arbre, tronc et ramure schématiques.
    '<path d="M200 252v-74"/><path d="M200 178l-44-40M200 178l44-40M200 142l-30-28M200 142l30-28"/>' +
      '<path d="M168 252h64"/>',
    // L'ouvrage fini : la bordure d'une allée et sa pelouse.
    '<path d="M72 196c72-34 184-34 256 0"/><path d="M72 232c72-34 184-34 256 0"/>' +
      '<path d="M104 152v20M148 140v22M192 134v24M236 140v22M280 152v20"/>',
  ],

  plombier: [
    // Vue d'ensemble : le réseau et ses coudes.
    '<path d="M78 132h94v96h150"/><path d="M172 132h150"/>' +
      '<circle cx="172" cy="132" r="12"/><circle cx="172" cy="228" r="12"/>',
    // Détail : un robinet et son bec.
    '<path d="M156 200h88v-44h-88z"/><path d="M200 156v-42h56v54"/>' +
      '<path d="M176 114h48"/><path d="M200 200v40"/>',
    // L'ouvrage fini : le raccord serré entre deux tubes.
    '<path d="M72 154h108v52H72z"/><path d="M220 154h108v52H220z"/>' +
      '<path d="M180 138h40v84h-40z"/><path d="M196 138v84M204 138v84"/>',
  ],
};

/*
 * `metier` vient d'un drapeau de ligne de commande, donc d'ailleurs. Un nom
 * inconnu ne casse rien et ne dessine rien de faux : on retombe sur l'appareil
 * photo. C'est la même règle que le domaine absent — la page reste complète,
 * elle perd un détail plutôt que d'inventer.
 */
export function motifsDuMetier(metier) {
  if (typeof metier !== 'string') return MOTIF_PAR_DEFAUT;
  const trouve = MOTIFS[metier.trim().toLowerCase()];
  return trouve ?? MOTIF_PAR_DEFAUT;
}

export const METIERS_CONNUS = Object.freeze(Object.keys(MOTIFS));

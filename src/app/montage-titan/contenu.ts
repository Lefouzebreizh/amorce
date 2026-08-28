/**
 * Tout ce qui se retouche sans ouvrir le code de la page.
 *
 * La page ne versionne aucun média — c'est un invariant du dépôt, et il tient
 * ici pour une raison très concrète : une vidéo de démonstration dans Git
 * alourdit chaque clone de tout le monde pour un fichier qui changera dix fois.
 * Les emplacements attendent donc une URL (R2, CDN TikTok, Vercel Blob, peu
 * importe). Tant qu'une URL est vide, la page affiche un cadre marqué à sa
 * place au lieu de casser : elle se déploie et se montre dès aujourd'hui.
 */

/** Adresses des médias. Vide = la page montre un emplacement, pas une erreur. */
export const MEDIA: { portrait: string; demo: string; demoAffiche: string } = {
  /** Portrait « Titan ». Vide → le portrait dessiné en SVG prend le relais. */
  portrait: '',
  /** La démo AZEROTH, 21,5 s, format 1080 × 1920. */
  demo: '',
  /** Image d'attente de la démo, affichée avant le premier octet de vidéo. */
  demoAffiche: '',
};

/** Les liens de paiement et de contact. `#` tant qu'ils ne sont pas créés. */
export const LIENS: { paiementSolo: string; paiementTrio: string; whatsapp: string } = {
  paiementSolo: '#',
  paiementTrio: '#',
  /** Format attendu : https://wa.me/33XXXXXXXXX */
  whatsapp: '#',
};

export type Comparatif = {
  readonly cle: string;
  readonly titre: string;
  readonly contexte: string;
  /** La prise telle qu'elle sort du téléphone. */
  readonly avant: string;
  /** La même, montée. */
  readonly apres: string;
};

/** Trois avant/après : cabine, chantier, atelier. */
export const COMPARATIFS: readonly Comparatif[] = [
  {
    cle: 'cabine',
    titre: 'Cabine',
    contexte: 'Pare-brise à 6 h du matin, téléphone calé sur le tableau de bord.',
    avant: '',
    apres: '',
  },
  {
    cle: 'chantier',
    titre: 'Chantier',
    contexte: 'Déchargement, poussière, lumière qui change toutes les deux secondes.',
    avant: '',
    apres: '',
  },
  {
    cle: 'atelier',
    titre: 'Atelier',
    contexte: 'Néon au plafond, mains dans le cambouis, une seule main pour filmer.',
    avant: '',
    apres: '',
  },
] as const;

export type Formule = {
  readonly cle: string;
  readonly nom: string;
  readonly videos: number;
  /** En euros, toutes taxes comprises. */
  readonly prix: number;
  readonly lien: string;
  readonly vedette: boolean;
  readonly inclus: readonly string[];
};

/**
 * Deux formules, et une seule mise en avant.
 *
 * Le prix unitaire de la formule à trois se déduit du reste : rien n'est écrit
 * deux fois, donc rien ne peut se contredire après une hausse de tarif.
 */
export const FORMULES: readonly Formule[] = [
  {
    cle: 'solo',
    nom: '1 vidéo Titan',
    videos: 1,
    prix: 49,
    lien: LIENS.paiementSolo,
    vedette: false,
    inclus: [
      'Un export 1080 × 1920, prêt à publier',
      'Le son remis d’aplomb — audible dans un casque comme dans un haut-parleur de téléphone',
      'L’effet explosion de Terre',
      'Le rugissement du Titan',
      'Sous-titres calés au mot',
    ],
  },
  {
    cle: 'trio',
    nom: '3 vidéos Titan',
    videos: 3,
    prix: 120,
    lien: LIENS.paiementTrio,
    vedette: true,
    inclus: [
      'Tout ce que contient la formule à une vidéo, trois fois',
      'Une même direction visuelle sur les trois — ça fait une série, pas trois coups',
      'Les trois rendues en 24 h',
    ],
  },
] as const;

/** Prix unitaire de référence : celui de la formule à une vidéo. */
export const PRIX_UNITAIRE = FORMULES[0].prix;

/** Ce qu’une formule fait économiser par rapport au même nombre à l’unité. */
export function economie(formule: Formule): number {
  return formule.videos * PRIX_UNITAIRE - formule.prix;
}

/**
 * Où mène un bouton d'achat, et ce qu'il dit.
 *
 * La règle du dépôt vaut ici comme pour la page artisan : **ce qui n'est pas
 * réglé disparaît au lieu d'afficher une valeur inventée**. Un bouton qui
 * pointe sur `#` est pire qu'un bouton absent — quelqu'un a décidé d'acheter,
 * a appuyé, et il ne s'est rien passé. C'est le seul défaut de cette page qui
 * coûte un client déjà convaincu.
 *
 * D'où l'ordre : le lien de paiement s'il existe, sinon WhatsApp — où une
 * commande se prend vraiment, message prérempli à l'appui — sinon rien du tout.
 * La page vend donc dès ce soir, avant même que Stripe existe.
 */
export function lienDAchat(formule: Formule): { href: string; libelle: string } | null {
  if (formule.lien && formule.lien !== '#') {
    return { href: formule.lien, libelle: 'Commander — 24 h' };
  }
  if (LIENS.whatsapp && LIENS.whatsapp !== '#') {
    const message = `Bonjour Erwann, je veux la formule « ${formule.nom} » à ${formule.prix} €.`;
    return {
      href: `${LIENS.whatsapp}?text=${encodeURIComponent(message)}`,
      libelle: 'Commander sur WhatsApp',
    };
  }
  return null;
}

/** Vrai quand WhatsApp est renseigné : sinon on n'affiche pas le lien. */
export const WHATSAPP_PRET = LIENS.whatsapp !== '' && LIENS.whatsapp !== '#';

/** Les trois étapes, dans l’ordre où elles se vivent. */
export const ETAPES = [
  {
    numero: 1,
    titre: 'Tu payes',
    detail: 'Carte bancaire, paiement sécurisé. Trente secondes, pas de compte à créer.',
  },
  {
    numero: 2,
    titre: 'Tu m’envoies ta vidéo',
    detail:
      'Sur WhatsApp, telle qu’elle est sortie du téléphone. Tremblante, mal cadrée, trop longue : c’est mon travail, pas le tien.',
  },
  {
    numero: 3,
    titre: 'Tu reçois la Titan',
    detail: 'En 24 h maximum, prête à publier. Pas satisfait, remboursé — sans discussion.',
  },
] as const;

/** Les chiffres, tels qu’ils sont. Facebook et TikTok ne se confondent pas. */
export const AUDIENCE = [
  { valeur: '48 000', quoi: 'membres sur Facebook', ou: 'La communauté, depuis des années.' },
  { valeur: '4 000', quoi: 'abonnés sur TikTok', ou: 'Le jeune, celui qui monte.' },
  { valeur: '365', quoi: 'jours, un épisode par jour', ou: 'Le feuilleton, publié sans en rater un.' },
] as const;

export type Temoignage = {
  readonly texte: string;
  readonly qui: string;
  /** D’où sort la citation : commentaire, message, capture. Jamais vide. */
  readonly source: string;
};

/**
 * Vide, et volontairement.
 *
 * Un témoignage inventé est la seule chose qui puisse coûter d’un coup la
 * confiance de quarante-huit mille personnes ; la page affiche donc trois
 * emplacements assumés plutôt que trois faux avis. Le premier client remplit
 * la première ligne, avec sa source.
 */
export const TEMOIGNAGES: readonly Temoignage[] = [];

/** Combien d’emplacements de témoignage la page dessine au total. */
export const EMPLACEMENTS_TEMOIGNAGES = 3;

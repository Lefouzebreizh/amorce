/*
 * Le modèle d'une commande TITAN, et les seules règles qui décident d'un prix.
 *
 * Tout ce fichier est **pur** : ni système de fichiers, ni réseau, ni date
 * implicite. C'est ce qui permet de l'éprouver sans rien installer, et surtout
 * de le faire tourner des deux côtés — le formulaire s'en sert pour afficher un
 * total, la route d'API s'en sert pour le recalculer.
 *
 * Et elle le recalcule vraiment, elle ne le lit pas. Un prix envoyé par le
 * navigateur est une valeur que n'importe qui peut réécrire avant l'envoi ;
 * un prix recalculé à partir des seules options cochées ne se négocie pas.
 */

export type IdentifiantModele = 'routier' | 'btp' | 'food' | 'beaute';

export type Modele = {
  readonly id: IdentifiantModele;
  readonly nom: string;
  readonly pourQui: string;
  readonly accroche: string;
  readonly emoji: string;
  /** Les deux teintes de la carte, en dégradé. */
  readonly teintes: readonly [string, string];
  readonly points: readonly string[];
};

export const MODELES: readonly Modele[] = [
  {
    id: 'routier',
    nom: 'TITAN ROUTIER',
    pourQui: 'Conducteurs, artisans du transport, formateurs',
    accroche: 'Dix outils IA taillés pour la route, sur une page qui charge en 4G.',
    emoji: '🚛',
    teintes: ['#f97316', '#facc15'],
    points: ['Les 10 IA du routier', 'Appel en un doigt', 'Lisible en cabine, plein soleil'],
  },
  {
    id: 'btp',
    nom: 'TITAN BTP',
    pourQui: 'Maçons, couvreurs, plaquistes, terrassiers',
    accroche: 'Tes chantiers en avant/après, et le devis qui tombe le soir même.',
    emoji: '🧱',
    teintes: ['#38bdf8', '#6366f1'],
    points: ['Galerie avant / après', 'Demande de devis', 'Zone d’intervention'],
  },
  {
    id: 'food',
    nom: 'TITAN FOOD',
    pourQui: 'Food trucks, traiteurs, petites cuisines',
    accroche: 'La carte du jour, la position du camion, et la commande qui suit.',
    emoji: '🍔',
    teintes: ['#f43f5e', '#fb923c'],
    points: ['Carte et prix', 'Position du jour', 'Commande par WhatsApp'],
  },
  {
    id: 'beaute',
    nom: 'TITAN BEAUTÉ',
    pourQui: 'Barbiers, coiffeurs, ongleries, instituts',
    accroche: 'Les avis, les photos, et la prise de rendez-vous sans téléphone.',
    emoji: '💈',
    teintes: ['#a855f7', '#ec4899'],
    points: ['Prise de rendez-vous', 'Avis Google', 'Galerie de réalisations'],
  },
] as const;

export function modeleParId(id: string): Modele | undefined {
  return MODELES.find((m) => m.id === id);
}

/* ── Les options ──────────────────────────────────────────────────────────── */

export type IdentifiantOption =
  | 'appel' | 'whatsapp' | 'devis' | 'rdv' | 'avant-apres'
  | 'avis' | 'carte' | 'paiement' | 'blog-ia' | 'video-titan';

export type Option = {
  readonly id: IdentifiantOption;
  readonly nom: string;
  readonly aquoiCaSert: string;
  /** Supplément en euros. Zéro pour tout ce qui est compris dans la base. */
  readonly supplement: number;
};

/*
 * Une seule option est payante aujourd'hui, et le champ `supplement` existe
 * quand même sur toutes : le jour où une deuxième le devient, il n'y a qu'un
 * chiffre à changer, pas une condition à écrire dans le calcul.
 */
export const OPTIONS: readonly Option[] = [
  { id: 'appel', nom: 'Bouton Appel', aquoiCaSert: 'Un doigt, et le téléphone sonne.', supplement: 0 },
  { id: 'whatsapp', nom: 'WhatsApp', aquoiCaSert: 'La conversation démarre déjà écrite.', supplement: 0 },
  { id: 'devis', nom: 'Demande de devis', aquoiCaSert: 'Le formulaire tombe dans ta boîte.', supplement: 0 },
  { id: 'rdv', nom: 'Prise de rendez-vous', aquoiCaSert: 'Le client choisit son créneau.', supplement: 0 },
  { id: 'avant-apres', nom: 'Galerie avant / après', aquoiCaSert: 'Le curseur qui fait vendre un chantier.', supplement: 0 },
  { id: 'avis', nom: 'Avis Google', aquoiCaSert: 'Tes étoiles, reprises sur la page.', supplement: 0 },
  { id: 'carte', nom: 'Carte et zone', aquoiCaSert: 'Où tu interviens, sans ambiguïté.', supplement: 0 },
  { id: 'paiement', nom: 'Paiement Stripe', aquoiCaSert: 'Encaisser un acompte depuis la page.', supplement: 0 },
  { id: 'blog-ia', nom: 'Blog 10 IA', aquoiCaSert: 'Dix articles qui te font trouver sur Google.', supplement: 0 },
  { id: 'video-titan', nom: 'Vidéo Titan AZEROTH — 21,5 s', aquoiCaSert: 'Le film d’accroche de ta page.', supplement: 200 },
] as const;

export const PRIX_BASE = 299;

export function optionParId(id: string): Option | undefined {
  return OPTIONS.find((o) => o.id === id);
}

/**
 * Le total, à partir des seules options réellement connues.
 *
 * Un identifiant inventé est ignoré plutôt que refusé : le formulaire est la
 * seule source légitime, et une option inconnue vient forcément d'ailleurs.
 * Un doublon ne compte qu'une fois — sans quoi la même case envoyée deux fois
 * facturerait la vidéo deux fois.
 */
export function prixTotal(options: readonly string[]): number {
  const vues = new Set<string>();
  return options.reduce((total, id) => {
    if (vues.has(id)) return total;
    vues.add(id);
    return total + (optionParId(id)?.supplement ?? 0);
  }, PRIX_BASE);
}

/* ── Le dossier de commande ───────────────────────────────────────────────── */

/**
 * `Maçonnerie Dupont` + 2026-08-27 → `maconnerie-dupont-2026-08-27`.
 *
 * Ce nom devient un dossier sur le disque : ni accent, ni espace, ni barre
 * oblique — un nom d'entreprise contenant « / » créerait sinon un sous-dossier
 * là où on n'en attend pas, voire écrirait ailleurs que dans le dossier prévu.
 */
export function nomDossier(nomEntreprise: string, jour: string): string {
  const base = nomEntreprise
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base === '' ? 'sans-nom' : base}-${jour}`;
}

/* ── Ce qu'on accepte ─────────────────────────────────────────────────────── */

export type Commande = {
  modele: string;
  entreprise: string;
  telephone: string;
  ville: string;
  couleur: string;
  slogan: string;
  options: string[];
  presentation: string;
  services: string;
};

const CHAMPS_OBLIGATOIRES: readonly (keyof Commande)[] = ['modele', 'entreprise', 'telephone', 'ville'];

const LIBELLES: Readonly<Record<string, string>> = {
  modele: 'le modèle',
  entreprise: 'le nom de l’entreprise',
  telephone: 'le téléphone',
  ville: 'la ville',
};

/**
 * Rend la liste des reproches, vide si tout va bien.
 *
 * Elle sert des deux côtés : le formulaire pour n'activer « suivant » qu'à bon
 * escient, la route d'API pour refuser ce qui arrive par un autre chemin. Les
 * deux appellent la **même** fonction, sans quoi elles finiraient par diverger
 * et le serveur accepterait ce que l'écran refuse.
 */
export function reproches(commande: Partial<Commande>): string[] {
  const liste: string[] = [];

  for (const champ of CHAMPS_OBLIGATOIRES) {
    const valeur = commande[champ];
    if (typeof valeur !== 'string' || valeur.trim() === '') {
      liste.push(`Il manque ${LIBELLES[champ]}.`);
    }
  }

  if (typeof commande.modele === 'string' && commande.modele !== '' && !modeleParId(commande.modele)) {
    liste.push('Ce modèle n’existe pas.');
  }

  const tel = (commande.telephone ?? '').replace(/[^\d+]/g, '');
  if (tel !== '' && tel.replace(/\D/g, '').length < 9) {
    liste.push('Ce numéro de téléphone est trop court.');
  }

  if (typeof commande.couleur === 'string' && commande.couleur !== '' && !/^#[0-9a-fA-F]{6}$/.test(commande.couleur)) {
    liste.push('La couleur doit s’écrire en hexadécimal, par exemple #ff6600.');
  }

  return liste;
}

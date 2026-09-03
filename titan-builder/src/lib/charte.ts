/*
 * La charte graphique d'Artisan Express, en un seul endroit.
 *
 * Ce fichier ne contient que des **valeurs**. Aucun calcul, aucune dépendance :
 * `site.ts` garde les fonctions de contraste, et les tests de la charte les lui
 * empruntent pour prouver ces valeurs-ci. Poser les maths ici aurait créé un
 * cycle entre les deux modules, ou un second calcul de contraste qui aurait
 * dérivé du premier au premier changement.
 *
 * ── D'où elle vient ───────────────────────────────────────────────────────
 *
 * Elle n'est pas inventée : elle est **relevée**. Les sites déjà livrés
 * tiraient tous vers le même arc — Couverture Tanguy en vert `#2f6f4e`,
 * Plomberie Kerhervé en bleu-pétrole `#1f6f8b` — sans que ce soit écrit nulle
 * part. Et `life-organizer/interface_web` (« Le Coffre ») tourne depuis des
 * jours sur un fond `#16151A` avec un accent `#4FB39C` : le même arc, vu
 * depuis un fond sombre. La charte ne fait que nommer ce qui existait.
 *
 * ── Ce qui a été mesuré le 03/09/2026, et qui a décidé ────────────────────
 *
 * 1. **L'orange sortait déjà du standard.** `#c74e00` sur blanc rend 4,6:1 :
 *    il passe le minimum WCAG de 4,5 et échoue au plancher de 7:1 que
 *    `CLAUDE.md` §2 bis impose à un accent. Le retirer corrige un défaut, ce
 *    n'est pas un changement de goût.
 *
 * 2. **Les teintes de métier ne survivent pas au fond sombre.** Sur `#16151A`,
 *    Tanguy rend 3,0:1, Kerhervé 3,2:1, Le Goff 3,1:1 — illisibles. Les
 *    relever automatiquement jusqu'à 7:1 **ramène l'orange** : l'électricien
 *    ressortait `#E18E3B`, le maçon et le menuisier en beige chaud. C'est
 *    pourquoi la palette ci-dessous est **choisie et froide**, et non dérivée
 *    de l'ancienne.
 *
 * ── Ce qui fait la patte, et ce n'est pas la teinte ───────────────────────
 *
 * Un client doit reconnaître un site d'Artisan Express avant d'avoir vu sa
 * couleur. Ce qui se reconnaît, et qui ne varie **jamais** : le filet vertical
 * sous chaque titre, l'entête en halo plutôt qu'en aplat, les prestations en
 * liste fléchée, le bouton plein contre le bouton contour, la signature en
 * pied. La teinte ne dit que le métier.
 */

/*
 * Les surfaces, du fond de page à la carte la plus haute.
 *
 * **Les noms sont ceux de `CLAUDE.md` §2 bis, et pas d'autres.** Cette
 * section-là nomme TITAN Builder comme le projet qui s'en écarte — il dit
 * `fond`, `fond-doux`, `verre`, `bord` — et la raison qu'elle donne vaut
 * exactement ici : une brique qui change de vocabulaire ne se déplace plus
 * d'un projet à l'autre, et c'est ce qu'une identité partagée doit permettre.
 *
 * `raised` manque, et c'est délibéré : une page d'artisan a trois niveaux, pas
 * quatre. Inventer une surface pour compléter la liste donnerait deux nuances
 * qu'aucun œil ne sépare — le défaut que le rapport de 1,07 cherche à éviter.
 *
 * L'écart entre voisines vaut 1,099 — mesuré, et proche de ce 1,07. Au-delà,
 * on retombe sur des boîtes empilées ; en deçà, plus rien ne se distingue.
 */
export const SURFACES = {
  ink: '#16151A',
  slab: '#1F1E25',
  panel: '#26242D',
  edge: '#2E2C34',
} as const;

/*
 * L'encre. Un blanc cassé légèrement chaud plutôt qu'un blanc pur : sur un
 * fond sombre, le blanc pur vibre et fatigue à la lecture longue.
 *
 * Mesuré sur `SURFACES.ink` : 15,8:1 et 8,7:1.
 */
export const ENCRES = {
  vive: '#F1EFEA',
  douce: '#B7B3A9',
  eteinte: '#6C6A72',
} as const;

/** Ce qu'une teinte de métier porte avec elle. */
export type Teinte = {
  /** L'accent lui-même, sur le fond de page. */
  readonly accent: string;
  /** Sa version claire, pour un survol ou un second niveau. */
  readonly vif: string;
  /** Ce qu'on écrit **sur** l'accent — le texte du bouton plein. */
  readonly encre: string;
  /** Le voile qui sert de halo d'entête et de fond de bloc discret. */
  readonly voile: string;
};

/*
 * La palette fermée, cinq teintes, toutes froides et toutes ≥ 7:1 sur
 * `SURFACES.ink` — mesuré, et tenu par `tests/charte.test.ts`.
 *
 * Fermée est le mot qui compte : un artisan ne choisit pas un hexadécimal
 * libre, il reçoit la teinte de son métier. C'est ce qui garantit qu'un
 * couvreur de Rennes et un plombier de Vannes se ressemblent assez pour
 * qu'on les reconnaisse, et diffèrent assez pour ne pas être la même page.
 */
export const TEINTES: Readonly<Record<string, Teinte>> = {
  vert: { accent: '#4FB39C', vif: '#6FCAB4', encre: '#0D2A25', voile: '#1C332E' },
  menthe: { accent: '#6FCAB4', vif: '#8FD9C6', encre: '#0D2A25', voile: '#1C332E' },
  petrole: { accent: '#3EADD4', vif: '#5FBFDE', encre: '#082530', voile: '#16303B' },
  ardoise: { accent: '#969FCB', vif: '#B0B7DA', encre: '#151931', voile: '#232742' },
  lavande: { accent: '#A499E3', vif: '#BBB2EC', encre: '#1D1A33', voile: '#292544' },
};

/** La teinte servie quand rien ne correspond. */
export const TEINTE_PAR_DEFAUT = 'vert';

/*
 * Quel métier porte quelle teinte.
 *
 * Les métiers voisins partagent une teinte à dessein : cinq teintes pour une
 * douzaine de métiers, parce qu'au-delà de cinq les valeurs se ressemblent
 * trop pour se distinguer, et que la distinction n'a de valeur que si elle se
 * voit. Un métier absent de cette table reçoit le vert.
 */
export const TEINTE_DU_METIER: Readonly<Record<string, string>> = {
  couvreur: 'vert',
  charpentier: 'vert',
  zingueur: 'vert',
  macon: 'menthe',
  terrassier: 'menthe',
  paysagiste: 'menthe',
  plombier: 'petrole',
  chauffagiste: 'petrole',
  carreleur: 'petrole',
  electricien: 'ardoise',
  serrurier: 'ardoise',
  plaquiste: 'ardoise',
  peintre: 'lavande',
  menuisier: 'lavande',
};

/*
 * Les anciennes couleurs libres, ramenées dans la charte.
 *
 * Les dossiers de commande déjà écrits portent un hexadécimal — `#2f6f4e`
 * pour Tanguy, `#1f6f8b` pour Kerhervé. Ils doivent continuer de se générer,
 * et se générer **dans la charte** : cette table les rattache à leur teinte
 * plutôt que de les refuser ou de les servir telles quelles.
 *
 * Toute autre valeur tombe sur le vert. C'est délibérément grossier : la
 * bonne façon de choisir une teinte est de nommer un métier, pas de deviner
 * depuis un code couleur.
 */
const ANCIENNES: Readonly<Record<string, string>> = {
  '#2f6f4e': 'vert',
  '#1f6f8b': 'petrole',
  '#1f5f8b': 'petrole',
  '#8a5a2b': 'menthe',
  '#a8611a': 'ardoise',
  '#6b4f2a': 'lavande',
  '#3d5a80': 'ardoise',
  '#004aad': 'petrole',
  '#7c3aed': 'lavande',
};

/** Enlève les accents et la ponctuation : « Maçon » et « macon » sont un. */
function aplatir(brut: string): string {
  return brut
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/*
 * Les métiers proposés au client, dans l'ordre où ils lui sont montrés.
 *
 * C'est cette liste que l'écran affiche, et `TEINTE_DU_METIER` juste au-dessus
 * qui décide de la teinte. Les deux sont tenues ensemble par un test : un
 * métier proposé sans teinte tomberait sur le vert par défaut, et le client
 * verrait deux entrées de la liste rendre exactement la même page.
 *
 * Le libellé porte ses accents, la clé n'en a pas : c'est `aplatir` qui les
 * réunit, et c'est pour cela qu'un client peut aussi taper « Maçon ».
 */
export const METIERS_PROPOSES: readonly { readonly cle: string; readonly libelle: string }[] = [
  { cle: 'couvreur', libelle: 'Couvreur' },
  { cle: 'charpentier', libelle: 'Charpentier' },
  { cle: 'zingueur', libelle: 'Zingueur' },
  { cle: 'macon', libelle: 'Maçon' },
  { cle: 'terrassier', libelle: 'Terrassier' },
  { cle: 'paysagiste', libelle: 'Paysagiste' },
  { cle: 'plombier', libelle: 'Plombier' },
  { cle: 'chauffagiste', libelle: 'Chauffagiste' },
  { cle: 'carreleur', libelle: 'Carreleur' },
  { cle: 'electricien', libelle: 'Électricien' },
  { cle: 'serrurier', libelle: 'Serrurier' },
  { cle: 'plaquiste', libelle: 'Plaquiste' },
  { cle: 'peintre', libelle: 'Peintre' },
  { cle: 'menuisier', libelle: 'Menuisier' },
];

/**
 * Le nom de la teinte qui correspond à une entrée, ou `undefined`.
 *
 * C'est la moitié qui **sait dire non**, et elle existe pour le formulaire :
 * `teinteDeCharte` rend toujours quelque chose, ce qui est exactement ce qu'il
 * faut pour générer un site et exactement ce qu'il ne faut pas pour valider une
 * saisie. Un métier mal orthographié passerait en vert sans que personne ne le
 * voie, et le client recevrait la teinte d'un autre corps de métier.
 *
 * Les deux fonctions partagent donc ce calcul-ci plutôt que d'en tenir deux.
 */
export function nomDeTeinte(entree: string): string | undefined {
  const plat = aplatir(entree);
  if (TEINTE_DU_METIER[plat] !== undefined) return TEINTE_DU_METIER[plat];
  if (TEINTES[plat] !== undefined) return plat;
  return ANCIENNES[entree.trim().toLowerCase()];
}

/**
 * La teinte à servir, depuis un métier, un nom de teinte, ou une ancienne
 * couleur — dans cet ordre.
 *
 * Elle rend **toujours** une teinte de la charte. C'est ce qui fait qu'aucun
 * site livré ne peut s'en écarter, même généré depuis un vieux dossier ou une
 * entrée fantaisiste : il n'existe pas de chemin qui produise autre chose.
 */
export function teinteDeCharte(entree: string): Teinte {
  return TEINTES[nomDeTeinte(entree) ?? TEINTE_PAR_DEFAUT] as Teinte;
}

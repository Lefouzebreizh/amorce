/**
 * Deux plans se ressemblent-ils au point de ne rien raconter de plus ?
 *
 * Un montage peut avoir la bonne cadence, la bonne durée, la bonne note, et
 * n'avancer nulle part : il suffit que les rushes montrent la même chose. Aucune
 * mesure du studio ne le voyait — elles comptent des secondes et des coupes,
 * jamais ce qu'il y a dans l'image.
 *
 * Constaté sur un montage rejeté : neuf rushes, dont **sept montraient le même
 * cadrage**. Le film était conforme partout et ne racontait rien.
 *
 * La méthode est la plus simple qui marche : on ramène l'image à huit sur huit
 * en gris, et chaque case vaut 1 si elle est plus claire que la moyenne. Le
 * résultat tient sur soixante-quatre bits, se compare par un « ou exclusif »,
 * et survit au recadrage, au bruit et à l'étalonnage — c'est la structure des
 * masses qu'il retient, pas les pixels.
 */

/** Nombre de cases par côté. Soixante-quatre bits, seize caractères. */
export const COTE = 8;

/**
 * En deçà, deux plans montrent la même chose.
 *
 * Mesuré sur le montage rejeté, neuf plans comparés deux à deux : à l'intérieur
 * du groupe qui se répète, les distances vont de **2 à 11** ; entre ce groupe et
 * les deux plans réellement différents — un cercle de runes, un dragon — elles
 * vont de **15 à 26**.
 *
 * Le trou entre 11 et 15 est franc, et le seuil se pose dedans. Il n'est donc
 * pas choisi : il est lu.
 */
export const SEUIL = 12;

/**
 * L'empreinte d'une image déjà réduite à huit sur huit en niveaux de gris.
 *
 * La fonction ne décode rien et ne touche à aucun canevas : elle reçoit les
 * soixante-quatre valeurs. C'est ce qui la rend éprouvable sans navigateur, et
 * ce qui permet de la calculer au moment où la vignette est fabriquée — sans un
 * seul décodage de plus.
 */
export function empreinte(gris: ArrayLike<number>): string {
  const n = COTE * COTE;
  if (gris.length < n) return '';
  let somme = 0;
  for (let i = 0; i < n; i += 1) somme += gris[i];
  const moyenne = somme / n;

  let sortie = '';
  for (let bloc = 0; bloc < n; bloc += 4) {
    let quartet = 0;
    for (let i = 0; i < 4; i += 1) {
      if (gris[bloc + i] > moyenne) quartet |= 1 << i;
    }
    sortie += quartet.toString(16);
  }
  return sortie;
}

/** Nombre de bits qui diffèrent. Rend 64 — le maximum — si l'une manque. */
export function distance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return COTE * COTE;
  let ecart = 0;
  for (let i = 0; i < a.length; i += 1) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      ecart += x & 1;
      x >>= 1;
    }
  }
  return ecart;
}

/**
 * Regroupe ce qui se ressemble, de proche en proche.
 *
 * Le regroupement est **transitif** à dessein : dans le montage rejeté, les
 * plans 0 et 7 sont à 11 l'un de l'autre, mais tous deux à moins de 7 du plan 6.
 * Les traiter par paires isolées aurait rendu trois petits groupes là où il n'y
 * a qu'une seule chose répétée sept fois — et c'est le nombre qui compte pour
 * celui qui regarde.
 *
 * Les entrées sans empreinte sont ignorées plutôt que rassemblées : un projet
 * enregistré avant cette mesure n'en porte pas, et les mettre ensemble
 * annoncerait une répétition qui n'existe pas.
 */
export function groupesSemblables(
  entrees: readonly { id: string; empreinte?: string }[],
  seuil = SEUIL,
): string[][] {
  const utiles = entrees.filter((e) => e.empreinte);
  const parent = new Map(utiles.map((e) => [e.id, e.id]));

  const racine = (id: string): string => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r) as string;
    return r;
  };

  for (let i = 0; i < utiles.length; i += 1) {
    for (let j = i + 1; j < utiles.length; j += 1) {
      if (distance(utiles[i].empreinte as string, utiles[j].empreinte as string) <= seuil) {
        parent.set(racine(utiles[i].id), racine(utiles[j].id));
      }
    }
  }

  const groupes = new Map<string, string[]>();
  for (const e of utiles) {
    const r = racine(e.id);
    const g = groupes.get(r);
    if (g) g.push(e.id);
    else groupes.set(r, [e.id]);
  }
  return [...groupes.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
}

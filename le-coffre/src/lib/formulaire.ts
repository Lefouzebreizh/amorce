/**
 * Remplissage de formulaire PDF, entièrement côté navigateur (pdf-lib, pas de
 * bibliothèque serveur) — version simplifiée de
 * `paper-manager/core/formulaires.py`, qui fait la même chose en local avec
 * un plan JSON écrit une fois à la main.
 *
 * Ici, pas de plan à écrire : les champs du PDF sont lus (AcroForm), une
 * source est *suggérée* par rapprochement du nom du champ avec l'identité
 * déjà enregistrée dans le coffre, et l'utilisateur valide ou corrige chaque
 * champ avant de remplir — jamais rempli à l'aveugle. Le PDF ne quitte à
 * aucun moment le navigateur : ni pour lire ses champs, ni pour le remplir.
 *
 * Ce que ce module ne fait PAS, contrairement à `formulaires.py` :
 * - pas de remplissage par coordonnées pour un PDF sans champs de formulaire
 *   (« plat ») — seuls les vrais champs AcroForm sont pris en charge ;
 * - pas de transposition de caractères spéciaux (œ, €) pour une police de
 *   base limitée au latin-1 — pdf-lib embarque une police qui les porte ;
 * - pas de source « abonnement » : Le Tiroir Secret ne modélise pas de
 *   contrats, seulement des documents et une identité.
 */

// pdf-lib expose deux bâtiments incompatibles entre eux : le lot CommonJS
// (`cjs/`, que Node résout pour un `import` faute de champ `exports` dans
// son package.json) réexporte tout via un helper tslib au lieu d'assigner
// littéralement chaque nom, ce qu'aucun analyseur statique — celui de
// Node compris — ne sait détecter, donc un import nommé y échoue toujours ;
// le lot ESM (`es/`, que Turbopack choisit) n'a lui aucun export par
// défaut. Un import nommé casse Node, un import par défaut casse Turbopack.
// L'import en espace de noms lit lequel des deux on a réellement sous la
// main à l'exécution — `default` n'existe que côté CommonJS — et bascule
// sur l'un ou l'autre en conséquence.
import * as pdfLibEspaceDeNoms from 'pdf-lib';
type PdfLibModule = typeof pdfLibEspaceDeNoms;
const pdfLib: PdfLibModule = 'default' in pdfLibEspaceDeNoms
  ? (pdfLibEspaceDeNoms as unknown as { default: PdfLibModule }).default
  : pdfLibEspaceDeNoms;
const { PDFDocument, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFTextField } = pdfLib;
import type { Identite } from './coffre';

export type TypeChamp = 'texte' | 'case' | 'liste' | 'radio' | 'inconnu';

export type ChampFormulaire = {
  nom: string;
  type: TypeChamp;
  /** Options possibles pour une liste ou un groupe radio — vide sinon. */
  options: string[];
  /** Source suggérée par rapprochement du nom du champ — ou null si aucune ne colle. */
  sourceSuggeree: SourceChamp | null;
};

export type SourceChamp = 'identite.nomComplet' | 'identite.adresse' | 'identite.codePostal' | 'identite.ville' | '@aujourdhui';

const INDICES_SOURCE: [RegExp, SourceChamp][] = [
  [/code.?postal|cp\b/i, 'identite.codePostal'],
  [/adresse|domicile|demeurant/i, 'identite.adresse'],
  [/ville|commune(?!.*naissance)/i, 'identite.ville'],
  // Après adresse/ville : un champ « nom » seul est plus souvent une
  // signature ou un état civil que l'adresse, mais il reste ambigu (nom de
  // famille ? nom complet ? nom de l'organisme ?) — suggéré en dernier,
  // toujours à valider avant de remplir.
  [/^nom(_|\s|$)|nom.{0,15}pr[ée]nom|signataire/i, 'identite.nomComplet'],
  [/^date(_|\s|$)|fait.{0,10}le|date.{0,10}jour/i, '@aujourdhui'],
];

function suggererSource(nomChamp: string): SourceChamp | null {
  for (const [motif, source] of INDICES_SOURCE) {
    if (motif.test(nomChamp)) return source;
  }
  return null;
}

export function libelleSource(source: SourceChamp): string {
  return {
    'identite.nomComplet': 'Nom complet',
    'identite.adresse': 'Adresse',
    'identite.codePostal': 'Code postal',
    'identite.ville': 'Ville',
    '@aujourdhui': "Date du jour",
  }[source];
}

/** Lit les champs d'un PDF (AcroForm) — jamais son contenu textuel, seulement sa structure de formulaire. */
export async function champsFormulaire(bytes: ArrayBuffer): Promise<ChampFormulaire[]> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  return form.getFields().map((champ) => {
    const nom = champ.getName();
    if (champ instanceof PDFCheckBox) {
      return { nom, type: 'case' as const, options: [], sourceSuggeree: suggererSource(nom) };
    }
    if (champ instanceof PDFDropdown) {
      return { nom, type: 'liste' as const, options: champ.getOptions(), sourceSuggeree: suggererSource(nom) };
    }
    if (champ instanceof PDFRadioGroup) {
      return { nom, type: 'radio' as const, options: champ.getOptions(), sourceSuggeree: suggererSource(nom) };
    }
    if (champ instanceof PDFTextField) {
      return { nom, type: 'texte' as const, options: [], sourceSuggeree: suggererSource(nom) };
    }
    return { nom, type: 'inconnu' as const, options: [], sourceSuggeree: null };
  });
}

function valeurSource(source: SourceChamp, identite: Identite): string {
  const aujourdhui = new Date().toLocaleDateString('fr-FR');
  switch (source) {
    case 'identite.nomComplet': return identite.nom;
    case 'identite.adresse': return identite.adresse;
    case 'identite.codePostal': return identite.codePostal;
    case 'identite.ville': return identite.ville;
    case '@aujourdhui': return aujourdhui;
  }
}

/**
 * Remplit et APLATIT le PDF (les valeurs sont gravées dans la page, le
 * formulaire cesse d'être interactif) — comme `formulaires.py` : un
 * formulaire qui garde ses champs vivants s'imprime vierge chez qui ne les
 * régénère pas, et c'est le guichet qui le découvre.
 *
 * `valeurs` associe chaque nom de champ soit à une `SourceChamp` (résolue
 * via `identite`), soit directement à un texte libre tapé à la main
 * (correction de la suggestion, champ que rien ne rapprochait).
 */
export async function remplirFormulaire(
  bytes: ArrayBuffer,
  valeurs: Record<string, SourceChamp | string | boolean>,
  identite: Identite,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  for (const champ of form.getFields()) {
    const valeur = valeurs[champ.getName()];
    if (valeur === undefined || valeur === '') continue;

    if (champ instanceof PDFCheckBox) {
      if (valeur === true) champ.check(); else champ.uncheck();
      continue;
    }
    const texte = typeof valeur === 'string'
      ? (estSourceChamp(valeur) ? valeurSource(valeur, identite) : valeur)
      : '';
    if (!texte) continue;
    if (champ instanceof PDFDropdown || champ instanceof PDFRadioGroup) {
      // Une valeur qui ne correspond à aucune option du PDF ferait planter
      // select() sans le dire clairement : on l'ignore plutôt, la case reste
      // vide et se voit à la relecture, préférable à une exception opaque.
      if (champ.getOptions().includes(texte)) champ.select(texte);
      continue;
    }
    if (champ instanceof PDFTextField) champ.setText(texte);
  }

  form.flatten();
  return doc.save();
}

function estSourceChamp(valeur: string): valeur is SourceChamp {
  return valeur === 'identite.nomComplet' || valeur === 'identite.adresse'
    || valeur === 'identite.codePostal' || valeur === 'identite.ville' || valeur === '@aujourdhui';
}

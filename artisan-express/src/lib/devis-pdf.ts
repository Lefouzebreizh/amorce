import { POLICE_PDF_HEX, POLICE_PDF_LARGEURS, POLICE_PDF_ASCENT, POLICE_PDF_DESCENT, POLICE_PDF_BBOX } from '@/lib/devis-police';
import {
  afficherEuros,
  erreursDevis,
  totalDevisCentimes,
  totalLigneCentimes,
  type BrouillonDevisVocal,
} from '@/lib/devis-vocal';

/* PDF 1.4 sans dépendance : police incorporée ArtisanDevis, encodage WinAnsi.
 * Les littéraux sont échappés et les offsets xref portent sur un flux ASCII.
 * Le résultat est une vraie pièce téléchargeable, jamais un faux bouton PDF.
 */
const WIN_ANSI: Record<string, number> = {
  '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135,
  'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142,
  '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151,
  '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159,
};

function literalPdf(texte: string): string {
  return [...texte.normalize('NFC')].map((caractere) => {
    const point = caractere.codePointAt(0) ?? 32;
    const code = WIN_ANSI[caractere] ?? (point >= 32 && point <= 255 ? point : 63);
    if (code === 40 || code === 41 || code === 92) return `\\${String.fromCharCode(code)}`;
    if (code >= 127) return `\\${code.toString(8).padStart(3, '0')}`;
    return String.fromCharCode(code);
  }).join('');
}

/** Mesure la police incorporée à 10 pt, y compris les mots sans espace. */
const LARGEURS = POLICE_PDF_LARGEURS.trim().split(/\s+/).map(Number);
function largeurTexte(texte: string): number {
  return [...texte].reduce((somme, caractere) => {
    const point = WIN_ANSI[caractere] ?? caractere.codePointAt(0) ?? 63;
    return somme + (LARGEURS[point - 32] ?? LARGEURS[31] ?? 600) / 100;
  }, 0);
}
function envelopper(texte: string, largeur = 490): string[] {
  const mots = texte.replace(/[\u00a0\u202f]/g, ' ').replace(/[\r\n\t]+/g, ' ').split(/\s+/);
  const lignes: string[] = [];
  let courant = '';
  for (const mot of mots) {
    if (courant && largeurTexte(`${courant} ${mot}`) <= largeur) {
      courant += ` ${mot}`;
      continue;
    }
    if (courant) { lignes.push(courant); courant = ''; }
    for (const caractere of mot) {
      if (courant && largeurTexte(courant + caractere) > largeur) {
        lignes.push(courant); courant = '';
      }
      courant += caractere;
    }
  }
  if (courant) lignes.push(courant);
  return lignes.length ? lignes : [''];
}

export function creerPdfDevis(brouillon: BrouillonDevisVocal, date = new Date()): Uint8Array {
  const erreurs = erreursDevis(brouillon, true);
  if (erreurs.length) throw new Error(erreurs[0]);
  const total = totalDevisCentimes(brouillon);

  const lignes: string[] = [
    'ARTISAN EXPRESS',
    'BROUILLON DE DEVIS - DEMONSTRATION',
    `Préparé le ${new Intl.DateTimeFormat('fr-FR').format(date)}`,
    'Document non contractuel. Ne pas envoyer comme devis définitif.',
    '',
    ...envelopper(`Client : ${brouillon.client.trim() || 'À compléter'}`),
    '',
    'PRESTATIONS ET PRIX INDICATIFS',
    'Les prix sont saisis et vérifiés par l’utilisateur, pas estimés par une IA.',
    '',
  ];

  brouillon.lignes.forEach((ligne, index) => {
    lignes.push(
      ...envelopper(`${index + 1}. ${ligne.designation}`),
      ...envelopper(`Quantité : ${ligne.quantite} ${ligne.unite} | Prix unitaire HT : ${ligne.prixUnitaire.trim() ? `${ligne.prixUnitaire} EUR` : 'À compléter'}`),
      `Montant HT : ${totalLigneCentimes(ligne) === null ? 'À compléter' : afficherEuros(totalLigneCentimes(ligne)!)}`,
      '',
    );
  });
  lignes.push(
    `TOTAL INDICATIF HT : ${total === null ? 'À compléter' : afficherEuros(total)}`,
    'TVA : non définie. Total TTC non calculé.',
    '',
    ...envelopper('Avant tout envoi réel : vérifier les prestations, les prix, la TVA applicable, l’identité et les coordonnées des parties, les délais, les conditions de paiement et les mentions nécessaires.'),
    ...envelopper('La structuration de cette démonstration est locale et simulée. Aucune commande ni aucun envoi au client n’a été effectué.'),
  );

  const pages: string[][] = [];
  const lignesParPage = 43;
  for (let index = 0; index < lignes.length; index += lignesParPage) {
    pages.push(lignes.slice(index, index + lignesParPage));
  }

  const objets: string[] = [];
  const pagesIds = pages.map((_, index) => 4 + index * 2);
  objets.push('<< /Type /Catalog /Pages 2 0 R >>');
  objets.push(`<< /Type /Pages /Kids [${pagesIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  const descripteurId = 4 + pages.length * 2;
  const fichierPoliceId = descripteurId + 1;
  objets.push(`<< /Type /Font /Subtype /TrueType /BaseFont /ArtisanDevis /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 255 /Widths [${POLICE_PDF_LARGEURS}] /FontDescriptor ${descripteurId} 0 R >>`);

  pages.forEach((page, index) => {
    const contenuId = 5 + index * 2;
    objets.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contenuId} 0 R >>`);
    const flux = [
      'BT /F1 10 Tf 14 TL 48 786 Td',
      ...page.flatMap((ligne, numero) => [...(numero ? ['T*'] : []), `(${literalPdf(ligne)}) Tj`]),
      'ET',
      `BT /F1 9 Tf 48 35 Td (${literalPdf(`Artisan Express - démonstration non contractuelle - page ${index + 1}/${pages.length}`)}) Tj ET`,
    ].join('\n');
    objets.push(`<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`);
  });

  objets.push(`<< /Type /FontDescriptor /FontName /ArtisanDevis /Flags 32 /FontBBox [${POLICE_PDF_BBOX}] /ItalicAngle 0 /Ascent ${POLICE_PDF_ASCENT} /Descent ${POLICE_PDF_DESCENT} /CapHeight 730 /StemV 80 /FontFile2 ${fichierPoliceId} 0 R >>`);
  const fluxPolice = `${POLICE_PDF_HEX}>`;
  objets.push(`<< /Length ${fluxPolice.length} /Length1 ${POLICE_PDF_HEX.length / 2} /Filter /ASCIIHexDecode >>\nstream\n${fluxPolice}\nendstream`);

  let pdf = '%PDF-1.4\n';
  const positions = [0];
  objets.forEach((objet, index) => {
    positions.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objet}\nendobj\n`;
  });
  const debutXref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  pdf += positions.slice(1).map((position) => `${position.toString().padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

import { NextResponse } from 'next/server';
import { type Commande, reproches } from '@/lib/commande';
import { DOSSIER_COMMANDES } from '@/lib/config';
import { envoyerDossier } from '@/lib/courriel';
import { ecrireDossier, type PhotoRecue } from '@/lib/dossier';

/*
 * La route qui reçoit un dossier de commande.
 *
 * Trois précautions, chacune pour une raison précise :
 *
 * - **On revalide.** Le formulaire valide déjà, mais rien n'oblige à passer par
 *   lui. Les deux appellent `reproches`, donc le serveur refuse exactement ce
 *   que l'écran refuse — deux règles séparées finiraient par diverger.
 * - **Le dossier est écrit avant l'envoi du courriel.** Si l'envoi échoue, la
 *   commande existe quand même ; l'inverse perdrait le travail du client.
 * - **Un envoi manqué ne rend pas une erreur.** Le client a rempli son
 *   formulaire, son dossier est enregistré : lui afficher un échec le ferait
 *   recommencer pour rien. Le défaut est signalé dans la réponse, pas comme un
 *   refus.
 */

export const runtime = 'nodejs';

/** Au-delà, ce n'est plus une photo de chantier — et l'hébergeur refuse de toute façon. */
const TAILLE_MAX_PHOTO = 8 * 1024 * 1024;
const PHOTOS_MAX = 20;

export async function POST(requete: Request) {
  let formulaire: FormData;
  try {
    formulaire = await requete.formData();
  } catch {
    return NextResponse.json({ erreur: 'Envoi illisible.' }, { status: 400 });
  }

  const brut = formulaire.get('commande');
  if (typeof brut !== 'string') {
    return NextResponse.json({ erreur: 'Commande absente.' }, { status: 400 });
  }

  let commande: Commande;
  try {
    commande = JSON.parse(brut) as Commande;
  } catch {
    return NextResponse.json({ erreur: 'Commande illisible.' }, { status: 400 });
  }

  const manques = reproches(commande);
  if (manques.length > 0) {
    return NextResponse.json({ erreur: manques.join(' ') }, { status: 400 });
  }

  const photos: PhotoRecue[] = [];
  for (const valeur of formulaire.getAll('photos')) {
    if (!(valeur instanceof File)) continue;
    if (photos.length >= PHOTOS_MAX) break;
    if (valeur.size > TAILLE_MAX_PHOTO) continue;
    photos.push({ nom: valeur.name, octets: new Uint8Array(await valeur.arrayBuffer()) });
  }

  const jour = new Date().toISOString().slice(0, 10);

  let ecrit;
  try {
    ecrit = await ecrireDossier(DOSSIER_COMMANDES, commande, photos, jour);
  } catch (e) {
    return NextResponse.json(
      { erreur: e instanceof Error ? e.message : 'Le dossier n’a pas pu être enregistré.' },
      { status: 500 },
    );
  }

  const courriel = await envoyerDossier(commande, ecrit.reference, ecrit.fichiers, ecrit.chemin);

  return NextResponse.json({
    reference: ecrit.reference,
    photos: ecrit.fichiers.length,
    courrielEnvoye: courriel.envoye,
    ...(courriel.raison ? { avertissement: courriel.raison } : {}),
  });
}

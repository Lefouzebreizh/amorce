import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type Commande, nomDossier, prixTotal } from '@/lib/commande';

/*
 * L'écriture du dossier de commande sur le disque.
 *
 * Le dossier de base est un paramètre et non une constante lue ici : c'est ce
 * qui rend la fonction éprouvable dans un dossier temporaire, sans toucher à
 * l'emplacement réel.
 *
 * **Sur Vercel, `/tmp` est propre à une invocation et disparaît avec elle.**
 * Le dossier écrit n'est donc pas un stockage : c'est une trace locale utile en
 * développement, et le courriel reste le seul chemin par lequel une commande
 * sort réellement. Écrit ici parce que c'est le genre de détail qu'on découvre
 * en cherchant un dossier vide trois semaines plus tard.
 */

export type PhotoRecue = { nom: string; octets: Uint8Array };

export type DossierEcrit = { reference: string; chemin: string; fichiers: string[] };

/** `photo.JPG` → `photo.JPG`, `../../evasion.sh` → `evasion.sh`. */
function nomSur(brut: string, rang: number): string {
  const base = path.basename(brut).replace(/[^\w.\- ]+/g, '_').slice(-80);
  return base === '' || base === '.' || base === '..' ? `photo-${rang}.bin` : `${String(rang).padStart(2, '0')}-${base}`;
}

export async function ecrireDossier(
  racine: string,
  commande: Commande,
  photos: readonly PhotoRecue[],
  jour: string,
): Promise<DossierEcrit> {
  const reference = nomDossier(commande.entreprise, jour);
  const chemin = path.join(racine, reference);
  await mkdir(chemin, { recursive: true });

  const fichiers: string[] = [];
  for (const [rang, photo] of photos.entries()) {
    const nom = nomSur(photo.nom, rang + 1);
    await writeFile(path.join(chemin, nom), photo.octets);
    fichiers.push(nom);
  }

  const resume = {
    reference,
    recue_le: new Date().toISOString(),
    prix_total_euros: prixTotal(commande.options),
    commande,
    photos: fichiers,
  };
  await writeFile(path.join(chemin, 'commande.json'), `${JSON.stringify(resume, null, 2)}\n`, 'utf8');

  return { reference, chemin, fichiers };
}

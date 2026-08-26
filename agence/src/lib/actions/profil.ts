'use server';

/*
 * Mise à jour du profil.
 *
 * La colonne `role` n'apparaît nulle part ici, et c'est intentionnel : le rôle
 * ne se modifie pas depuis l'application. Le schéma retire d'ailleurs cette
 * colonne des privilèges d'écriture de `authenticated`, si bien qu'un appel
 * forgé serait refusé par PostgreSQL et pas seulement par ce fichier.
 */
import { revalidatePath } from 'next/cache';

import { echec, journaliser, succes, type EtatFormulaire } from '@/lib/actions/etat';
import { exigerSession } from '@/lib/supabase/session';
import { analyser, schemaProfil } from '@/lib/validation';

export async function mettreAJourProfil(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = analyser(schemaProfil, donnees);

  if (!analyse.valide) {
    return echec('Vérifiez les champs signalés.', analyse.erreurs);
  }

  const { client, utilisateur } = await exigerSession();

  try {
    const { error } = await client
      .from('profiles')
      .update({
        full_name: analyse.donnees.nomComplet,
        company_name: analyse.donnees.entreprise,
      })
      .eq('id', utilisateur.id);

    if (error) {
      return journaliser(error, "Le profil n'a pas pu être enregistré.");
    }
  } catch (cause) {
    return journaliser(cause, "Le profil n'a pas pu être enregistré.");
  }

  // La coque privée affiche le nom : la mise à jour doit redescendre jusqu'à la
  // barre latérale, pas seulement dans le formulaire.
  revalidatePath('/', 'layout');
  return succes('Profil enregistré.');
}

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
import { redirect } from 'next/navigation';

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

/*
 * Effacement du compte — article 17 du RGPD.
 *
 * L'action ne supprime rien elle-même : elle appelle
 * `public.supprimer_mon_compte()`, une fonction du schéma qui ne prend aucun
 * paramètre et n'efface que `auth.uid()`. Rien de ce qui transite par ici ne
 * peut donc désigner le compte d'un autre — pas même une requête forgée, qui
 * n'aurait aucun champ où glisser un identifiant.
 *
 * Le reste part par les clés étrangères, en cascade : profil, projets, tout.
 */
export async function supprimerMonCompte(): Promise<void> {
  const { client } = await exigerSession();

  try {
    const { error } = await client.rpc('supprimer_mon_compte');

    if (error) {
      console.error('[socle-agence] effacement', error.message);
      return;
    }
  } catch (cause) {
    console.error('[socle-agence]', cause);
    return;
  }

  /*
   * Déconnexion **locale** : le compte n'existe plus, donc le jeton non plus.
   * Une déconnexion ordinaire irait le présenter au serveur d'authentification,
   * qui répondrait par une erreur — et l'utilisateur resterait avec un cookie
   * de session pointant sur un compte effacé, c'est-à-dire une application qui
   * paraît fonctionner jusqu'au premier écran vide.
   */
  await client.auth.signOut({ scope: 'local' });

  revalidatePath('/', 'layout');
  redirect('/');
}

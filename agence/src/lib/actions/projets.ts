'use server';

/*
 * Actions sur les projets.
 *
 * Chaque action redemande la session avec `exigerSession()` : la RLS de
 * PostgreSQL empêche déjà d'écrire la ligne d'un autre, mais elle ne dit rien
 * d'un appel forgé qui viserait une action sans être connecté. Les deux
 * barrières se complètent — l'une protège les données, l'autre l'application.
 *
 * `user_id` est toujours pris dans la session, jamais dans le formulaire. Une
 * valeur venue du client serait de toute façon rejetée par le WITH CHECK de la
 * politique, mais le refus arriverait sous forme d'erreur PostgREST illisible.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { echec, journaliser, succes, type EtatFormulaire } from '@/lib/actions/etat';
import { exigerSession } from '@/lib/supabase/session';
import { analyser, schemaProjet } from '@/lib/validation';

/** Chemins à rafraîchir après toute écriture : liste, tableau de bord. */
function invaliderListes(): void {
  revalidatePath('/tableau-de-bord');
  revalidatePath('/projets');
}

export async function creerProjet(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = analyser(schemaProjet, donnees);

  if (!analyse.valide) {
    return echec('Vérifiez les champs signalés.', analyse.erreurs);
  }

  const { client, utilisateur } = await exigerSession();
  let identifiant: string;

  try {
    const { data, error } = await client
      .from('projects')
      .insert({
        user_id: utilisateur.id,
        title: analyse.donnees.titre,
        description: analyse.donnees.description,
        status: analyse.donnees.statut,
        amount_estimated: analyse.donnees.montant,
      })
      .select('id')
      .single();

    if (error || !data) {
      return journaliser(error, "Le projet n'a pas pu être enregistré.");
    }

    identifiant = data.id;
  } catch (cause) {
    return journaliser(cause, "Le projet n'a pas pu être enregistré.");
  }

  invaliderListes();
  redirect(`/projets/${identifiant}`);
}

export async function mettreAJourProjet(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const identifiant = donnees.get('id');

  if (typeof identifiant !== 'string' || identifiant.length === 0) {
    return echec('Projet introuvable.');
  }

  const analyse = analyser(schemaProjet, donnees);

  if (!analyse.valide) {
    return echec('Vérifiez les champs signalés.', analyse.erreurs);
  }

  const { client, utilisateur } = await exigerSession();

  try {
    const { data, error } = await client
      .from('projects')
      .update({
        title: analyse.donnees.titre,
        description: analyse.donnees.description,
        status: analyse.donnees.statut,
        amount_estimated: analyse.donnees.montant,
      })
      .eq('id', identifiant)
      // Redondant avec la RLS, et volontairement : sans cette clause, viser le
      // projet d'un autre renverrait « 0 ligne modifiée », que rien ne
      // distinguerait d'un projet supprimé entre-temps.
      .eq('user_id', utilisateur.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return journaliser(error, "Les modifications n'ont pas pu être enregistrées.");
    }

    if (!data) {
      return echec("Ce projet n'existe plus.");
    }
  } catch (cause) {
    return journaliser(cause, "Les modifications n'ont pas pu être enregistrées.");
  }

  invaliderListes();
  revalidatePath(`/projets/${identifiant}`);
  return succes('Projet enregistré.');
}

export async function supprimerProjet(donnees: FormData): Promise<void> {
  const identifiant = donnees.get('id');

  if (typeof identifiant !== 'string' || identifiant.length === 0) {
    return;
  }

  const { client, utilisateur } = await exigerSession();

  try {
    const { error } = await client
      .from('projects')
      .delete()
      .eq('id', identifiant)
      .eq('user_id', utilisateur.id);

    if (error) {
      console.error('[socle-agence]', error);
      return;
    }
  } catch (cause) {
    console.error('[socle-agence]', cause);
    return;
  }

  invaliderListes();
  redirect('/projets');
}

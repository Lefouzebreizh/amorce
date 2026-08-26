'use server';

/*
 * Actions d'authentification.
 *
 * Une Server Action est une route POST publique : elle est atteignable sans
 * passer par l'interface. Tout ce qui suit revalide donc ses entrées et
 * redemande la session, sans jamais faire confiance à ce que le formulaire
 * prétend.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AuthError } from '@supabase/supabase-js';

import { echec, journaliser, succes, type EtatFormulaire } from '@/lib/actions/etat';
import { lireUrlDuSite } from '@/lib/env';
import { creerClientServeur } from '@/lib/supabase/server';
import { lireSession } from '@/lib/supabase/session';
import { analyser, schemaConnexion, schemaInscription } from '@/lib/validation';

const APRES_CONNEXION = '/tableau-de-bord';

export async function seConnecter(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = analyser(schemaConnexion, donnees);

  if (!analyse.valide) {
    return echec('Vérifiez les champs signalés.', analyse.erreurs);
  }

  const destination = destinationSure(donnees.get('suivant'));

  try {
    const client = await creerClientServeur();
    const { error } = await client.auth.signInWithPassword({
      email: analyse.donnees.email,
      password: analyse.donnees.motDePasse,
    });

    if (error) {
      return echec(traduireErreurAuth(error));
    }
  } catch (cause) {
    return journaliser(cause, "Connexion impossible pour l'instant. Réessayez dans un instant.");
  }

  // La coque privée affiche le nom de l'utilisateur : sans cette invalidation,
  // elle resterait rendue avec l'état « déconnecté » du visiteur précédent.
  revalidatePath('/', 'layout');
  redirect(destination);
}

export async function sInscrire(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = analyser(schemaInscription, donnees);

  if (!analyse.valide) {
    return echec('Vérifiez les champs signalés.', analyse.erreurs);
  }

  try {
    const client = await creerClientServeur();
    const { data, error } = await client.auth.signUp({
      email: analyse.donnees.email,
      password: analyse.donnees.motDePasse,
      options: {
        // Ces métadonnées alimentent le profil : le trigger `handle_new_user`
        // les recopie dans `public.profiles` à la création du compte.
        data: {
          full_name: analyse.donnees.nomComplet,
          company_name: analyse.donnees.entreprise,
        },
        emailRedirectTo: `${lireUrlDuSite()}/auth/confirmer`,
      },
    });

    if (error) {
      return echec(traduireErreurAuth(error));
    }

    // Quand la confirmation par courriel est active, Supabase renvoie un
    // utilisateur sans session : le compte n'est pas encore utilisable.
    if (data.session === null) {
      return succes(
        'Compte créé. Ouvrez le courriel de confirmation pour activer votre accès.',
      );
    }
  } catch (cause) {
    return journaliser(cause, "Création du compte impossible pour l'instant. Réessayez dans un instant.");
  }

  revalidatePath('/', 'layout');
  redirect(APRES_CONNEXION);
}

export async function seDeconnecter(): Promise<void> {
  const session = await lireSession();

  if (session) {
    await session.client.auth.signOut();
  }

  revalidatePath('/', 'layout');
  redirect('/connexion');
}

/**
 * N'accepte qu'un chemin interne. Reprendre tel quel le paramètre `suivant`
 * ouvrirait une redirection vers un domaine tiers : le lien de connexion,
 * légitime en apparence, déposerait l'utilisateur sur une copie du site.
 */
function destinationSure(valeur: FormDataEntryValue | null): string {
  if (typeof valeur !== 'string') {
    return APRES_CONNEXION;
  }

  const estCheminInterne =
    valeur.startsWith('/') && !valeur.startsWith('//') && !valeur.includes('\\');

  return estCheminInterne ? valeur : APRES_CONNEXION;
}

/**
 * Les messages de Supabase Auth sont en anglais et parfois techniques. Les
 * seuls cas qu'un utilisateur peut corriger sont traduits ; le reste est
 * journalisé et présenté comme un incident.
 */
function traduireErreurAuth(erreur: AuthError): string {
  switch (erreur.code) {
    case 'invalid_credentials':
      return 'Adresse électronique ou mot de passe incorrect.';
    case 'email_not_confirmed':
      return "Ce compte n'est pas encore confirmé. Ouvrez le courriel reçu à l'inscription.";
    case 'user_already_exists':
    case 'email_exists':
      return 'Un compte existe déjà avec cette adresse.';
    case 'weak_password':
      return 'Mot de passe trop simple : allongez-le ou variez les caractères.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Trop de tentatives. Patientez une minute avant de réessayer.';
    case 'signup_disabled':
      return "Les inscriptions sont fermées sur ce projet.";
    default:
      console.error('[socle-agence] auth', erreur.code, erreur.message);
      return "Authentification indisponible pour l'instant. Réessayez dans un instant.";
  }
}

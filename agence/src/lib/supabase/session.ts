/*
 * Session côté serveur.
 *
 * Toute la sécurité applicative passe par ces deux fonctions : une Server
 * Action est une route POST publique, atteignable sans passer par l'interface.
 * Le garde de `proxy.ts` ne suffit donc pas — il redirige un navigateur, il
 * n'arrête pas une requête forgée. Chaque action et chaque page privée
 * redemande l'utilisateur ici.
 *
 * `getUser()` et non `getSession()` : `getSession()` se contente de lire le
 * cookie, que n'importe qui peut fabriquer ; `getUser()` fait valider le jeton
 * par le serveur d'authentification.
 */
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { creerClientServeur, type ClientSupabase } from '@/lib/supabase/server';
import type { Profil } from '@/lib/types';

export type Session = {
  client: ClientSupabase;
  utilisateur: User;
};

/** Renvoie la session, ou `null` si personne n'est connecté. */
export async function lireSession(): Promise<Session | null> {
  const client = await creerClientServeur();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return { client, utilisateur: data.user };
}

/**
 * Renvoie la session ou renvoie l'appelant vers la page de connexion.
 * À utiliser en tête de chaque page privée et de chaque Server Action.
 */
export async function exigerSession(): Promise<Session> {
  const session = await lireSession();

  if (!session) {
    redirect('/connexion');
  }

  return session;
}

/**
 * Profil de l'utilisateur connecté. Le trigger d'inscription garantit qu'il
 * existe ; il peut malgré tout manquer si le schéma a été posé après la
 * création du compte, d'où le `null` possible plutôt qu'une erreur.
 */
export async function lireProfil(session: Session): Promise<Profil | null> {
  const { data } = await session.client
    .from('profiles')
    .select('*')
    .eq('id', session.utilisateur.id)
    .maybeSingle();

  return data;
}

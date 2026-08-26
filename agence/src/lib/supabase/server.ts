/*
 * Client Supabase pour le rendu serveur (composants serveur, Server Actions,
 * gestionnaires de route).
 *
 * Un client est créé par requête, jamais partagé : il porte les cookies de
 * session de l'appelant, et un client partagé ferait fuiter la session d'un
 * utilisateur vers la requête d'un autre.
 */
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { lireConfigSupabase } from '@/lib/env';
import type { Database } from '@/lib/types';

export type ClientSupabase = SupabaseClient<Database>;

export async function creerClientServeur(): Promise<ClientSupabase> {
  const { url, cleAnonyme } = lireConfigSupabase();
  const stockage = await cookies();

  return createServerClient<Database>(url, cleAnonyme, {
    cookies: {
      getAll() {
        return stockage.getAll();
      },
      setAll(cookiesAPoser) {
        try {
          for (const { name, value, options } of cookiesAPoser) {
            stockage.set(name, value, options);
          }
        } catch {
          // Un composant serveur ne peut pas écrire de cookie : Next.js lève
          // ici. Ce n'est pas une panne — c'est `proxy.ts` qui rafraîchit la
          // session et réécrit les cookies sur la réponse. Laisser l'exception
          // remonter afficherait une erreur à chaque page rendue pendant qu'un
          // jeton expire.
        }
      },
    },
  });
}

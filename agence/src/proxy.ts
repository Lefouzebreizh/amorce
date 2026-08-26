/*
 * Point d'entrée exécuté avant chaque requête. Depuis Next.js 16, le fichier
 * s'appelle `proxy.ts` et non plus `middleware.ts` ; la fonction exportée doit
 * porter le nom `proxy`.
 *
 * La logique vit dans `lib/supabase/proxy.ts` : ce fichier ne fait que la
 * brancher et déclarer sur quels chemins elle s'exécute.
 */
import type { NextRequest } from 'next/server';

import { actualiserSession } from '@/lib/supabase/proxy';

export async function proxy(requete: NextRequest) {
  return actualiserSession(requete);
}

export const config = {
  matcher: [
    /*
     * Tout sauf les fichiers servis tels quels. Faire tourner le
     * rafraîchissement de session sur chaque image d'une page, c'est autant
     * d'appels au serveur d'authentification pour rien.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};

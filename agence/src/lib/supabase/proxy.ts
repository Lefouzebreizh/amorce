/*
 * Rafraîchissement de session et garde de navigation, exécutés avant chaque
 * rendu (voir `src/proxy.ts` — Next.js 16 a renommé le middleware en proxy).
 *
 * Deux raisons de passer par là plutôt que par les seules pages :
 *
 *   1. Un jeton d'accès expire toutes les heures. Un composant serveur ne peut
 *      pas écrire de cookie ; sans ce passage, le jeton rafraîchi ne serait
 *      jamais renvoyé au navigateur et l'utilisateur serait déconnecté au
 *      bout d'une heure d'onglet ouvert.
 *   2. Rediriger un visiteur non connecté ici évite d'afficher la coque privée
 *      une fraction de seconde avant de le renvoyer.
 *
 * Cette redirection est un confort de navigation, **pas** un contrôle d'accès :
 * la barrière est la RLS de PostgreSQL, doublée de `exigerSession()` dans
 * chaque action.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { lireConfigSupabase } from '@/lib/env';
import { PAGE_NOUVEAU_MOT_DE_PASSE } from '@/lib/navigation';
import type { Database } from '@/lib/types';

/*
 * Espaces qui exigent une session. Le choix d'un nouveau mot de passe en fait
 * partie : le lien de récupération ouvre une session avant d'y mener, et sans
 * elle la page n'a personne à modifier.
 */
const PREFIXES_PRIVES = [
  '/tableau-de-bord',
  '/projets',
  '/compte',
  '/administration',
  PAGE_NOUVEAU_MOT_DE_PASSE,
];

/** Pages d'authentification, sans intérêt pour qui est déjà connecté. */
const PAGES_AUTH = ['/connexion', '/inscription', '/mot-de-passe-oublie'];

export async function actualiserSession(requete: NextRequest): Promise<NextResponse> {
  const { url, cleAnonyme } = lireConfigSupabase();

  let reponse = NextResponse.next({ request: requete });

  const supabase = createServerClient<Database>(url, cleAnonyme, {
    cookies: {
      getAll() {
        return requete.cookies.getAll();
      },
      setAll(cookiesAPoser, entetes) {
        // Les cookies sont écrits deux fois : sur la requête, pour que le rendu
        // qui suit voie déjà le jeton neuf, et sur la réponse, pour que le
        // navigateur le conserve.
        for (const { name, value } of cookiesAPoser) {
          requete.cookies.set(name, value);
        }
        reponse = NextResponse.next({ request: requete });
        for (const { name, value, options } of cookiesAPoser) {
          reponse.cookies.set(name, value, options);
        }
        // En-têtes anti-cache fournis par la bibliothèque : une réponse qui
        // pose un cookie de session ne doit jamais être mise en cache par un
        // CDN, sous peine de servir la session d'un utilisateur à un autre.
        for (const [cle, valeur] of Object.entries(entetes)) {
          reponse.headers.set(cle, valeur);
        }
      },
    },
  });

  // Cet appel doit précéder toute décision : c'est lui qui déclenche le
  // rafraîchissement, donc l'écriture des cookies sur la réponse.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chemin = requete.nextUrl.pathname;
  const estPrive = PREFIXES_PRIVES.some(
    (prefixe) => chemin === prefixe || chemin.startsWith(`${prefixe}/`),
  );

  if (!user && estPrive) {
    const cible = requete.nextUrl.clone();
    cible.pathname = '/connexion';
    cible.search = '';
    // Mémoriser la page demandée : après connexion, l'utilisateur y retourne
    // au lieu d'atterrir sur un tableau de bord qu'il n'avait pas demandé.
    cible.searchParams.set('suivant', `${chemin}${requete.nextUrl.search}`);
    return rediriger(cible, reponse);
  }

  if (user && PAGES_AUTH.includes(chemin)) {
    const cible = requete.nextUrl.clone();
    cible.pathname = '/tableau-de-bord';
    cible.search = '';
    return rediriger(cible, reponse);
  }

  return reponse;
}

/**
 * Rediriger en conservant les cookies posés par le rafraîchissement : les
 * oublier revient à jeter le jeton neuf, et l'utilisateur boucle entre la page
 * demandée et la connexion.
 */
function rediriger(cible: URL, porteuse: NextResponse): NextResponse {
  const redirection = NextResponse.redirect(cible);

  for (const cookie of porteuse.cookies.getAll()) {
    redirection.cookies.set(cookie);
  }

  return redirection;
}

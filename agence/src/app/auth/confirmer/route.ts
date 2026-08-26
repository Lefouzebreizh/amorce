import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { destinationSure } from '@/lib/navigation';
import { creerClientServeur } from '@/lib/supabase/server';

/*
 * Retour du lien envoyé par courriel (confirmation d'inscription, changement
 * d'adresse, réinitialisation).
 *
 * Deux formes de lien coexistent selon la configuration du projet Supabase :
 * un `code` à échanger (flux PKCE) ou un `token_hash` à vérifier. Les deux sont
 * acceptés — un socle livré à des clients ne peut pas supposer laquelle est
 * active, et se tromper produit une inscription qui « ne marche pas » sans
 * autre indice qu'une page de connexion qui revient.
 *
 * Un gestionnaire de route peut écrire des cookies : c'est ici, et non dans une
 * page, que la session issue du lien est posée.
 *
 * Le paramètre `suivant` dit où déposer l'utilisateur ensuite — le parcours de
 * récupération l'envoie choisir un mot de passe plutôt que sur le tableau de
 * bord. Il est filtré comme partout ailleurs : un lien de courriel est
 * exactement le genre d'adresse qu'on fabrique pour autrui.
 */

const TYPES_ACCEPTES = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
] as const satisfies readonly EmailOtpType[];

function estTypeAccepte(valeur: string | null): valeur is EmailOtpType {
  return valeur !== null && (TYPES_ACCEPTES as readonly string[]).includes(valeur);
}

export async function GET(requete: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = requete.nextUrl;
  const code = searchParams.get('code');
  const empreinte = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const destination = destinationSure(searchParams.get('suivant'));

  try {
    const client = await creerClientServeur();

    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(destination, origin));
      }
      console.error('[socle-agence] confirmation', error.message);
    } else if (empreinte && estTypeAccepte(type)) {
      const { error } = await client.auth.verifyOtp({ type, token_hash: empreinte });
      if (!error) {
        return NextResponse.redirect(new URL(destination, origin));
      }
      console.error('[socle-agence] confirmation', error.message);
    }
  } catch (cause) {
    console.error('[socle-agence]', cause);
  }

  // Un lien expiré ou déjà utilisé n'est pas une panne : l'utilisateur doit
  // simplement se connecter, ou en redemander un.
  return NextResponse.redirect(new URL('/connexion?erreur=lien', origin));
}

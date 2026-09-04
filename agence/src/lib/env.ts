/*
 * Lecture des variables d'environnement.
 *
 * Les deux valeurs Supabase sont lues par leur nom littéral et non via un
 * `process.env[nom]` calculé : Next.js remplace les occurrences de
 * `process.env.NEXT_PUBLIC_…` à la compilation, et ce remplacement est
 * textuel. Un accès indexé compile, puis renvoie `undefined` dans le
 * navigateur — panne qui ne se voit qu'en production.
 */

export type ConfigSupabase = {
  url: string;
  cleAnonyme: string;
};

const MESSAGE_MANQUANT =
  "Configuration Supabase absente. Copier `.env.example` en `.env.local` et renseigner NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.";

export function lireConfigSupabase(): ConfigSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cleAnonyme = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !cleAnonyme) {
    throw new Error(MESSAGE_MANQUANT);
  }

  return { url, cleAnonyme };
}

export const MESSAGE_SITE_MANQUANT =
  "NEXT_PUBLIC_SITE_URL n'est pas déclarée. Sans elle, les liens de confirmation " +
  "et de réinitialisation envoyés par courriel pointent vers localhost : personne " +
  "ne peut créer de compte ni changer son mot de passe. La déclarer chez " +
  "l'hébergeur, avec l'adresse publique réelle du site.";

export const MESSAGE_SITE_INVALIDE =
  "NEXT_PUBLIC_SITE_URL doit être une adresse absolue, protocole compris " +
  '(https://exemple.fr). Une valeur relative produit un lien de courriel mort.';

/**
 * Adresse publique du site : c'est elle qui construit le lien de confirmation
 * d'inscription et celui de réinitialisation du mot de passe.
 *
 * Trois pièges, et ils se ressemblent : chacun laisse l'application se
 * construire, se déployer et s'afficher normalement, puis casse **le courriel**,
 * c'est-à-dire l'endroit où personne ne regarde.
 *
 * 1. **La variable absente.** Le repli sur `localhost` est juste en
 *    développement et mortel en production — le client reçoit un lien vers sa
 *    propre machine. Le repli ne vaut donc que hors production ; ailleurs, on
 *    lève, et le message nomme la variable.
 * 2. **La barre oblique finale.** `https://client.fr/` donne
 *    `https://client.fr//auth/confirmer`, que la liste blanche de redirections
 *    de Supabase compare au caractère près et refuse.
 * 3. **L'adresse sans protocole.** `client.fr` produit un lien relatif, mort
 *    dans un courriel. `new URL` est le seul contrôle qui le voie.
 */
export function lireUrlDuSite(): string {
  const declaree = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!declaree) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(MESSAGE_SITE_MANQUANT);
    }

    return 'http://localhost:3000';
  }

  let analysee: URL;

  try {
    analysee = new URL(declaree);
  } catch {
    throw new Error(MESSAGE_SITE_INVALIDE);
  }

  if (analysee.protocol !== 'http:' && analysee.protocol !== 'https:') {
    throw new Error(MESSAGE_SITE_INVALIDE);
  }

  // `origin` seul : il écarte d'un coup la barre finale, un chemin, une requête
  // et un fragment collés par mégarde dans la variable.
  return analysee.origin;
}

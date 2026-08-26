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

/**
 * Adresse publique du site, utilisée pour le lien de confirmation d'inscription.
 * En développement, l'absence de la variable ne doit pas bloquer : le port par
 * défaut est le bon dans 99 % des cas.
 */
export function lireUrlDuSite(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

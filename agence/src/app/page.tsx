import Link from 'next/link';
import { ArrowRight, LayoutDashboard, ShieldCheck, Zap } from 'lucide-react';

import { variantesBouton } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { lireSession } from '@/lib/supabase/session';

/*
 * Page d'accueil publique. Elle sert de vitrine et d'aiguillage : un visiteur
 * connu voit un bouton vers son espace, un visiteur inconnu voit comment
 * entrer. La redirection automatique est écartée volontairement — atterrir
 * ailleurs que sur la page demandée déroute plus qu'elle ne fait gagner.
 */
export default async function PageAccueil() {
  const session = await lireSession();

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">Socle Agence</span>
        <Link
          href={session ? '/tableau-de-bord' : '/connexion'}
          className={variantesBouton({ variante: 'fantome', taille: 'petite' })}
        >
          {session ? 'Mon espace' : 'Se connecter'}
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="text-sm font-medium text-primary">Espace client</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Vos projets, leur avancement et leur budget — au même endroit.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
          Créez vos fiches projet, suivez leur statut et gardez le montant estimé sous les
          yeux. Chaque compte ne voit que ses propres données.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={session ? '/tableau-de-bord' : '/inscription'}
            className={variantesBouton({ taille: 'grande' })}
          >
            {session ? 'Ouvrir le tableau de bord' : 'Créer un compte'}
            <ArrowRight aria-hidden />
          </Link>
          {session ? null : (
            <Link
              href="/connexion"
              className={variantesBouton({ variante: 'contour', taille: 'grande' })}
            >
              J&apos;ai déjà un compte
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-4 pb-10 sm:grid-cols-3">
        <Argument
          icone={<LayoutDashboard aria-hidden className="size-5 text-primary" />}
          titre="Un tableau de bord lisible"
          texte="Le nombre de projets, leur répartition par statut et le montant estimé en cours."
        />
        <Argument
          icone={<ShieldCheck aria-hidden className="size-5 text-primary" />}
          titre="Cloisonné par la base"
          texte="Les droits sont posés dans PostgreSQL : une donnée d'un autre compte n'est jamais servie."
        />
        <Argument
          icone={<Zap aria-hidden className="size-5 text-primary" />}
          titre="Rendu côté serveur"
          texte="Les pages arrivent déjà remplies, sans écran de chargement au premier affichage."
        />
      </section>
    </main>
  );
}

function Argument({
  icone,
  titre,
  texte,
}: {
  icone: React.ReactNode;
  titre: string;
  texte: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-6">
        {icone}
        <CardTitle className="text-base">{titre}</CardTitle>
        <CardDescription>{texte}</CardDescription>
      </CardContent>
    </Card>
  );
}

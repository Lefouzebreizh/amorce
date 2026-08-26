import type { Metadata } from 'next';
import Link from 'next/link';

import { FormulaireConnexion } from '@/components/formulaire-connexion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Connexion' };

export default async function PageConnexion({
  searchParams,
}: {
  // Depuis Next.js 15, `searchParams` est une promesse : la page ne peut pas
  // être rendue avant que la requête soit connue.
  searchParams: Promise<{ suivant?: string; erreur?: string }>;
}) {
  const { suivant, erreur } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Accédez à vos projets et à leur suivi.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {erreur === 'lien' ? (
          <p
            role="alert"
            className="rounded-md bg-warning/15 px-3 py-2 text-sm text-warning-foreground"
          >
            Ce lien de confirmation a expiré ou a déjà servi. Connectez-vous, ou créez à
            nouveau votre compte pour en recevoir un autre.
          </p>
        ) : null}

        <FormulaireConnexion suivant={suivant} />

        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            <Link
              href="/mot-de-passe-oublie"
              className="font-medium text-primary hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </p>
          <p>
            Pas encore de compte ?{' '}
            <Link href="/inscription" className="font-medium text-primary hover:underline">
              En créer un
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

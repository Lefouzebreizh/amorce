import type { Metadata } from 'next';
import Link from 'next/link';

import { FormulaireMotDePasseOublie } from '@/components/formulaire-mot-de-passe-oublie';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default function PageMotDePasseOublie() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe oublié</CardTitle>
        <CardDescription>
          Nous envoyons un lien qui ouvre directement le choix d&apos;un nouveau mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <FormulaireMotDePasseOublie />
        <p className="text-sm text-muted-foreground">
          <Link href="/connexion" className="font-medium text-primary hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

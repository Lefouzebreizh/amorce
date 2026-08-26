import type { Metadata } from 'next';
import Link from 'next/link';

import { FormulaireInscription } from '@/components/formulaire-inscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Créer un compte' };

export default function PageInscription() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un compte</CardTitle>
        <CardDescription>Deux minutes, et votre espace projet est ouvert.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <FormulaireInscription />
        <p className="text-sm text-muted-foreground">
          Déjà inscrit ?{' '}
          <Link href="/connexion" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

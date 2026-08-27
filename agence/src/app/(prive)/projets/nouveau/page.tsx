import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { FormulaireProjet } from '@/components/formulaire-projet';
import { variantesBouton } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { exigerSession } from '@/lib/supabase/session';

export const metadata: Metadata = { title: 'Nouveau projet' };

export default async function PageNouveauProjet() {
  // Cette page n'affiche aucune donnée : la garde ne protège rien ici. Elle est
  // là parce que c'est la seule page privée qui s'en passait, et qu'un motif
  // qui souffre une exception se recopie sur la page suivante — celle qui, elle,
  // affichera quelque chose.
  await exigerSession();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/projets"
        className={variantesBouton({ variante: 'lien', taille: 'petite' })}
      >
        <ArrowLeft aria-hidden />
        Retour aux projets
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau projet</CardTitle>
          <CardDescription>
            Tout est modifiable ensuite : commencez par le titre, affinez plus tard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormulaireProjet />
        </CardContent>
      </Card>
    </div>
  );
}

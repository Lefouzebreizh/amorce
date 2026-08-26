import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { BadgeStatut } from '@/components/badge-statut';
import { BoutonSupprimerProjet } from '@/components/bouton-supprimer-projet';
import { FormulaireProjet } from '@/components/formulaire-projet';
import { variantesBouton } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formaterDateHeure } from '@/lib/format';
import { lireProjet } from '@/lib/projets';
import { exigerSession } from '@/lib/supabase/session';

type Proprietes = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Proprietes): Promise<Metadata> {
  const { id } = await params;
  const session = await exigerSession();
  const projet = await lireProjet(session, id);

  return { title: projet?.title ?? 'Projet introuvable' };
}

export default async function PageProjet({ params }: Proprietes) {
  const { id } = await params;
  const session = await exigerSession();
  const projet = await lireProjet(session, id);

  // La RLS ne distingue pas « n'existe pas » de « ne vous appartient pas », et
  // c'est heureux : répondre « 404 » dans les deux cas empêche de deviner
  // l'existence d'un projet en essayant des identifiants.
  if (!projet) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/projets" className={variantesBouton({ variante: 'lien', taille: 'petite' })}>
        <ArrowLeft aria-hidden />
        Retour aux projets
      </Link>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <CardTitle className="truncate">{projet.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Modifié le {formaterDateHeure(projet.updated_at)}
            </p>
          </div>
          <BadgeStatut statut={projet.status} />
        </CardHeader>

        <CardContent>
          <FormulaireProjet projet={projet} />
        </CardContent>

        <CardFooter className="justify-between border-t border-border pt-6">
          <span className="text-xs text-muted-foreground">
            Créé le {formaterDateHeure(projet.created_at)}
          </span>
          <BoutonSupprimerProjet identifiant={projet.id} />
        </CardFooter>
      </Card>
    </div>
  );
}

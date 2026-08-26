import type { Metadata } from 'next';

import { FormulaireProfil } from '@/components/formulaire-profil';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formaterDateHeure } from '@/lib/format';
import { exigerSession, lireProfil } from '@/lib/supabase/session';
import { LIBELLES_ROLE } from '@/lib/types';

export const metadata: Metadata = { title: 'Mon compte' };

export default async function PageCompte() {
  const session = await exigerSession();
  const profil = await lireProfil(session);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vos informations d&apos;identité et le rôle qui vous est attribué.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>Elles servent à vous identifier dans l&apos;espace.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormulaireProfil profil={profil} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accès</CardTitle>
          <CardDescription>
            {/*
              Le rôle se lit, il ne se choisit pas : la colonne est retirée des
              droits d'écriture du client par le schéma SQL. Le montrer sans
              permettre de le changer est plus honnête qu'un champ désactivé.
            */}
            Le rôle est attribué par l&apos;agence. Écrivez-nous s&apos;il ne correspond pas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <Ligne intitule="Adresse électronique" valeur={session.utilisateur.email ?? '—'} />
          <Ligne
            intitule="Rôle"
            valeur={<Badge variante="information">{LIBELLES_ROLE[profil?.role ?? 'user']}</Badge>}
          />
          <Ligne intitule="Compte créé le" valeur={formaterDateHeure(session.utilisateur.created_at)} />
        </CardContent>
      </Card>
    </div>
  );
}

function Ligne({ intitule, valeur }: { intitule: string; valeur: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{intitule}</span>
      <span className="font-medium">{valeur}</span>
    </div>
  );
}

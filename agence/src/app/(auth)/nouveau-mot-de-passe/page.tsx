import type { Metadata } from 'next';

import { FormulaireNouveauMotDePasse } from '@/components/formulaire-nouveau-mot-de-passe';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { exigerSession } from '@/lib/supabase/session';

export const metadata: Metadata = { title: 'Nouveau mot de passe' };

export default async function PageNouveauMotDePasse() {
  // Le lien de récupération a ouvert une session : sans elle, il n'y a personne
  // à modifier, et la page renvoie vers la connexion plutôt que d'afficher un
  // formulaire qui échouera à l'envoi.
  const session = await exigerSession();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveau mot de passe</CardTitle>
        <CardDescription>
          Pour {session.utilisateur.email ?? 'votre compte'}. Vous resterez connecté ensuite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormulaireNouveauMotDePasse />
      </CardContent>
    </Card>
  );
}

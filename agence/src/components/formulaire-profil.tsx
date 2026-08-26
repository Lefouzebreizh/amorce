'use client';

import { useActionState } from 'react';

import { useRetourToast } from '@/components/retour-toast';
import { BoutonSoumettre } from '@/components/ui/bouton-soumettre';
import { Champ } from '@/components/ui/champ';
import { Input } from '@/components/ui/input';
import { ETAT_INITIAL } from '@/lib/actions/etat';
import { mettreAJourProfil } from '@/lib/actions/profil';
import type { Profil } from '@/lib/types';

export function FormulaireProfil({ profil }: { profil: Profil | null }) {
  const [etat, action] = useActionState(mettreAJourProfil, ETAT_INITIAL);

  useRetourToast(etat);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Champ
        nom="nomComplet"
        intitule="Nom et prénom"
        aide="Affiché dans la barre de navigation et sur vos échanges avec l'agence."
        erreur={etat.erreurs.nomComplet}
        obligatoire
      >
        {(proprietes) => (
          <Input autoComplete="name" defaultValue={profil?.full_name ?? ''} {...proprietes} />
        )}
      </Champ>

      <Champ
        nom="entreprise"
        intitule="Entreprise"
        aide="Facultatif. Laissez vide si vous êtes à votre compte."
        erreur={etat.erreurs.entreprise}
      >
        {(proprietes) => (
          <Input
            autoComplete="organization"
            defaultValue={profil?.company_name ?? ''}
            {...proprietes}
          />
        )}
      </Champ>

      {etat.statut === 'erreur' && etat.message ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {etat.message}
        </p>
      ) : null}

      <div>
        <BoutonSoumettre libelleEnCours="Enregistrement…">Enregistrer</BoutonSoumettre>
      </div>
    </form>
  );
}

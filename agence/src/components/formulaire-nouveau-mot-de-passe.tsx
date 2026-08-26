'use client';

import { useActionState } from 'react';

import { useRetourToast } from '@/components/retour-toast';
import { BoutonSoumettre } from '@/components/ui/bouton-soumettre';
import { Champ } from '@/components/ui/champ';
import { Input } from '@/components/ui/input';
import { definirMotDePasse } from '@/lib/actions/auth';
import { ETAT_INITIAL } from '@/lib/actions/etat';

export function FormulaireNouveauMotDePasse() {
  const [etat, action] = useActionState(definirMotDePasse, ETAT_INITIAL);

  useRetourToast(etat);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Champ
        nom="motDePasse"
        intitule="Nouveau mot de passe"
        aide="Huit caractères au minimum. Il remplace immédiatement l'ancien."
        erreur={etat.erreurs.motDePasse}
        obligatoire
      >
        {(proprietes) => <Input type="password" autoComplete="new-password" {...proprietes} />}
      </Champ>

      <Champ
        nom="confirmation"
        intitule="Confirmation"
        aide="La même chose, pour écarter la faute de frappe sur une saisie masquée."
        erreur={etat.erreurs.confirmation}
        obligatoire
      >
        {(proprietes) => <Input type="password" autoComplete="new-password" {...proprietes} />}
      </Champ>

      {etat.statut === 'erreur' && etat.message ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {etat.message}
        </p>
      ) : null}

      <BoutonSoumettre className="w-full" libelleEnCours="Enregistrement…">
        Changer mon mot de passe
      </BoutonSoumettre>
    </form>
  );
}

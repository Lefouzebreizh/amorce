'use client';

import { useActionState } from 'react';

import { useRetourToast } from '@/components/retour-toast';
import { BoutonSoumettre } from '@/components/ui/bouton-soumettre';
import { Champ } from '@/components/ui/champ';
import { Input } from '@/components/ui/input';
import { demanderReinitialisation } from '@/lib/actions/auth';
import { ETAT_INITIAL } from '@/lib/actions/etat';

export function FormulaireMotDePasseOublie() {
  const [etat, action] = useActionState(demanderReinitialisation, ETAT_INITIAL);

  useRetourToast(etat);

  if (etat.statut === 'succes') {
    return (
      <p
        role="status"
        className="rounded-md bg-success/10 px-4 py-3 text-sm font-medium text-success"
      >
        {etat.message}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Champ
        nom="email"
        intitule="Adresse électronique"
        aide="Celle de votre compte. Le lien reçu reste valable une heure."
        erreur={etat.erreurs.email}
        obligatoire
      >
        {(proprietes) => (
          <Input type="email" autoComplete="email" placeholder="vous@exemple.fr" {...proprietes} />
        )}
      </Champ>

      {etat.statut === 'erreur' && etat.message ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {etat.message}
        </p>
      ) : null}

      <BoutonSoumettre className="w-full" libelleEnCours="Envoi…">
        Recevoir un lien
      </BoutonSoumettre>
    </form>
  );
}

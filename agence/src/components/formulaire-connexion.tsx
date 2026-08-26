'use client';

import { useActionState } from 'react';

import { useRetourToast } from '@/components/retour-toast';
import { BoutonSoumettre } from '@/components/ui/bouton-soumettre';
import { Champ } from '@/components/ui/champ';
import { Input } from '@/components/ui/input';
import { seConnecter } from '@/lib/actions/auth';
import { ETAT_INITIAL } from '@/lib/actions/etat';

export function FormulaireConnexion({ suivant }: { suivant?: string | undefined }) {
  const [etat, action] = useActionState(seConnecter, ETAT_INITIAL);

  useRetourToast(etat);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {/*
        Page demandée avant la redirection vers la connexion. La valeur est
        revalidée côté serveur : un chemin externe glissé ici est ignoré.
      */}
      {suivant ? <input type="hidden" name="suivant" value={suivant} /> : null}

      <Champ
        nom="email"
        intitule="Adresse électronique"
        aide="Celle utilisée à la création du compte."
        erreur={etat.erreurs.email}
        obligatoire
      >
        {(proprietes) => (
          <Input type="email" autoComplete="email" placeholder="vous@exemple.fr" {...proprietes} />
        )}
      </Champ>

      <Champ
        nom="motDePasse"
        intitule="Mot de passe"
        aide="Huit caractères au minimum."
        erreur={etat.erreurs.motDePasse}
        obligatoire
      >
        {(proprietes) => <Input type="password" autoComplete="current-password" {...proprietes} />}
      </Champ>

      {etat.statut === 'erreur' && etat.message ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {etat.message}
        </p>
      ) : null}

      <BoutonSoumettre className="w-full" libelleEnCours="Connexion…">
        Se connecter
      </BoutonSoumettre>
    </form>
  );
}

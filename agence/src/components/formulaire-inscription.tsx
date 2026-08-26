'use client';

import { useActionState } from 'react';

import { useRetourToast } from '@/components/retour-toast';
import { BoutonSoumettre } from '@/components/ui/bouton-soumettre';
import { Champ } from '@/components/ui/champ';
import { Input } from '@/components/ui/input';
import { sInscrire } from '@/lib/actions/auth';
import { ETAT_INITIAL } from '@/lib/actions/etat';

export function FormulaireInscription() {
  const [etat, action] = useActionState(sInscrire, ETAT_INITIAL);

  useRetourToast(etat);

  // Quand la confirmation par courriel est activée sur le projet Supabase,
  // l'inscription se termine sans session : le formulaire cède la place à la
  // consigne, sinon l'utilisateur réessaie en boucle.
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
        nom="nomComplet"
        intitule="Nom et prénom"
        aide="Affiché dans votre espace et sur vos échanges avec l'agence."
        erreur={etat.erreurs.nomComplet}
        obligatoire
      >
        {(proprietes) => <Input autoComplete="name" placeholder="Camille Martin" {...proprietes} />}
      </Champ>

      <Champ
        nom="entreprise"
        intitule="Entreprise"
        aide="Facultatif. Utile si plusieurs personnes d'une même société vous rejoignent."
        erreur={etat.erreurs.entreprise}
      >
        {(proprietes) => (
          <Input autoComplete="organization" placeholder="Martin & Associés" {...proprietes} />
        )}
      </Champ>

      <Champ
        nom="email"
        intitule="Adresse électronique"
        aide="Elle sert d'identifiant et reçoit le courriel de confirmation."
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
        aide="Huit caractères au minimum. Un gestionnaire de mots de passe fait très bien l'affaire."
        erreur={etat.erreurs.motDePasse}
        obligatoire
      >
        {(proprietes) => <Input type="password" autoComplete="new-password" {...proprietes} />}
      </Champ>

      {etat.statut === 'erreur' && etat.message ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {etat.message}
        </p>
      ) : null}

      <BoutonSoumettre className="w-full" libelleEnCours="Création…">
        Créer mon compte
      </BoutonSoumettre>
    </form>
  );
}

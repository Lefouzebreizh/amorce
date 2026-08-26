'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

import { Button, type ProprietesBouton } from '@/components/ui/button';

/*
 * Bouton d'envoi qui connaît l'état du formulaire qui l'entoure.
 *
 * `useFormStatus` lit cet état depuis le `<form>` parent : le composant n'a
 * donc rien à recevoir en propriété, et il est impossible d'oublier de lui
 * transmettre le « en cours ». Il doit rester un enfant du formulaire pour que
 * le crochet voie quelque chose.
 */
type ProprietesBoutonSoumettre = ProprietesBouton & {
  libelleEnCours?: string;
};

export function BoutonSoumettre({
  children,
  libelleEnCours = 'Envoi…',
  disabled,
  ...reste
}: ProprietesBoutonSoumettre) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled} {...reste}>
      {pending ? (
        <>
          <Loader2 aria-hidden className="animate-spin" />
          {libelleEnCours}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

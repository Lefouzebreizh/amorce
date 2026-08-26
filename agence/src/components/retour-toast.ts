'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import type { EtatFormulaire } from '@/lib/actions/etat';

/*
 * Transforme l'état renvoyé par une Server Action en notification.
 *
 * La comparaison porte sur l'identité de l'objet, pas sur son contenu :
 * `useActionState` en produit un nouveau à chaque envoi, si bien que deux
 * échecs identiques d'affilée déclenchent bien deux notifications. Comparer les
 * messages n'en montrerait qu'une, et l'utilisateur croirait son second essai
 * ignoré.
 */
export function useRetourToast(etat: EtatFormulaire): void {
  const precedent = useRef(etat);

  useEffect(() => {
    if (etat === precedent.current) {
      return;
    }

    precedent.current = etat;

    if (etat.statut === 'succes' && etat.message) {
      toast.success(etat.message);
    }

    if (etat.statut === 'erreur' && etat.message) {
      toast.error(etat.message);
    }
  }, [etat]);
}

'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BoutonSoumettre } from '@/components/ui/bouton-soumettre';
import { supprimerMonCompte } from '@/lib/actions/profil';

/*
 * Effacement du compte, en deux temps — comme la suppression d'un projet, mais
 * la confirmation est plus explicite parce que le geste l'est aussi.
 *
 * L'écrit qui accompagne le bouton n'est pas de la décoration juridique : le
 * RGPD demande que la personne sache ce qu'elle efface. Énumérer ce qui part,
 * et dire que rien ne revient, est ce qui transforme un bouton rouge en
 * consentement éclairé.
 */
export function BoutonSupprimerCompte() {
  const [confirme, setConfirme] = useState(false);

  if (!confirme) {
    return (
      <Button variante="contour" onClick={() => setConfirme(true)}>
        <Trash2 aria-hidden />
        Effacer mon compte
      </Button>
    );
  }

  return (
    <form action={supprimerMonCompte} className="flex flex-col gap-3">
      <p role="alert" className="text-sm text-muted-foreground">
        Cette action efface <strong>définitivement</strong> votre compte, votre profil et
        tous vos projets. Il n&apos;existe aucune sauvegarde et aucun retour en arrière.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <BoutonSoumettre variante="destructif" libelleEnCours="Effacement…">
          Oui, effacer définitivement
        </BoutonSoumettre>
        <Button variante="fantome" type="button" onClick={() => setConfirme(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

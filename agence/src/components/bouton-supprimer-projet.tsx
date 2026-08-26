'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BoutonSoumettre } from '@/components/ui/bouton-soumettre';
import { supprimerProjet } from '@/lib/actions/projets';

/*
 * Suppression en deux temps plutôt qu'en une fenêtre de confirmation.
 *
 * `window.confirm` bloque le fil principal et sort de la charte ; une boîte de
 * dialogue maison demanderait un piège à focus complet pour rester accessible.
 * Deux clics au même endroit suffisent à empêcher le geste involontaire, et
 * l'action reste un vrai formulaire — donc une vraie requête POST, même sans
 * JavaScript.
 */
export function BoutonSupprimerProjet({ identifiant }: { identifiant: string }) {
  const [confirme, setConfirme] = useState(false);

  if (!confirme) {
    return (
      <Button variante="fantome" taille="petite" onClick={() => setConfirme(true)}>
        <Trash2 aria-hidden />
        Supprimer
      </Button>
    );
  }

  return (
    <form action={supprimerProjet} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={identifiant} />
      <span role="alert" className="text-sm text-muted-foreground">
        Supprimer définitivement ce projet ?
      </span>
      <BoutonSoumettre variante="destructif" taille="petite" libelleEnCours="Suppression…">
        Oui, supprimer
      </BoutonSoumettre>
      <Button variante="fantome" taille="petite" type="button" onClick={() => setConfirme(false)}>
        Annuler
      </Button>
    </form>
  );
}

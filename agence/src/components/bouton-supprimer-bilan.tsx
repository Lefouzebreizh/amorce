'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import { supprimerBilan } from '@/lib/actions/patrimoine';
import { Button } from '@/components/ui/button';

export function BoutonSupprimerBilan({ identifiant, date }: { identifiant: string; date: string }) {
  const [confirmer, setConfirmer] = useState(false);

  if (!confirmer) {
    return (
      <Button type="button" variante="fantome" taille="icone" onClick={() => setConfirmer(true)} aria-label={`Supprimer le bilan du ${date}`}>
        <Trash2 aria-hidden />
      </Button>
    );
  }

  return (
    <form action={supprimerBilan} className="flex items-center gap-2">
      <input type="hidden" name="id" value={identifiant} />
      <Button type="button" variante="fantome" taille="petite" onClick={() => setConfirmer(false)}>Annuler</Button>
      <Button type="submit" variante="destructif" taille="petite">Confirmer</Button>
    </form>
  );
}

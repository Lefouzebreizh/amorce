'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/*
 * Dernier filet : une erreur non rattrapée pendant le rendu atterrit ici.
 *
 * Le message d'origine n'est pas affiché — il cite des chemins de fichiers et
 * des noms de tables. Il est journalisé, et l'utilisateur reçoit une phrase
 * utile plus un bouton qui retente vraiment le rendu.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[socle-agence]', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Quelque chose s&apos;est mal passé</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        L&apos;incident a été enregistré. Réessayez : la plupart du temps, cela suffit.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">Référence : {error.digest}</p>
      ) : null}
      <Button onClick={reset}>Réessayer</Button>
    </main>
  );
}

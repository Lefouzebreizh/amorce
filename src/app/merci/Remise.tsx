'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ADRESSE_SERVEUR } from '@/licence/etat';
import { useLicence } from '@/licence/useLicence';

/**
 * Échange l'identifiant de session Stripe contre la clé, et la range.
 *
 * Le serveur rend **404 tant que le webhook n'est pas passé** — quelques
 * secondes de retard sur la redirection, c'est le cas normal. On réessaie donc
 * au lieu d'annoncer un échec à quelqu'un qui vient de payer, et c'est tout
 * l'intérêt d'avoir distingué ce code d'un refus côté serveur.
 */
const ESSAIS = 10;
const ATTENTE_MS = 2000;

type Etape =
  | { quoi: 'attente' }
  | { quoi: 'clé'; cle: string; rangee: boolean }
  | { quoi: 'echec'; message: string };

export function Remise() {
  const [etape, setEtape] = useState<Etape>({ quoi: 'attente' });
  const { enregistrer } = useLicence();
  /* La demande ne part qu'une fois : en développement, React monte deux fois, et
     deux séries de dix essais partiraient en parallèle sur le même paiement. */
  const lancee = useRef(false);

  const chercher = useCallback(async () => {
    const session = new URLSearchParams(window.location.search).get('session') ?? '';
    if (session === '') {
      return setEtape({
        quoi: 'echec',
        message: 'Cette adresse n’a pas d’identifiant de paiement. Ouvrez le lien reçu après votre achat.',
      });
    }
    if (ADRESSE_SERVEUR === '') {
      return setEtape({ quoi: 'echec', message: 'Aucun serveur de licence n’est réglé pour le moment.' });
    }

    for (let essai = 0; essai < ESSAIS; essai += 1) {
      let reponse: Response;
      try {
        reponse = await fetch(`${ADRESSE_SERVEUR}/remise?session=${encodeURIComponent(session)}`);
      } catch {
        // Coupure : on retente, c'est exactement ce que cette boucle est.
        await new Promise((s) => setTimeout(s, ATTENTE_MS));
        continue;
      }

      if (reponse.ok) {
        const { cle } = (await reponse.json()) as { cle?: string };
        if (typeof cle === 'string' && cle !== '') {
          /* `enregistrer` range la clé **et** la confronte au serveur : ce qu'il
             rend dit si elle est reconnue, pas seulement si le navigateur a bien
             voulu l'écrire. C'est la seule chose que l'acheteur veut savoir. */
          const etat = await enregistrer(cle);
          return setEtape({ quoi: 'clé', cle, rangee: etat.statut === 'pro' });
        }
      }
      /* 404 = le webhook n'est pas encore passé, on attend. Tout le reste est
         définitif : réessayer dix fois un 410 ne le changera pas en 200. */
      if (reponse.status !== 404) {
        return setEtape({
          quoi: 'echec',
          message:
            reponse.status === 410
              ? 'Ce paiement a été remboursé. Aucune clé n’est remise.'
              : 'Ce paiement n’a pas pu être lu. Écrivez-moi et je vous envoie votre clé à la main.',
        });
      }
      await new Promise((s) => setTimeout(s, ATTENTE_MS));
    }

    setEtape({
      quoi: 'echec',
      message:
        'Votre paiement est bien passé, mais la clé tarde. Gardez cette page ouverte et rechargez dans une minute — ou écrivez-moi, je vous l’envoie à la main.',
    });
  }, [enregistrer]);

  useEffect(() => {
    if (lancee.current) return;
    lancee.current = true;
    void chercher();
  }, [chercher]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-5 py-10 text-lg">
      <h1 className="text-3xl font-black">Merci.</h1>

      {etape.quoi === 'attente' && (
        <p aria-live="polite">
          Votre paiement est enregistré. Je récupère votre clé — quelques secondes.
        </p>
      )}

      {etape.quoi === 'clé' && (
        <>
          <p aria-live="polite">Voici votre clé. Elle est à vous, définitivement.</p>
          <p className="rounded-2xl border-2 border-current px-5 py-4 text-center font-mono text-xl font-bold break-all">
            {etape.cle}
          </p>
          <p>
            {etape.rangee
              ? 'Le studio la reconnaît déjà : vous n’avez rien à faire.'
              : 'Notez-la : le studio ne l’a pas encore reconnue, vous aurez à la coller.'}
          </p>
          {/* Recopiée à l'écran plutôt qu'envoyée : rien de ce qui touche à
              l'identité ne transite, et la clé se retire autant de fois qu'il
              faut depuis cette adresse tant que le paiement tient. */}
          <p className="text-base">
            Gardez-la quelque part. Cette page peut vous la redonner tant que
            l’adresse reçue après le paiement fonctionne.
          </p>
          <Link className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-current px-6 font-bold" href="/studio">
            Ouvrir le studio
          </Link>
        </>
      )}

      {etape.quoi === 'echec' && (
        <>
          <p aria-live="polite">{etape.message}</p>
          <Link className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-current px-6 font-bold" href="/studio">
            Ouvrir le studio
          </Link>
        </>
      )}
    </main>
  );
}

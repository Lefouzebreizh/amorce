'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type EtatLien = 'chargement' | 'pret' | 'invalide';

const MESSAGE_LIEN_INVALIDE =
  'Ce lien est absent ou a expiré. Reviens à l’accueil et demande un nouveau lien.';

function nettoyerUrlDeRecuperation() {
  window.history.replaceState({}, '', '/reinitialiser-code');
}

export default function ReinitialiserCode() {
  const routeur = useRouter();
  const [etatLien, setEtatLien] = useState<EtatLien>('chargement');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let actif = true;

    const rendrePret = (session: Session | null) => {
      if (!actif || !session) return;
      setEtatLien('pret');
      setErreur('');
      nettoyerUrlDeRecuperation();
    };

    const traiterEvenement = (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') {
        rendrePret(session);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(traiterEvenement);

    async function preparerRecuperation() {
      const parametres = new URLSearchParams(window.location.search);
      const codePkce = parametres.get('code');

      if (codePkce) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(codePkce);
        if (!actif) return;
        if (error || !data.session) {
          setEtatLien('invalide');
          return;
        }
        rendrePret(data.session);
        return;
      }

      // Le flux implicite est traité par le client Supabase lors de son
      // initialisation. getSession() attend cette initialisation et récupère
      // aussi le cas où PASSWORD_RECOVERY a été émis avant le montage React.
      const { data, error } = await supabase.auth.getSession();
      if (!actif) return;
      if (error || !data.session) {
        setEtatLien('invalide');
        return;
      }
      rendrePret(data.session);
    }

    void preparerRecuperation();

    return () => {
      actif = false;
      subscription.unsubscribe();
    };
  }, []);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    if (code.length < 12) {
      setErreur('Choisis au moins 12 caractères.');
      return;
    }
    if (code !== confirmation) {
      setErreur('Les deux codes ne correspondent pas.');
      return;
    }

    setEnCours(true);
    const { error } = await supabase.auth.updateUser({ password: code });
    setEnCours(false);
    if (error) {
      setErreur('Le lien n’est plus valide. Redemande-en un nouveau.');
      return;
    }
    routeur.replace('/coffre');
  }

  return (
    <main className="min-h-screen bg-[#071225] px-6 py-16 text-[#e8efff]">
      <section className="mx-auto max-w-lg rounded-3xl border border-cyan-200/30 bg-slate-950/60 p-7 shadow-2xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[.16em] text-cyan-200">
          Mon Tiroir Secret
        </p>
        <h1 className="text-4xl font-semibold">Choisis un nouveau mot de passe.</h1>

        {etatLien === 'chargement' && (
          <p className="mt-5 text-slate-300" role="status">
            Vérification sécurisée du lien…
          </p>
        )}

        {etatLien === 'invalide' && (
          <div className="mt-5 space-y-5">
            <p className="text-slate-300" role="alert">
              {MESSAGE_LIEN_INVALIDE}
            </p>
            <Link
              href="/"
              className="inline-flex rounded-xl border border-cyan-200/40 px-5 py-3 font-semibold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-200/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
            >
              Demander un nouveau lien
            </Link>
          </div>
        )}

        {etatLien === 'pret' && (
          <form onSubmit={enregistrer} className="mt-7 flex flex-col gap-4">
            <label htmlFor="code">Nouveau mot de passe</label>
            <input
              id="code"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-xl border border-slate-500 bg-slate-950 px-4 py-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              minLength={12}
              required
            />
            <label htmlFor="confirmation">Confirme-le</label>
            <input
              id="confirmation"
              name="new-password-confirmation"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="rounded-xl border border-slate-500 bg-slate-950 px-4 py-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              minLength={12}
              required
            />
            {erreur && (
              <p role="alert" className="text-rose-300">
                {erreur}
              </p>
            )}
            <button
              disabled={enCours}
              className="mt-2 rounded-xl bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 px-5 py-3 font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none"
            >
              {enCours ? 'Enregistrement…' : 'Enregistrer mon nouveau mot de passe'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

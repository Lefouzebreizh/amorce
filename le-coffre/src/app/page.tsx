'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function PageAccueil() {
  const routeur = useRouter();
  const [email, setEmail] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) routeur.replace('/coffre');
    });
  }, [routeur]);

  async function envoyerLien(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/coffre` : undefined },
    });
    setEnCours(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    setEnvoye(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-sm tracking-widest text-ink-soft uppercase">Le Coffre</p>
        <h1 className="mt-2 font-affiche text-4xl leading-tight">Tes papiers, tes échéances</h1>
        <p className="mt-4 text-ink-soft">
          Dépose tes documents administratifs — chiffrés entièrement dans ton navigateur avant
          d&apos;être envoyés. Ni nous, ni personne d&apos;autre, ne pouvons les lire sans ta phrase
          secrète. C&apos;est ce que ni Digiposte ni Google Drive ne te promettent.
        </p>
      </div>

      {envoye ? (
        <div className="rounded-2xl border border-line bg-paper-raised p-6">
          <p className="font-semibold">Lien envoyé.</p>
          <p className="mt-2 text-sm text-ink-soft">
            Regarde ta boîte mail (« {email} ») et clique sur le lien pour entrer — pas de mot de
            passe à retenir pour ton compte. Ta phrase secrète du coffre, elle, se choisit à
            l&apos;étape suivante et reste toujours entre toi et ton navigateur.
          </p>
        </div>
      ) : (
        <form onSubmit={envoyerLien} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm text-ink-soft">
            Ton adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-line bg-paper-raised px-4 py-3 text-ink outline-none focus:border-accent"
            placeholder="toi@exemple.fr"
          />
          {erreur && <p className="text-sm text-wine">{erreur}</p>}
          <button
            type="submit"
            disabled={enCours}
            className="rounded-xl bg-accent px-4 py-3 font-semibold text-paper transition hover:bg-accent-strong disabled:opacity-60"
          >
            {enCours ? 'Envoi…' : 'Recevoir un lien de connexion'}
          </button>
        </form>
      )}

      <p className="text-xs text-ink-soft">
        Aucun mot de passe de compte à retenir : un lien à usage unique par e-mail. La phrase
        secrète qui protège le contenu du coffre est une chose entièrement différente — elle
        n&apos;atteint jamais nos serveurs, et personne ne peut la récupérer si tu l&apos;oublies.
      </p>
    </main>
  );
}

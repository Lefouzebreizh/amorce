'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import styles from './accueil.module.css';

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
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.brand}>Mon Tiroir Secret</p>
          <span className={styles.signature}>Un abri signé Lefouzèbreizh</span>
        </div>
        <a href="#connexion" className={styles.accessLink}>Mon espace</a>
      </header>
      <div className={styles.content}>
        <section className={styles.intro} aria-labelledby="titre-accueil">
          <div className={styles.scene}>
            <Image src="/brand/bretagne-zebre-scene.webp" width={1200} height={400}
              sizes="(max-width: 900px) 100vw, 60vw" priority
              alt="Un zèbre en double exposition dans une côte bretonne imaginaire, entre océan, dolmen et phare." />
          </div>
          <p className={styles.eyebrow}>Tes papiers. Ta place pour souffler.</p>
          <h1 id="titre-accueil">Ton petit monde.<br /><span>À l&apos;abri.</span></h1>
          <p className={styles.description}>Un endroit pour déposer tes documents, les retrouver et garder tes échéances en vue. À ton rythme.</p>
          <ul className={styles.steps} aria-label="Les étapes du coffre">
            <li><span>01</span> Déposer tes papiers</li>
            <li><span>02</span> Retrouver l&apos;essentiel</li>
            <li><span>03</span> Avancer sereinement</li>
          </ul>
        </section>
        <section id="connexion" tabIndex={-1} className={styles.access} aria-labelledby="titre-connexion">
          <p className={styles.eyebrow}>Ton espace personnel</p>
          <h2 id="titre-connexion">Ouvre ton tiroir.</h2>
          <p className={styles.accessIntro}>Reçois un lien de connexion par e-mail. Aucun mot de passe de compte à retenir.</p>

      {envoye ? (
        <div className={styles.sent} role="status">
          <p className="font-semibold">Lien envoyé.</p>
          <p className="mt-2 text-sm text-ink-soft">
            Regarde ta boîte mail (« {email} ») et clique sur le lien pour entrer — pas de mot de
            passe à retenir pour ton compte. Ta phrase secrète du coffre, elle, se choisit à
            l&apos;étape suivante et reste toujours entre toi et ton navigateur.
          </p>
        </div>
      ) : (
        <form onSubmit={envoyerLien} className={styles.form} aria-busy={enCours}>
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
            className={styles.input}
            aria-invalid={!!erreur}
            aria-describedby={erreur ? 'erreur-connexion' : undefined}
            placeholder="toi@exemple.fr"
          />
          {erreur && <p id="erreur-connexion" role="alert" className={styles.error}>{erreur}</p>}
          <button
            type="submit"
            disabled={enCours}
            className={styles.submit}
          >
            {enCours ? 'Envoi…' : 'Recevoir un lien de connexion'}
          </button>
        </form>
      )}

          <div className={styles.privacy}>
            <h3>Ta phrase secrète protège le stockage.</h3>
            <p>Tu la choisis à l&apos;étape suivante. Elle chiffre les documents dans ton navigateur avant stockage. Garde-la précieusement : personne ne peut la récupérer.</p>
            <details>
              <summary>Et les fonctions d&apos;intelligence artificielle ?</summary>
              <p>Le classement automatique transmet les documents analysés en clair à notre serveur, puis au fournisseur d&apos;IA. L&apos;assistant transmet ta question et un résumé de tes papiers au fournisseur d&apos;IA via notre serveur.</p>
            </details>
          </div>
        </section>
      </div>
      <footer className={styles.footer}>Moins de papiers dans la tête. Plus de place pour la vie.</footer>
    </main>
  );
}

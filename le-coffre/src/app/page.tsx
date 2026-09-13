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
        <div className={styles.brandBlock}>
          <p className={styles.brand}>Mon Tiroir Secret</p>
          <span className={styles.signature}>Lefouzèbreizh Studio · accès privé</span>
        </div>
        <a href="#connexion" className={styles.accessLink}>Ouvrir mon espace <span aria-hidden="true">↗</span></a>
      </header>
      <div className={styles.content}>
        <section className={styles.intro} aria-labelledby="titre-accueil">
          <div className={styles.scene}>
            <Image
              src="/brand/coffre-breton-ouvert-v1.webp"
              fill
              sizes="100vw"
              priority
              alt="Un coffre-fort ouvert dans une grotte bretonne, donnant sur la mer et un phare."
            />
            <div className={styles.vignette} aria-hidden="true" />
            <div className={styles.grain} aria-hidden="true" />
            <div className={styles.lightSweep} aria-hidden="true" />
            <div className={styles.liveMark} aria-hidden="true">
              <span />
              Scène protégée
            </div>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Tes papiers n&apos;ont plus à te suivre partout.</p>
              <h1 id="titre-accueil">Un vrai lieu<br />pour <span>respirer.</span></h1>
              <p className={styles.description}>Dépose ce qui t&apos;encombre. Retrouve ce qui compte. Ton espace reste fermé au monde, ouvert sur l&apos;essentiel.</p>
              <ul className={styles.steps} aria-label="Les promesses du coffre">
                <li><span aria-hidden="true">⌁</span> Chiffré avant stockage</li>
                <li><span aria-hidden="true">◌</span> À ton rythme</li>
              </ul>
            </div>
            <p className={styles.sceneNote}>Le coffre est ouvert. La mer reste dehors.</p>
          </div>
        </section>
        <section id="connexion" tabIndex={-1} className={styles.access} aria-labelledby="titre-connexion">
          <div className={styles.accessHeading}>
            <p className={styles.eyebrow}>Accès personnel</p>
            <h2 id="titre-connexion">Entre quand tu es prêt.</h2>
          </div>
          <p className={styles.accessIntro}>Un lien arrive dans ta boîte mail. Pas de mot de passe à mémoriser.</p>

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

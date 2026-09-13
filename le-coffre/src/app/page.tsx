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
        <a href="#connexion" className={styles.accessLink}>Mon espace <span aria-hidden="true">→</span></a>
      </header>
      <div className={styles.content}>
        <section className={styles.intro} aria-labelledby="titre-accueil">
          <div className={styles.scene}>
            <Image src="/brand/coffre-breton-3d-v2.webp" width={1586} height={992}
              sizes="100vw" priority
              alt="Un coffre-fort ouvert en trois dimensions, installé dans un abri rocheux face à un phare breton." />
            <div className={styles.scanlines} aria-hidden="true" />
            <div className={styles.sceneCaption}>
              <span>LEFOUZÈBREIZH STUDIO</span>
              <strong>Coffre privé · Bretagne</strong>
            </div>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Tes papiers. Enfin à leur place.</p>
              <h1 id="titre-accueil">Ton petit monde.<br /><span>À l&apos;abri.</span></h1>
              <p className={styles.description}>Un espace privé pour déposer, retrouver et suivre l&apos;essentiel. Sans bruit. À ton rythme.</p>
              <a href="#connexion" className={styles.heroCta}>Ouvrir mon coffre <span aria-hidden="true">→</span></a>
              <ul className={styles.steps} aria-label="Les étapes du coffre">
                <li><span>01</span> Déposer</li>
                <li><span>02</span> Retrouver</li>
                <li><span>03</span> Respirer</li>
              </ul>
            </div>
          </div>
        </section>
        <section id="connexion" tabIndex={-1} className={styles.access} aria-labelledby="titre-connexion">
          <div className={styles.accessLead}>
            <p className={styles.eyebrow}>Ton espace personnel</p>
            <h2 id="titre-connexion">Entre.<br /><span>Tout est à sa place.</span></h2>
            <p className={styles.accessIntro}>Un lien par e-mail suffit. Aucun mot de passe de compte à retenir.</p>
            <p className={styles.securityNote}>Chiffrement dans ton navigateur avant stockage.</p>
          </div>

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

          <details className={styles.privacy}>
            <summary>Comment tes documents sont-ils protégés ?</summary>
            <div className={styles.privacyContent}>
              <h3>Ta phrase secrète protège le stockage.</h3>
              <p>Tu la choisis à l&apos;étape suivante. Elle chiffre les documents dans ton navigateur avant stockage. Garde-la précieusement : personne ne peut la récupérer.</p>
              <details>
              <summary>Et les fonctions d&apos;intelligence artificielle ?</summary>
              <p>Le classement automatique transmet les documents analysés en clair à notre serveur, puis au fournisseur d&apos;IA. L&apos;assistant transmet ta question et un résumé de tes papiers au fournisseur d&apos;IA via notre serveur.</p>
              </details>
            </div>
          </details>
        </section>
      </div>
      <footer className={styles.footer}>Moins de papiers dans la tête. Plus de place pour la vie.</footer>
    </main>
  );
}

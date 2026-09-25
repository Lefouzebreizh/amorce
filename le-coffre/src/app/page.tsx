'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  MESSAGE_CONNEXION_INDISPONIBLE,
  messageErreurConnexion,
} from '@/lib/connexion';
import { CoffreMer } from './coffre/CoffreMer';
import styles from './accueil.module.css';

const donneesStructurees = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Mon Tiroir Secret',
  url: 'https://coffre-puce.vercel.app/',
  description:
    'Un espace personnel pour retrouver ses papiers et ses échéances, avec chiffrement dans le navigateur avant stockage.',
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Navigateur web',
  inLanguage: 'fr-FR',
  creator: {
    '@type': 'Organization',
    name: 'Lefouzèbreizh Studio',
  },
  featureList: [
    'Chiffrement des documents dans le navigateur avant stockage',
    'Classement de papiers',
    'Suivi des échéances',
  ],
};

export default function PageAccueil() {
  const routeur = useRouter();
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [recuperationEnvoyee, setRecuperationEnvoyee] = useState(false);
  const [codeVisible, setCodeVisible] = useState(false);
  const champCode = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) routeur.replace('/coffre');
    });
  }, [routeur]);

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      const { data, error: erreurFonction } = await supabase.functions.invoke('connexion-coffre', {
        body: { identifiant: 'lefouzebreizh', motDePasse },
      });
      const messageErreur = await messageErreurConnexion(erreurFonction, data);
      if (messageErreur) {
        setErreur(messageErreur);
        setMotDePasse('');
        champCode.current?.focus();
        return;
      }
      if (!data?.access_token || !data?.refresh_token) {
        setErreur(MESSAGE_CONNEXION_INDISPONIBLE);
        return;
      }
      const { error: erreurSession } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (erreurSession) {
        setErreur(MESSAGE_CONNEXION_INDISPONIBLE);
        return;
      }
      routeur.replace('/coffre');
    } catch {
      setErreur(MESSAGE_CONNEXION_INDISPONIBLE);
    } finally {
      setEnCours(false);
    }
  }

  async function recupererCode() {
    setErreur('');
    setEnCours(true);
    const { data, error: erreurFonction } = await supabase.functions.invoke('recuperer-code-coffre', { body: { identifiant: 'lefouzebreizh' } });
    setEnCours(false);
    if (erreurFonction || data?.ok !== true) { setErreur('Impossible d’envoyer le lien pour le moment. Réessaie plus tard.'); return; }
    setRecuperationEnvoyee(true);
  }

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
      />
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <p className={styles.brand}>Mon Tiroir Secret</p>
          <span className={styles.signature}>Lefouzèbreizh Studio · accès privé</span>
        </div>
      </header>
      <div className={styles.content}>
        <section className={styles.intro} aria-labelledby="titre-accueil">
          <h1 id="titre-accueil" className="sr-only">Mon Tiroir Secret, espace privé lumineux</h1>
          <CoffreMer ouvert actionHref="#connexion" actionBadge="Entrer" actionLabel="Entrer dans mon espace" />
        </section>
        <section id="connexion" tabIndex={-1} className={styles.access} aria-labelledby="titre-connexion">
          <div className={styles.accessHeading}>
            <p className={styles.eyebrow}>Accès personnel</p>
            <h2 id="titre-connexion">Entre quand tu es prêt.</h2>
          </div>
          <p className={styles.accessIntro}>Entre ton code d&apos;accès. Aucun lien à attendre dans ta boîte mail.</p>

        <form onSubmit={seConnecter} className={styles.form} aria-busy={enCours} autoComplete="off">
          <input
            type="text"
            name="username"
            autoComplete="username"
            value="lefouzebreizh"
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
          />
          <label htmlFor="mot-de-passe" className="text-sm text-ink-soft">Ton code d&apos;accès</label>
          <div className={styles.inputWrap}>
            <input
              ref={champCode}
              id="mot-de-passe"
              name="code-acces-tiroir-secret"
              type={codeVisible ? 'text' : 'password'}
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={motDePasse}
              onChange={(e) => {
                setMotDePasse(e.target.value);
                if (erreur) setErreur('');
              }}
              className={styles.input}
              aria-invalid={!!erreur}
              aria-describedby={erreur ? 'conseil-code erreur-connexion' : 'conseil-code'}
              placeholder="Ton code"
            />
            <button
              type="button"
              className={styles.visibility}
              aria-pressed={codeVisible}
              aria-label={codeVisible ? 'Masquer le code' : 'Afficher le code'}
              onClick={() => setCodeVisible((visible) => !visible)}
            >
              {codeVisible ? 'Masquer' : 'Afficher'}
            </button>
          </div>
          <p id="conseil-code" className={styles.codeHint}>
            Sur ordinateur, vérifie le code si Chrome l&apos;a rempli automatiquement.
          </p>
          {erreur && <p id="erreur-connexion" role="alert" className={styles.error}>{erreur}</p>}
          <button
            type="submit"
            disabled={enCours}
            className={styles.submit}
          >
            {enCours ? 'Connexion…' : 'Entrer dans mon espace'}
          </button>
        </form>
        <button type="button" onClick={recupererCode} disabled={enCours} className={styles.recovery}>
          {recuperationEnvoyee ? 'Renvoyer le lien de récupération' : 'J’ai oublié mon code'}
        </button>
        {recuperationEnvoyee && (
          <p role="status" className={styles.recoveryStatus}>
            Le lien de récupération vient d&apos;être envoyé.
          </p>
        )}

          <div className={styles.privacy}>
            <h3>Ta phrase secrète protège le stockage.</h3>
            <p>Tu la choisis à l&apos;étape suivante. Elle chiffre les documents dans ton navigateur avant stockage. Garde-la précieusement : personne ne peut la récupérer.</p>
            <details>
              <summary>Et les fonctions d&apos;intelligence artificielle ?</summary>
              <p>Par défaut, le rangement reste dans ton navigateur. Si tu choisis plus tard une fonction d&apos;IA, l&apos;application t&apos;indiquera quelles informations doivent être transmises pour ce traitement.</p>
            </details>
          </div>
        </section>
      </div>
      <footer className={styles.footer}>Moins de papiers dans la tête. Plus de place pour la vie.</footer>
    </main>
  );
}

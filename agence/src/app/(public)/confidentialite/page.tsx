import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Données personnelles',
  robots: { index: true, follow: true },
};

/*
 * Gabarit d'information, au sens de l'article 13 du RGPD.
 *
 * Ce qui est écrit ici en dur décrit le socle tel qu'il est réellement : les
 * données qu'il collecte, où elles vont, et le fait que l'effacement s'exerce
 * depuis l'application. Ces trois points-là ne sont pas à compléter, ils sont
 * constatables dans le code — et les laisser vagues serait plus faux que de
 * les écrire.
 *
 * Le reste — qui est responsable du traitement, combien de temps les données
 * sont conservées, quelle base légale — dépend du client et de son activité.
 * Personne d'autre que lui ne peut le décider.
 */
export default function PageConfidentialite() {
  return (
    <article className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Données personnelles</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Information prévue par les articles 13 et 14 du règlement général sur la
          protection des données.
        </p>
      </header>

      <Bloc titre="Responsable du traitement">
        <APreciser>
          Identité et coordonnées du responsable, et de son délégué à la protection des
          données s&apos;il en a désigné un
        </APreciser>
      </Bloc>

      <Bloc titre="Données collectées">
        <Fait>
          Adresse électronique et mot de passe, nécessaires à la connexion. Le mot de
          passe n&apos;est jamais stocké en clair.
        </Fait>
        <Fait>
          Nom et, facultativement, entreprise — saisis à l&apos;inscription, modifiables
          depuis la page « Mon compte ».
        </Fait>
        <Fait>
          Les données que vous saisissez vous-même dans l&apos;application : titres,
          descriptions, statuts et montants de vos projets.
        </Fait>
      </Bloc>

      <Bloc titre="Finalités et base légale">
        <APreciser>
          À quoi servent ces données, et sur quelle base légale — exécution d&apos;un
          contrat, intérêt légitime, consentement
        </APreciser>
      </Bloc>

      <Bloc titre="Destinataires">
        <Fait>
          Les données sont hébergées par Supabase, sur des serveurs de l&apos;Union
          européenne lorsque le projet a été créé dans une région européenne.
        </Fait>
        <APreciser>
          Tout autre destinataire : prestataire d&apos;envoi de courriels, outil de
          facturation, mesure d&apos;audience
        </APreciser>
      </Bloc>

      <Bloc titre="Durée de conservation">
        <APreciser>
          Combien de temps chaque catégorie de données est conservée, et ce qui déclenche
          sa suppression
        </APreciser>
      </Bloc>

      <Bloc titre="Vos droits">
        <Fait>
          <strong>Effacement</strong> : la page{' '}
          <Link href="/compte" className="font-medium text-primary hover:underline">
            Mon compte
          </Link>{' '}
          efface définitivement votre compte, votre profil et tous vos projets, sans avoir
          à écrire à qui que ce soit.
        </Fait>
        <Fait>
          <strong>Rectification</strong> : votre nom et votre entreprise se modifient sur
          cette même page.
        </Fait>
        <APreciser>
          Comment exercer les droits d&apos;accès, d&apos;opposition et de portabilité —
          adresse électronique de contact et délai de réponse
        </APreciser>
        <Fait>
          Vous pouvez introduire une réclamation auprès de la CNIL, autorité de contrôle
          française.
        </Fait>
      </Bloc>
    </article>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold tracking-tight">{titre}</h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

/** Ce que le socle fait réellement : constatable dans le code, donc affirmé. */
function Fait({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-muted-foreground">{children}</li>;
}

/** Ce qui dépend du client : visible tant que ce n'est pas rempli. */
function APreciser({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm">
      <span className="mr-2 rounded bg-warning/20 px-1.5 py-0.5 text-xs font-medium text-warning-foreground">
        à compléter
      </span>
      {children}
    </li>
  );
}

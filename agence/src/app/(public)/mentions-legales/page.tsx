import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions légales',
  // Le socle interdit l'indexation par défaut : un espace client n'a rien à
  // faire dans un moteur de recherche. Ces deux pages-ci font exception —
  // elles existent précisément pour être trouvables.
  robots: { index: true, follow: true },
};

/*
 * Gabarit, pas texte de loi.
 *
 * L'article 6-III de la LCEN énumère ce qu'un site doit rendre accessible. Ce
 * fichier porte cette liste et rien d'autre : les valeurs appartiennent au
 * client, et personne d'autre que lui ne peut les fournir sans se tromper.
 *
 * Les repères `[à compléter]` sont volontairement visibles à l'écran. Un
 * gabarit qui se déguise en page finie part en production tel quel — celui-ci
 * se dénonce dès qu'on l'ouvre, et le contrôle de livraison le repère.
 */
export default function PageMentionsLegales() {
  return (
    <article className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mentions légales</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Informations rendues obligatoires par l&apos;article 6-III de la loi pour la
          confiance dans l&apos;économie numérique.
        </p>
      </header>

      <Bloc titre="Éditeur du site">
        <APreciser>Dénomination sociale ou nom et prénom</APreciser>
        <APreciser>Forme juridique et capital social, le cas échéant</APreciser>
        <APreciser>Adresse du siège social</APreciser>
        <APreciser>Adresse électronique et numéro de téléphone</APreciser>
        <APreciser>Numéro SIRET, et numéro de TVA intracommunautaire s&apos;il existe</APreciser>
        <APreciser>
          Numéro d&apos;inscription au RCS ou au répertoire des métiers, selon l&apos;activité
        </APreciser>
      </Bloc>

      <Bloc titre="Directeur de la publication">
        <APreciser>Nom et prénom de la personne responsable du contenu</APreciser>
      </Bloc>

      <Bloc titre="Hébergeur">
        <APreciser>Dénomination, adresse et téléphone de l&apos;hébergeur</APreciser>
        <p className="text-sm text-muted-foreground">
          L&apos;application est hébergée par la plateforme qui sert ce site ; la base de
          données est hébergée par Supabase. Renseigner ici les deux, avec leur adresse
          réelle.
        </p>
      </Bloc>

      <Bloc titre="Propriété intellectuelle">
        <APreciser>
          Qui détient les droits sur les textes, images et marques présentés ici
        </APreciser>
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

/*
 * Chaque valeur manquante se voit. Un `[à compléter]` discret, en gris clair,
 * serait exactement ce qu'on ne remarque pas à la relecture de dernière minute.
 */
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

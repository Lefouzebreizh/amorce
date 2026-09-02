import Link from 'next/link';

/**
 * La coque des pages de texte légal.
 *
 * Deux pages la partagent — mentions légales et conditions de vente — et c'est
 * la raison de son existence : recopier la même mise en page deux fois la ferait
 * diverger au premier ajustement, et personne ne saurait laquelle fait foi.
 *
 * Elle reprend les jetons du studio plutôt qu'un thème à part. Une page légale
 * qui ne ressemble pas au reste du site donne l'impression d'un document
 * rapporté, et c'est exactement ce qu'un acheteur inquiet remarque.
 */
export function PageTexte({
  titre,
  miseAJour,
  children,
}: {
  titre: string;
  miseAJour: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-ink text-mist">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 pb-20 pt-12 sm:pt-20">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center self-start text-base text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ← Retour à l’accueil
        </Link>

        <header className="flex flex-col gap-2 border-b border-edge pb-6">
          <h1 className="text-balance text-3xl font-bold leading-tight text-mist sm:text-4xl">
            {titre}
          </h1>
          <p className="text-base text-muted">Dernière mise à jour : {miseAJour}</p>
        </header>

        <div className="flex flex-col gap-8 text-lg leading-relaxed text-muted">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Un titre de section et son contenu, à l'échelle du reste du site. */
export function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold leading-tight text-mist">{titre}</h2>
      {children}
    </section>
  );
}

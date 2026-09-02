import Link from 'next/link';

/**
 * La page qu'un visiteur voit avant d'avoir entendu parler d'Amorce.
 *
 * ## Ce qu'elle corrige
 *
 * Il n'y en avait aucune : `src/app/page.tsx` rendait le studio directement.
 * Quelqu'un qui arrivait tombait sur une timeline vide, sans savoir ce que
 * c'était, ce que ça coûtait, ni pourquoi essayer. Une application finie et
 * muette vaut, commercialement, une application absente.
 *
 * ## Le bouton d'achat n'existe que s'il mène quelque part
 *
 * `/page-qui-vend` tient qu'un bouton mort est le seul défaut qui coûte de
 * l'argent comptant, sur quelqu'un de déjà convaincu : il appuie, rien ne se
 * passe, il part. Tant que `NEXT_PUBLIC_LIEN_ACHAT` est vide, le bloc d'achat
 * **disparaît** au lieu d'afficher un lien inerte — la même règle que le
 * téléphone absent d'`artisan-express`, et que la signature qui ne s'affiche
 * pas tant qu'aucun endroit où payer n'existe.
 *
 * L'action principale reste donc vraie en toute circonstance : ouvrir le
 * studio, qui marche aujourd'hui et gratuitement.
 *
 * ## Ce que le prix annonce, et ce qu'il n'annonce pas
 *
 * Les 49 € sont décidés, ils se disent. Ce qui n'est pas décidé — la date
 * d'ouverture de la vente — ne se dit pas : une promesse de calendrier qu'on
 * ne tient pas coûte plus que le silence.
 */

/** Le lien de paiement, ou rien. Voir le bloc de tête. */
const LIEN_ACHAT = process.env.NEXT_PUBLIC_LIEN_ACHAT ?? '';

/*
 * Les prix des outils comparables, relevés le 31/08/2026.
 *
 * Ils sont datés parce qu'ils bougent — CapCut a augmenté de 130 % en un an —
 * et une comparaison sans date se périme sans que personne ne s'en aperçoive.
 * Aucun n'est cité en mal : ce sont de bons outils, ils se paient autrement.
 */
const CONCURRENTS = [
  { nom: 'CapCut Pro', prix: '19,99 $', cadence: 'par mois' },
  { nom: 'Submagic', prix: '19 $', cadence: 'par mois' },
  { nom: 'Filmora', prix: '79,99 $', cadence: 'une fois' },
];

function Section({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-balance text-2xl font-semibold leading-tight text-mist sm:text-3xl">
        {titre}
      </h2>
      {children}
    </section>
  );
}

export function Accueil() {
  return (
    <div className="min-h-dvh bg-ink text-mist">
      {/*
        Le bandeau collant règle le contrôle « un bouton toujours à moins d'un
        écran » : quelqu'un décide d'essayer au milieu de la page et n'a pas à
        chercher où. Il vit dans la zone du pouce, et il laisse sa place sous le
        contenu pour ne rien recouvrir.
      */}
      <div className="mx-auto flex max-w-2xl flex-col gap-16 px-5 pb-32 pt-12 sm:gap-20 sm:pb-24 sm:pt-20">

        {/* --- Premier écran : promesse, preuve, prix, action --------------- */}
        <header className="flex flex-col gap-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Amorce
          </p>

          <h1 className="text-balance text-4xl font-bold leading-[1.08] text-mist sm:text-5xl">
            Monte ta vidéo verticale sans rien envoyer à personne.
          </h1>

          <p className="text-lg leading-relaxed text-muted">
            Tes rushes restent sur ton téléphone. Amorce les coupe, les
            sous-titre, les sonorise et te rend un fichier prêt à publier — sans
            compte, sans téléversement, sans serveur qui garde une copie.
          </p>

          <dl className="flex flex-wrap gap-x-8 gap-y-3 rounded-2xl bg-slab p-5">
            <div>
              <dt className="text-sm text-muted">Le studio complet</dt>
              <dd className="text-2xl font-semibold text-mist">49 € une fois</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Pour essayer</dt>
              <dd className="text-2xl font-semibold text-accent">Gratuit</dd>
            </div>
          </dl>

          <Link
            href="/studio"
            className="flex min-h-14 items-center justify-center rounded-2xl bg-accent px-6 text-lg font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Ouvrir le studio
          </Link>
          <p className="-mt-2 text-center text-base text-muted">
            Rien à installer. Ça démarre dans cet onglet.
          </p>
        </header>

        {/* --- Le problème, dans les mots de quelqu'un qui l'a vécu --------- */}
        <Section titre="Le montage n’est pas dur. C’est l’ordre des gestes qui abîme tout.">
          <p className="text-lg leading-relaxed text-muted">
            Tu poses tes plans, tu ajoutes la musique, et l’application te
            demande de recadrer après coup — le texte que tu venais d’écrire
            part sous le bouton « Suivre ». Tu recommences. Trois fois. Et à la
            fin tu publies quand même, parce qu’il est deux heures du matin.
          </p>
          <p className="text-lg leading-relaxed text-muted">
            Amorce est construit dans l’autre sens : ce qui décide du cadre se
            décide en premier, et rien de ce que tu poses ensuite ne peut plus
            le casser.
          </p>
        </Section>

        {/* --- Ce que ça fait, en trois gestes ------------------------------ */}
        <Section titre="Trois choses qu’il fait à ta place">
          <div className="flex flex-col gap-4">
            {[
              {
                titre: 'Il coupe',
                texte:
                  'Tu déposes tes rushes, il en fait un montage rythmé — plans raccourcis, ouverture qui avance, bruitages sur les coupes.',
              },
              {
                titre: 'Il place le texte où il survit',
                texte:
                  'Entre 12 et 45 % de la hauteur : l’intersection de ce que TikTok, Instagram et Facebook laissent libre. Le bloc entier, pas seulement sa première ligne.',
              },
              {
                titre: 'Il te dit ce qui ne va pas',
                texte:
                  'Une note de montage avant publication, avec le défaut nommé et le geste qui le corrige. Pas un score flatteur : elle plafonne tant qu’un vrai problème reste.',
              },
            ].map((bloc) => (
              <div key={bloc.titre} className="rounded-2xl bg-slab p-5">
                <h3 className="text-lg font-semibold text-mist">{bloc.titre}</h3>
                <p className="mt-1.5 text-lg leading-relaxed text-muted">
                  {bloc.texte}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* --- La preuve, en chiffres vérifiables --------------------------- */}
        <Section titre="Ce que le fichier qui sort vaut vraiment">
          <p className="text-lg leading-relaxed text-muted">
            Chaque export est mesuré, pas estimé. Ce sont les valeurs relevées
            sur le dernier fichier produit :
          </p>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-edge">
            {[
              ['Définition', '1080 × 1920'],
              ['Cadence', '30 i/s exactes'],
              ['Images perdues', 'aucune'],
              ['Pic sonore', 'sous −1 dBFS'],
            ].map(([label, valeur]) => (
              <div key={label} className="bg-slab p-4">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-mist">
                  {valeur}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-base leading-relaxed text-muted">
            L’export encode image par image, hors ligne. Il ne filme pas ton
            écran — c’est pourquoi un téléphone lent met plus longtemps sans
            jamais perdre une image.
          </p>
        </Section>

        {/* --- L'argument qui n'appartient qu'à ce studio ------------------- */}
        <Section titre="Aucun de tes fichiers ne part. Ce n’est pas une politique, c’est une absence.">
          <p className="text-lg leading-relaxed text-muted">
            Il n’y a pas de serveur qui reçoit tes vidéos. Pas de base de
            données. Pas de route qui accepte un fichier. Tout le montage se
            passe dans ton navigateur, et ce qui n’existe pas ne peut pas être
            piraté, revendu, ni changer d’avis dans trois ans.
          </p>
          <p className="text-lg leading-relaxed text-muted">
            La seule chose qui voyage, si tu achètes un jour, c’est ta clé de
            licence. Jamais un rush, jamais un export, jamais même le nom d’un
            fichier.
          </p>
        </Section>

        {/* --- Le prix, comparé pour de vrai ------------------------------- */}
        <Section titre="49 €, une seule fois">
          <p className="text-lg leading-relaxed text-muted">
            Ce que coûtent les outils qui font à peu près la même chose, relevé
            le 31 août 2026 :
          </p>
          <ul className="flex flex-col gap-px overflow-hidden rounded-2xl bg-edge">
            {CONCURRENTS.map((c) => (
              <li
                key={c.nom}
                className="flex items-baseline justify-between gap-4 bg-slab px-5 py-3.5"
              >
                <span className="text-lg text-muted">{c.nom}</span>
                <span className="text-lg font-semibold tabular-nums text-mist">
                  {c.prix}{' '}
                  <span className="text-base font-normal text-muted">
                    {c.cadence}
                  </span>
                </span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-4 bg-raised px-5 py-3.5">
              <span className="text-lg font-semibold text-mist">Amorce</span>
              <span className="text-lg font-semibold tabular-nums text-accent">
                49 €{' '}
                <span className="text-base font-normal text-muted">une fois</span>
              </span>
            </li>
          </ul>
          <p className="text-lg leading-relaxed text-muted">
            Ce sont de bons outils. Ils se paient tous les mois, et ils
            travaillent sur leurs serveurs. Amorce se paie une fois et travaille
            sur ton appareil — c’est la seule différence, et elle explique le
            prix dans les deux sens.
          </p>
        </Section>

        {/* --- Ce que l'offre libre donne, sans piège ----------------------- */}
        <Section titre="Ce que tu peux faire sans payer">
          <p className="text-lg leading-relaxed text-muted">
            Le montage entier : importer, couper, sous-titrer, sonoriser,
            exporter un fichier fini. Rien n’est bridé dans l’outil de travail.
          </p>
          <p className="text-lg leading-relaxed text-muted">
            Les 49 € ouvrent la pleine définition et l’export sans signature.
            Sur cet appareil, définitivement.
          </p>
        </Section>

        {/* --- L'honnêteté, qui est aussi un argument ----------------------- */}
        <Section titre="Ce qu’il ne fait pas, et je préfère te le dire avant">
          <ul className="flex flex-col gap-3 text-lg leading-relaxed text-muted">
            <li className="border-l-2 border-edge pl-4">
              Il ne regarde pas tes images. Il juge la structure d’un montage —
              rythme, coupes, ponctuation sonore — jamais ce qu’il y a dedans.
            </li>
            <li className="border-l-2 border-edge pl-4">
              Il ne transcrit pas ta voix. Les sous-titres se posent à la main
              ou depuis un gabarit.
            </li>
            <li className="border-l-2 border-edge pl-4">
              L’export MP4 demande Chrome ou Edge. Ailleurs, le fichier sort
              dans un autre format.
            </li>
          </ul>
        </Section>

        {/* --- La dernière marche ------------------------------------------ */}
        <Section titre="Essaie-le sur un rush, tu verras en deux minutes">
          <p className="text-lg leading-relaxed text-muted">
            Prends la vidéo la plus moche de ta galerie, celle que tu n’as
            jamais osé publier. C’est le meilleur test, et il ne t’engage à
            rien.
          </p>

          <Link
            href="/studio"
            className="flex min-h-14 items-center justify-center rounded-2xl bg-accent px-6 text-lg font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Ouvrir le studio
          </Link>

          {/*
            Le bloc d'achat n'apparaît que le jour où il mène quelque part.
            Voir le bloc de tête : un bouton mort coûte un client convaincu.
          */}
          {LIEN_ACHAT !== '' && (
            <a
              href={LIEN_ACHAT}
              className="flex min-h-14 items-center justify-center rounded-2xl border border-edge px-6 text-lg font-semibold text-mist transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Acheter Amorce — 49 €
            </a>
          )}
        </Section>

        <footer className="border-t border-edge pt-6 text-base leading-relaxed text-muted">
          Amorce est fait par une personne, pour des gens qui montent leurs
          vidéos seuls, souvent tard. Si quelque chose coince, écris — c’est la
          même personne qui répond.
        </footer>
      </div>

      {/* --- Le bandeau du pouce ------------------------------------------- */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-edge bg-slab/95 px-5 py-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <p className="flex-1 text-base leading-tight text-muted">
            Gratuit pour essayer
            <br />
            <span className="text-mist">49 € pour tout ouvrir</span>
          </p>
          <Link
            href="/studio"
            className="flex min-h-12 items-center rounded-xl bg-accent px-5 text-base font-semibold text-ink"
          >
            Ouvrir
          </Link>
        </div>
      </div>
    </div>
  );
}

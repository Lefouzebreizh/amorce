import { BOUTON_CONTOUR, BOUTON_PRINCIPAL } from '@/components/ui';
import { aUnTelephone, contact } from '@/lib/config';

export function Hero() {
  return (
    <header className="border-b border-edge bg-slab">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 pb-14 pt-10 sm:pt-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-14 md:pb-20">
        <div>
          <p className="text-base font-semibold uppercase tracking-[0.2em] text-accent">
            Maçon, couvreur, électricien
          </p>

          {/*
            `font-titre` — Bricolage Grotesque — et un cran de graisse au-dessus
            du reste de la page. C'est le seul endroit où la typographie a le
            droit de parler avant les mots : un artisan qui ouvre cette page au
            soleil doit savoir de quoi il s'agit avant d'avoir lu la ligne.
          */}
          <h1 className="mt-4 font-titre text-[2.5rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-encre sm:text-[4rem]">
            Tes réalisations sur un site clair, fait pour te rendre joignable.
          </h1>

          <p className="mt-4 text-2xl font-bold text-accent sm:text-3xl">
            300&nbsp;€ pour la création.
          </p>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ardoise">
            Sans abonnement à Artisan Express. Nom de domaine en supplément.
            Après réception de tes informations et photos, je te confirme un créneau de réalisation.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a className={BOUTON_PRINCIPAL} href="#offre">
              Je parle de mon site
            </a>
            {aUnTelephone ? (
              <a className={BOUTON_CONTOUR} href={contact.telephoneLien}>
                J’appelle&nbsp;{contact.telephoneAffiche}
              </a>
            ) : (
              <a className={BOUTON_CONTOUR} href="#formulaire">
                Je pose ma question d’abord
              </a>
            )}
          </div>

          {/*
            Trois repères et pas un slogan de plus : ce sont les trois questions
            que se pose un artisan devant une page de vente, dans cet ordre.
          */}
          <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-edge pt-6">
            {[
              ['Simple', 'un créneau confirmé après tes éléments'],
              ['0 €', 'd’abonnement à Artisan Express'],
              ['1', 'modification offerte'],
            ].map(([chiffre, quoi]) => (
              <div key={chiffre}>
                <dt className="font-titre text-3xl font-extrabold tracking-tight text-accent">
                  {chiffre}
                </dt>
                <dd className="mt-1 text-base leading-snug text-ardoise">{quoi}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="px-6 pt-2 sm:px-12 md:px-0">
          <div className="overflow-hidden rounded-2xl border border-violet-trait/60 bg-panel p-2 shadow-[0_20px_55px_rgba(64,224,208,0.08)]">
            <video
              className="aspect-video w-full rounded-xl object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              poster="/maison-artisan.webp"
              aria-label="Animation d’une maison qui se transforme"
            >
              <source src="/maison-artisan.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
    </header>
  );
}

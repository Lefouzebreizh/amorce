import { BOUTON_CONTOUR, BOUTON_PRINCIPAL } from '@/components/ui';
import { aUnTelephone, contact } from '@/lib/config';

export function Hero() {
  return (
    <header className="artisan-hero border-b border-edge bg-slab">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 pb-14 pt-10 sm:pt-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-14 md:pb-20">
        <div className="artisan-hero__copy">
          <p className="artisan-hero__eyebrow">
            <span aria-hidden="true" /> Sites pour artisans
          </p>

          {/*
            `font-titre` — Bricolage Grotesque — et un cran de graisse au-dessus
            du reste de la page. C'est le seul endroit où la typographie a le
            droit de parler avant les mots : un artisan qui ouvre cette page au
            soleil doit savoir de quoi il s'agit avant d'avoir lu la ligne.
          */}
          <h1 className="artisan-hero__title">
            Ton métier. <span>Ton style.</span><br />
            Ton téléphone sonne.
          </h1>

          <p className="artisan-hero__price">
            <strong>300&nbsp;€</strong> pour la création <span>· sans abonnement</span>
          </p>

          <p className="artisan-hero__lead">
            Tes photos, tes services et un moyen simple de te joindre, réunis dans
            une page qui te ressemble. Nom de domaine en supplément.
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
          <dl className="artisan-hero__proofs">
            {[
              ['Simple', 'tu envoies tes éléments'],
              ['0 €', 'd’abonnement'],
              ['1', 'modification offerte'],
            ].map(([chiffre, quoi]) => (
              <div key={chiffre}>
                <dt>
                  {chiffre}
                </dt>
                <dd>{quoi}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="artisan-hero__scene px-6 pt-2 sm:px-12 md:px-0">
          <p className="artisan-hero__scene-caption"><span>01</span> Une vitrine qui tient dans une main</p>
          <div className="artisan-hero__material artisan-hero__material--photos"><span>01</span><b>Photos</b><small>tes réalisations</small></div>
          <div className="artisan-hero__material artisan-hero__material--contact"><span>03</span><b>Contact</b><small>appel direct</small></div>
          <div className="artisan-hero__measure" aria-hidden="true"><span /> <span /></div>
          <div className="artisan-hero__frame overflow-hidden rounded-2xl border border-violet-trait/60 bg-panel p-2 shadow-[0_20px_55px_rgba(64,224,208,0.08)]">
            <video
              className="artisan-hero__film aspect-video w-full rounded-xl object-cover"
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

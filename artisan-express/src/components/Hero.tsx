'use client';

import Image from 'next/image';
import { useRef } from 'react';

import { BOUTON_CONTOUR, BOUTON_PRINCIPAL } from '@/components/ui';
import { aUnTelephone, contact } from '@/lib/config';

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);

  function eclaireLaScene(event: React.PointerEvent<HTMLElement>) {
    const hero = heroRef.current;
    if (!hero || event.pointerType === 'touch') return;

    const zone = hero.getBoundingClientRect();
    const x = (event.clientX - zone.left) / zone.width;
    const y = (event.clientY - zone.top) / zone.height;
    hero.style.setProperty('--pointer-x', `${x * 100}%`);
    hero.style.setProperty('--pointer-y', `${y * 100}%`);
    hero.style.setProperty('--scene-rotate-x', `${(0.5 - y) * 4}deg`);
    hero.style.setProperty('--scene-rotate-y', `${(x - 0.5) * 5}deg`);
  }

  function reposeLaScene() {
    const hero = heroRef.current;
    if (!hero) return;
    hero.style.removeProperty('--scene-rotate-x');
    hero.style.removeProperty('--scene-rotate-y');
  }

  return (
    <header
      ref={heroRef}
      className="artisan-hero border-b border-edge bg-slab"
      onPointerMove={eclaireLaScene}
      onPointerLeave={reposeLaScene}
    >
      <span className="artisan-hero__pointer" aria-hidden="true" />
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

          <div className="artisan-hero__offer-rail" aria-label="Les trois formules Artisan Express">\n            <span><b>Express</b><strong>300&nbsp;€</strong></span>\n            <span className="is-featured"><b>Métier</b><strong>690&nbsp;€</strong></span>\n            <span><b>Signature</b><strong>1&nbsp;290&nbsp;€</strong></span>\n          </div>

          <p className="artisan-hero__lead">
            Tes photos, tes services et un moyen simple de te joindre, réunis dans une présence qui te ressemble. Choisis le niveau de finition adapté à ton activité. Nom de domaine en supplément.
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
          <span className="artisan-hero__scene-orbit" aria-hidden="true" />
          <span className="artisan-hero__scene-beam" aria-hidden="true" />
          <p className="artisan-hero__scene-caption"><span>01</span> Une vitrine qui tient dans une main</p>
          <div className="artisan-hero__material artisan-hero__material--photos"><span>01</span><b>Photos</b><small>tes réalisations</small></div>
          <div className="artisan-hero__material artisan-hero__material--contact"><span>03</span><b>Contact</b><small>appel direct</small></div>
          <div className="artisan-hero__measure" aria-hidden="true"><span /> <span /></div>
          <div className="artisan-hero__frame overflow-hidden rounded-2xl border border-violet-trait/60 bg-panel p-2 shadow-[0_20px_55px_rgba(64,224,208,0.08)]">
            <Image
              className="artisan-hero__film aspect-video w-full rounded-xl object-cover"
              src="/atelier-artisan-express.webp"
              alt="Atelier d’artisan avec téléphone, plans techniques et matériaux"
              width={1672}
              height={941}
              preload
            />
          </div>
        </div>
      </div>
    </header>
  );
}

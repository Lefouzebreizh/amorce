import { AtelierIntro, MockupChantier } from '@/components/MockupChantier';
import { BOUTON_CONTOUR, BOUTON_PRINCIPAL } from '@/components/ui';
import { aUnTelephone, contact } from '@/lib/config';

export function Hero() {
  return (
    <header className="border-b border-edge bg-slab">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 pb-12 pt-7 sm:pt-12 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-14 md:pb-20">
        <div>
          <AtelierIntro />
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-accent sm:text-base">
            Sites pour artisans
          </p>

          <h1 className="mt-3 max-w-2xl font-titre text-[2.35rem] font-extrabold leading-[1.03] tracking-[-0.04em] text-encre sm:text-[4rem]">
            Montre ton savoir-faire. Fais-toi appeler.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ardoise">
            Tes photos, tes services et un moyen simple de te joindre — sur une page qui a ton style.
          </p>

          <p className="mt-4 text-xl font-bold text-accent sm:text-2xl">
            300&nbsp;€ · sans abonnement.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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

          <dl className="mt-7 grid max-w-lg grid-cols-3 gap-3 border-t border-edge pt-5">
            {[
              ['Simple', 'tu m’envoies tes éléments'],
              ['0 €', 'd’abonnement'],
              ['1', 'modification offerte'],
            ].map(([chiffre, quoi]) => (
              <div key={chiffre}>
                <dt className="font-titre text-2xl font-extrabold tracking-tight text-accent">{chiffre}</dt>
                <dd className="mt-1 text-sm leading-snug text-ardoise">{quoi}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="hidden px-6 pt-2 sm:px-12 md:block md:px-0">
          <MockupChantier />
        </div>
      </div>
    </header>
  );
}

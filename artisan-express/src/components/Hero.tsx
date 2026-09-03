import { MockupChantier } from '@/components/MockupChantier';
import { BOUTON_CONTOUR, BOUTON_PRINCIPAL } from '@/components/ui';
import { aUnTelephone, contact } from '@/lib/config';

export function Hero() {
  return (
    <header className="border-b border-edge bg-slab">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 pb-14 pt-10 sm:pt-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-14 md:pb-20">
        <div>
          <p className="text-base font-bold uppercase tracking-[0.18em] text-accent">
            Maçon, couvreur, électricien
          </p>

          <h1 className="mt-3 text-[2rem] font-bold leading-[1.15] tracking-tight text-encre sm:text-5xl">
            Ton site qui trouve des chantiers, livré en 48&nbsp;h.
          </h1>

          <p className="mt-4 text-2xl font-bold text-accent sm:text-3xl">
            300&nbsp;€ une fois. Pas d’abonnement.
          </p>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ardoise">
            Je suis artisan du code, ex-routier. Je te fais le site que j’aurais voulu avoir.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a className={BOUTON_PRINCIPAL} href="#offre">
              Je veux mon site en 48&nbsp;h
            </a>
            {aUnTelephone ? (
              <a className={BOUTON_CONTOUR} href={contact.telephoneLien}>
                Appeler {contact.telephoneAffiche}
              </a>
            ) : (
              <a className={BOUTON_CONTOUR} href="#formulaire">
                Poser ma question d’abord
              </a>
            )}
          </div>

          {/*
            Trois repères et pas un slogan de plus : ce sont les trois questions
            que se pose un artisan devant une page de vente, dans cet ordre.
          */}
          <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-edge pt-6">
            {[
              ['48 h', 'de délai, pas six semaines'],
              ['0 €', 'par mois, rien à résilier'],
              ['1', 'modification offerte'],
            ].map(([chiffre, quoi]) => (
              <div key={chiffre}>
                <dt className="text-2xl font-bold text-accent">{chiffre}</dt>
                <dd className="mt-1 text-base leading-snug text-ardoise">{quoi}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="px-6 pt-2 sm:px-12 md:px-0">
          <MockupChantier />
        </div>
      </div>
    </header>
  );
}

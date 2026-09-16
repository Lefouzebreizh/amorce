import Image from 'next/image';
import { BOUTON_PRINCIPAL, SECTION } from '@/components/ui';

export function QuiSuisJe() {
  return (
    <section className={SECTION} aria-labelledby="qui-suis-je-titre">
      <div className="rounded-3xl border border-edge bg-slab p-6 sm:p-8 lg:p-10">
        <div className="grid items-center gap-8 md:grid-cols-2 lg:gap-12">
          <div className="order-1 md:order-2">
            <div className="overflow-hidden rounded-2xl border border-violet-trait/60 bg-panel p-2">
              <Image
                src="/portrait-erwann.jpg"
                alt="Erwann, fondateur de Lefouzèbreizh Studio"
                width={1080}
                height={1080}
                sizes="(min-width: 1024px) 42vw, (min-width: 768px) 45vw, calc(100vw - 3rem)"
                quality={82}
                className="h-auto w-full rounded-xl object-cover"
              />
            </div>
          </div>

          <div className="order-2 md:order-1">
            <p className="text-sm font-bold tracking-[0.16em] text-accent uppercase">Lefouzèbreizh Studio</p>
            <h2 id="qui-suis-je-titre" className="mt-3 font-titre text-4xl font-bold tracking-tight text-encre sm:text-5xl">
              Moi, c’est Erwann.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-ardoise">
              <p>
                Basé en Bretagne, j’ai créé Lefouzèbreizh Studio avec une idée simple : aider les professionnels de terrain à être visibles en ligne sans devoir devenir experts du numérique.
              </p>
              <p>
                Je sais qu’un artisan a mieux à faire que de passer ses soirées à comprendre les sites web, les réseaux ou les réglages techniques. Mon rôle est de transformer son savoir-faire en une présence claire, belle et utile : un site qui présente son travail et facilite les appels.
              </p>
              <p>
                Ici, pas de discours compliqué, pas d’abonnement caché. On échange simplement, on construit quelque chose qui vous ressemble, et vous gardez la main sur votre activité.
              </p>
              <p className="font-bold text-encre">
                Votre métier mérite d’être trouvé aussi facilement qu’il est bien réalisé.
              </p>
            </div>
            <a className={`${BOUTON_PRINCIPAL} mt-7`} href="#formulaire">
              Parlons de votre activité
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

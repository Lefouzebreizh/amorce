import Image from 'next/image';
import { BOUTON_PRINCIPAL, SECTION } from '@/components/ui';

export function QuiSuisJe() {
  return (
    <section className={`${SECTION} artisan-erwann`} aria-labelledby="qui-suis-je-titre">
      <div className="artisan-erwann__shell">
        <div className="artisan-erwann__grid">
          <div className="artisan-erwann__visual order-1 md:order-2">
            <div className="artisan-erwann__frame">
              <Image
                src="/portrait-erwann.jpg"
                alt="Erwann, fondateur de Lefouzèbreizh Studio"
                width={1080}
                height={1080}
                sizes="(min-width: 1024px) 42vw, (min-width: 768px) 45vw, calc(100vw - 3rem)"
                quality={82}
                className="h-auto w-full rounded-[1.15rem] object-cover"
              />
            </div>
            <div className="artisan-erwann__float artisan-erwann__float--top">
              <span>Basé à Rennes</span>
              <strong>Disponible partout en France</strong>
            </div>
            <div className="artisan-erwann__float artisan-erwann__float--bottom">
              <span>Contact direct</span>
              <strong>Tu échanges avec moi</strong>
            </div>
          </div>

          <div className="artisan-erwann__copy order-2 md:order-1">
            <p className="artisan-kicker"><span>06</span> Lefouzèbreizh Studio</p>
            <h2 id="qui-suis-je-titre" className="mt-4 font-titre text-4xl font-bold tracking-tight text-encre sm:text-5xl">
              Moi, c’est Erwann.
            </h2>
            <div className="artisan-erwann__story">
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
            <dl className="artisan-erwann__facts">
              <div><dt>20 ans</dt><dd>au contact des métiers de terrain</dd></div>
              <div><dt>1 seul</dt><dd>interlocuteur du début à la fin</dd></div>
            </dl>
            <a className={`${BOUTON_PRINCIPAL} mt-7`} href="#formulaire">
              Parlons de votre activité
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

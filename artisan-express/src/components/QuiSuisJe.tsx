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
            <p className="artisan-kicker">Lefouzèbreizh Studio</p>
            <h2 id="qui-suis-je-titre" className="mt-4 font-titre text-4xl font-bold tracking-tight text-encre sm:text-5xl">
              Moi, c’est Erwann.
            </h2>
            <div className="artisan-erwann__story">
              <p>
                Basé à Rennes, j’ai créé Lefouzèbreizh Studio pour aider les professionnels de terrain à utiliser le numérique là où il rend vraiment service.
              </p>
              <p>
                Après vingt ans sur la route, je connais les journées qui débordent et les appels auxquels on ne peut pas répondre. Aujourd’hui, je développe des outils pour simplifier le suivi des demandes, préparer les devis et rendre ton travail visible.
              </p>
              <p>
                On commence par ton besoin. Je t’explique ce qui est possible, ce que cela coûte et ce qui dépend d’un service externe. Tu décides, et tu gardes la main.
              </p>
              <p className="font-bold text-encre">
                Moins de temps à gérer les outils. Plus de place pour ton métier.
              </p>
            </div>
            <dl className="artisan-erwann__facts">
              <div><dt>20 ans</dt><dd>au contact des métiers de terrain</dd></div>
              <div><dt>1 seul</dt><dd>interlocuteur du début à la fin</dd></div>
            </dl>
            <a className={`${BOUTON_PRINCIPAL} mt-7`} href="#formulaire">
              Parlons de ton activité
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

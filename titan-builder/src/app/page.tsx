import { CarteModele } from '@/components/CarteModele';
import { MODELES } from '@/lib/commande';

export default function Accueil() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 pb-20 pt-14 sm:gap-16 sm:pt-20">
      <header className="flex flex-col items-center gap-5 text-center">
        <span className="verre inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-sourdine sm:text-sm">
          <span className="h-2 w-2 rounded-full bg-succes" aria-hidden="true" />
          Livré en 48 h · une fois, sans abonnement
        </span>

        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-r from-neon-clair via-fuchsia-400 to-cyan bg-clip-text text-transparent">
            TITAN BUILDER
          </span>
          <span className="mt-3 block text-2xl font-bold text-white sm:text-4xl">
            Ton site époustouflant livré en 48 h.
          </span>
        </h1>

        <p className="max-w-2xl text-lg text-slate-300 sm:text-xl">
          <strong className="text-white">Tu configures, je code.</strong> Cinq étapes, dix minutes,
          et tu sais exactement ce que tu reçois avant de payer quoi que ce soit.
        </p>
      </header>

      <section className="flex flex-col gap-6" aria-labelledby="titre-modeles">
        <div className="flex flex-col gap-1">
          <h2 id="titre-modeles" className="text-2xl font-bold sm:text-3xl">
            Choisis ton modèle
          </h2>
          <p className="text-sourdine">
            Chacun est pensé pour un métier. Tout se règle à l’étape suivante — couleur, textes,
            photos, fonctions.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {MODELES.map((modele) => (
            <CarteModele key={modele.id} modele={modele} />
          ))}
        </div>
      </section>

      <section className="verre rounded-3xl p-6 sm:p-8" aria-labelledby="titre-comment">
        <h2 id="titre-comment" className="text-2xl font-bold sm:text-3xl">
          Comment ça se passe
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            ['1', 'Tu configures', 'Cinq étapes : tes infos, les fonctions, tes photos, le récapitulatif.'],
            ['2', 'Je code', 'Je reçois ton dossier complet. Pas d’aller-retour pour réclamer un logo.'],
            ['3', 'Tu reçois', 'Ton site en ligne sous 48 h, à toi, sans abonnement mensuel.'],
          ].map(([numero, titre, texte]) => (
            <li key={numero} className="flex flex-col gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neon/25 text-sm font-bold text-neon-clair">
                {numero}
              </span>
              <strong className="text-lg">{titre}</strong>
              <span className="text-sm leading-relaxed text-sourdine">{texte}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="text-center text-sm text-sourdine">
        <p>Un site, un prix, une fois. Pas d’abonnement, pas de reconduction.</p>
      </footer>
    </main>
  );
}

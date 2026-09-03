import { SECTION, TITRE_SECTION } from '@/components/ui';

/*
 * L'avant et l'après, côte à côte.
 *
 * Le panneau de gauche décrit une fiche d'annuaire **sans nommer d'annuaire**.
 * Ce n'est pas de la timidité : la comparaison porte sur ce que vit l'artisan —
 * être quatrième sur une liste, payer tous les mois, ne pas pouvoir changer une
 * ligne — et pas sur une marque. Une page de vente qui tape sur un concurrent
 * nommé se retourne, et la charte du dépôt interdit le procédé.
 */

const AVANT = [
  'Tu es quatrième sur une liste, sous trois concurrents qui ont payé plus.',
  'Une photo, deux lignes, un numéro. Rien qui te ressemble.',
  '49 € par mois, tous les mois, tant que tu ne résilies pas.',
  'Changer une ligne demande un appel et deux semaines.',
];

const APRES = [
  'Une page à toi seul, à ton nom, avec tes chantiers.',
  'Ton téléphone en gros, du haut de l’écran jusqu’en bas.',
  '300 € une fois. Rien le mois suivant.',
  'Une modification offerte, et le site t’appartient.',
];

export function AvantApres() {
  return (
    <section className="bg-slab">
      <div className={SECTION} id="avant-apres">
        <h2 className={TITRE_SECTION}>Ce que tu as aujourd’hui, ce que tu auras jeudi</h2>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/*
            * Avant. La capture d'annuaire garde ses gris clairs, et c'est
            * délibéré : c'est **le sujet** — une vraie page d'annuaire est
            * blanche et grise. La montrer sombre reviendrait à la maquiller,
            * et le contraste avec la carte « après » porte tout le message.
            */}
          <div className="flex flex-col rounded-2xl border border-edge bg-panel p-6">
            <p className="text-base font-bold uppercase tracking-[0.16em] text-ardoise">
              Aujourd’hui — ta fiche dans un annuaire
            </p>

            <div className="mt-4 rounded-lg border border-[#cfd6dd] bg-[#f4f5f7] p-3" aria-hidden="true">
              <div className="flex items-center justify-between border-b border-[#e2e5ea] pb-2">
                <span className="text-[0.6rem] text-[#8b939c]">Résultats 31 à 40 sur 187</span>
                <span className="text-[0.6rem] text-[#8b939c]">Trier ▾</span>
              </div>
              {[0, 1, 2].map((rang) => (
                <div key={rang} className="flex gap-2 border-b border-[#e2e5ea] py-2 last:border-0">
                  <div className="h-8 w-8 shrink-0 rounded bg-[#dcdfe4]" />
                  <div className="min-w-0 flex-1">
                    <div className="h-1.5 w-2/3 rounded bg-[#c9ced5]" />
                    <div className="mt-1.5 h-1.5 w-1/2 rounded bg-[#dcdfe4]" />
                  </div>
                  {rang === 0 ? (
                    <span className="self-start rounded bg-[#ffe9a8] px-1 text-[0.5rem] font-bold text-[#8a6d00]">
                      Sponsorisé
                    </span>
                  ) : null}
                </div>
              ))}
              <p className="pt-2 text-center text-[0.55rem] text-[#8b939c]">
                Toi, quelque part plus bas
              </p>
            </div>

            <ul className="mt-5 space-y-3 text-base leading-relaxed text-ardoise">
              {AVANT.map((ligne) => (
                <li key={ligne} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 font-bold text-danger">
                    ✕
                  </span>
                  <span>{ligne}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Après */}
          <div className="flex flex-col rounded-2xl border-2 border-accent bg-panel p-6">
            <p className="text-base font-bold uppercase tracking-[0.16em] text-accent">
              Jeudi — ton site à toi
            </p>

            <div className="mt-4 overflow-hidden rounded-lg border border-edge" aria-hidden="true">
              <div className="bg-accent px-3 py-2 text-accent-encre">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-accent-encre/70">
                  Couverture
                </p>
                <p className="text-sm font-bold leading-tight">LE GOFF TOITURES</p>
              </div>
              <div className="px-3 py-3">
                <p className="text-[0.7rem] font-bold leading-snug text-encre">
                  Toiture, zinguerie, fuite urgente — Quimper et alentours.
                </p>
                <div className="mt-2 flex gap-1.5">
                  <span className="rounded bg-accent px-2 py-1 text-[0.55rem] font-bold text-accent-encre">
                    Appeler
                  </span>
                  <span className="rounded bg-[#25D366] px-2 py-1 text-[0.55rem] font-bold text-white">
                    WhatsApp
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {['var(--color-panel)', 'var(--color-edge)', 'var(--color-slab)'].map((teinte) => (
                    <div key={teinte} className="h-8 rounded" style={{ backgroundColor: teinte }} />
                  ))}
                </div>
              </div>
            </div>

            <ul className="mt-5 space-y-3 text-base leading-relaxed text-encre">
              {APRES.map((ligne) => (
                <li key={ligne} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 font-bold text-accent">
                    ✓
                  </span>
                  <span>{ligne}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/*
          * La maquette ci-dessus est un dessin ; celui-ci est le vrai livrable.
          * « Montre-moi un exemple » est la première question d'un prospect, et
          * sans lien la conversation s'arrête là. La page pointée est générée
          * par le même outil que celui d'un client, et sort en `noindex` :
          * l'entreprise n'existe pas, elle ne doit pas apparaître dans les
          * résultats comme un vrai artisan.
          */}
        <p className="mt-8 text-center text-lg leading-relaxed text-ardoise">
          <a
            className="inline-flex min-h-14 items-center justify-center rounded-xl border-2 border-accent bg-slab px-6 text-lg font-semibold text-accent"
            href="/exemple.html"
          >
            Voir un site fini, en vrai
          </a>
          <span className="mt-3 block">
            Une page de démonstration — l’entreprise n’existe pas, le numéro ne sonne pas. C’est
            exactement ce que tu reçois, avec tes textes et tes photos.
          </span>
        </p>
      </div>
    </section>
  );
}

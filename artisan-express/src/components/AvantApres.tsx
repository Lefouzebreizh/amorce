import { ApercuSite } from '@/components/ApercuSite';
import { SECTION, TITRE_SECTION } from '@/components/ui';

/*
 * L'avant et l'après, côte à côte.
 *
 * Le panneau de gauche décrit une fiche d'annuaire **sans nommer d'annuaire**.
 * Ce n'est pas de la timidité : la comparaison porte sur ce que vit l'artisan —
 * être quatrième sur une liste, payer tous les mois, ne pas pouvoir changer une
 * ligne — et pas sur une marque. Une page de vente qui tape sur un concurrent
 * nommé se retourne, et la charte du dépôt interdit le procédé.
 *
 * ET LA MÊME RÈGLE VAUT POUR LES CHIFFRES, CE QUI AVAIT ÉTÉ MANQUÉ.
 *
 * La ligne annonçait « 49 € par mois, tous les mois » — un montant précis,
 * affirmé comme si tout artisan le payait. Ne pas nommer l'annuaire et lui
 * prêter un tarif exact revient au même : c'est une affirmation sur le
 * contrat d'un tiers, invérifiable et fausse pour la plupart des lecteurs.
 * Beaucoup ne paient rien, d'autres paient trois fois plus.
 *
 * Le défaut n'est pas seulement juridique. Un artisan qui paie 19 € lit le
 * chiffre, sait qu'il est faux pour lui, et cesse de croire le reste de la
 * page — y compris ce qui est vrai. La formulation dit donc ce qu'on sait
 * (un abonnement, souvent, tant qu'on ne résilie pas) et se tait sur ce
 * qu'on ne sait pas (combien, chez qui).
 */

const AVANT = [
  'Tu es quatrième sur une liste, sous trois concurrents qui ont payé plus.',
  'Une photo, deux lignes, un numéro. Rien qui te ressemble.',
  'Souvent un abonnement mensuel, tant que tu ne résilies pas.',
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

            {/*
              * LE CÔTÉ DROIT MONTRE LA VRAIE PAGE, PAS UN DESSIN D'ELLE.
              *
              * Il portait une miniature dessinée à la main — un entête d'accent,
              * deux boutons, trois carrés gris à la place des photos — sous le
              * nom « LE GOFF TOITURES ». Trois défauts tenaient dans ces vingt
              * lignes, et le commentaire quinze lignes plus bas les nommait déjà
              * sans en tirer la conséquence : « la maquette ci-dessus est un
              * dessin ; celui-ci est le vrai livrable ».
              *
              * 1. **Un dessin diverge du livrable** au premier changement de
              *    charte, et personne ne s'en aperçoit — c'est exactement ce
              *    qu'on vient de retirer du téléphone du haut de page.
              * 2. **Les carrés gris étaient le pire endroit où mentir par
              *    omission** : ils occupaient la place des photos de chantier,
              *    c'est-à-dire ce qu'un artisan veut voir avant de payer.
              * 3. **C'était une septième entreprise inventée.** Elle a déjà
              *    coûté une collision — le modèle couvreur, renommé « Toitures
              *    Le Goff », est tombé dessus, et `tests/galerie.test.ts` en
              *    porte le récit.
              *
              * La page montrée est celle du couvreur, parce que le panneau parle
              * de couverture et que le visiteur la retrouve en entier dans la
              * galerie. Une entreprise inventée de moins sur la page.
              */}
            <div className="mt-4">
              {/*
                Pas de hauteur imposée : le défaut d'`ApercuSite` est réglé pour
                laisser le bouton d'appel entier, et c'est lui l'argument de ce
                panneau — « ton téléphone en gros ». Le premier jet le coupait
                en deux à 16 rem.
              */}
              <ApercuSite
                fichier="/modeles/couvreur.html"
                titre="Aperçu du site livré à un couvreur"
              />
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

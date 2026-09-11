import { BOUTON_CONTOUR, BOUTON_PRINCIPAL, MESURE, SECTION, TITRE_SECTION } from '@/components/ui';
import { aUnStripe, contact } from '@/lib/config';
/*
 * Le SIRET est actif — SIREN 109356972, confirmé par le propriétaire le
 * 03/09/2026 pour une immatriculation validée le 31/08.
 *
 * Cette constante a tenu le bouton fermé tout l'été : encaisser trois cents
 * euros sans numéro, c'est facturer sans pouvoir émettre de facture conforme,
 * et le client qui paie n'a rien d'opposable en face. Elle n'était pas un
 * commentaire déguisé — elle commandait réellement le bouton — et elle ne se
 * bascule que sur confirmation du propriétaire. Elle vient de l'être.
 *
 * **Le bouton ne devient pas un bouton de paiement pour autant.**
 * `encaisseEnLigne` exige aussi `aUnStripe`, qui exige un lien Stripe réglé.
 * Tant qu'il manque, le bouton mène au formulaire, comme depuis le début :
 * on réserve, on convient du paiement, et rien ne transite. C'est voulu —
 * promettre une carte bancaire qui n'encaisse pas ferait rebrousser chemin à
 * quelqu'un de décidé, et ce serait pire que l'absence de paiement en ligne.
 */
const SIRET_ACTIF = true;
const encaisseEnLigne = SIRET_ACTIF && aUnStripe;

/*
 * Combien de sites à la fois — et pourquoi ce n'est pas un argument de vente
 * fabriqué.
 *
 * CE QUI A ÉTÉ ÉCARTÉ, ET LA RAISON.
 *
 * La proposition initiale était un tarif de lancement : trois cents euros
 * affichés comme une remise sur un prix plus haut, pour les dix premiers.
 * Elle est refusée, et pas par scrupule.
 *
 * Un prix de référence barré doit être un prix **réellement pratiqué**.
 * Personne n'a jamais payé le tarif plein ici, puisqu'il n'existe pas : le
 * barré serait une fausse réduction, c'est-à-dire une pratique commerciale
 * trompeuse. Et le public visé est précisément celui qui applique cette règle
 * à ses propres devis.
 *
 * Le coût n'est pourtant pas juridique, il est structurel. Toute cette page
 * tient sur une seule chose : elle ne ment pas. « Cette place est vide »,
 * « l'entreprise n'existe pas, le numéro ne sonne pas », « souvent un
 * abonnement mensuel » au lieu d'un chiffre prêté au voisin, six modèles qui
 * disent eux-mêmes qu'ils sont des modèles. Une remise inventée au milieu de
 * ça serait le **seul** élément qu'un visiteur pourrait prendre en défaut — et
 * il annulerait tout le reste.
 *
 * CE QUI EST RETENU À LA PLACE, ET POURQUOI C'EST PLUS FORT.
 *
 * La contrainte est déjà écrite trois lignes plus bas : **livré en 48 h**.
 * Ce délai n'est tenable que si peu de chantiers tournent en même temps. La
 * rareté n'a donc pas à être inventée : elle est la condition de la promesse
 * que la page fait déjà.
 *
 * On annonce donc un nombre de places **simultanées**, pas un quota mensuel.
 * La différence compte dans les deux sens : un quota mensuel plafonnerait le
 * chiffre d'affaires sans raison, et il obligerait à tenir un compteur à jour
 * — un décompte figé depuis six semaines se repère en une seconde et coûte la
 * crédibilité qu'il cherchait à gagner. Ici il n'y a rien à tenir : le nombre
 * est une règle de travail, pas un état.
 *
 * ET IL DOIT RESTER VRAI.
 *
 * Ce nombre est une affirmation sur la façon dont le propriétaire travaille,
 * pas un réglage d'affichage. S'il en prend un troisième pendant que deux
 * tournent, la phrase devient fausse — et c'est exactement le genre de détail
 * qu'un client repère quand sa livraison glisse. Le changer se fait ici, sur
 * une ligne, et nulle part ailleurs.
 */
const PLACES_SIMULTANEES = 4;

/*
 * Le nombre s'écrit en toutes lettres, et ce n'est pas de la coquetterie.
 *
 * La première version traitait le cas « deux » à part et laissait tomber tout
 * le reste sur le chiffre : passer à quatre a donc fait dire à la page
 * « 4 places à la fois » et « tant que 4 sites sont en cours ». Un chiffre au
 * milieu d'une phrase parlée sonne comme un formulaire, là où le reste du
 * bloc parle comme quelqu'un.
 *
 * La table s'arrête à cinq parce que `tests/offre.test.ts` refuse au-delà —
 * la promesse « livré en 48 h » ne tient plus. Un nombre hors table retombe
 * sur le chiffre : la page perd une élégance, jamais son sens.
 */
const EN_LETTRES: Readonly<Record<number, string>> = {
  1: 'une',
  2: 'deux',
  3: 'trois',
  4: 'quatre',
  5: 'cinq',
};

const PLACES_EN_LETTRES = EN_LETTRES[PLACES_SIMULTANEES] ?? String(PLACES_SIMULTANEES);

const COMPRIS = [
  ['Paiement en une fois', '300 €, et c’est fini — aucun abonnement, aucun prélèvement ensuite.'],
  ['Livré en 48 h', 'Le compteur part quand j’ai tes infos et tes photos, pas quand tu paies.'],
  ['Une modification offerte', 'Après livraison, tu regardes, tu me dis ce qui cloche, je corrige.'],
  ['Le site est à toi', 'Le code, le texte, les images : tu repars avec si un jour tu veux changer de crémerie.'],
] as const;

export function Offre() {
  return (
    <section className={SECTION} id="offre">
      <h2 className={TITRE_SECTION}>300&nbsp;€, une fois</h2>

      <div className="mt-8 overflow-hidden rounded-2xl border-2 border-accent">
        <div className="bg-accent px-6 py-7 text-accent-encre sm:px-8">
          <p className="text-5xl font-bold tracking-tight sm:text-6xl">300&nbsp;€</p>
          {/*
            L'encre pleine, jamais une opacité. Elle valait 85 % et rendait
            2,58:1 sur le bleu d'avant la charte ; la teinte a changé, le piège
            non — une opacité sur un aplat de couleur mange le contraste sans
            qu'aucun jeton ne le montre.
          */}
          <p className="mt-2 text-lg text-accent-encre">
            Une fois. Pas d’abonnement, rien à résilier, pas de reconduction.
          </p>
        </div>

        <div className="bg-slab px-6 py-7 sm:px-8">
          <dl className="grid gap-5 sm:grid-cols-2">
            {COMPRIS.map(([titre, detail]) => (
              <div key={titre} className="flex gap-3">
                <span aria-hidden="true" className="mt-0.5 text-xl font-bold text-accent">
                  ✓
                </span>
                <div>
                  <dt className="text-lg font-bold text-encre">{titre}</dt>
                  <dd className="mt-1 leading-relaxed text-ardoise">{detail}</dd>
                </div>
              </div>
            ))}
          </dl>

          {/*
            La ligne que les pages de vente cachent. Elle est ici parce qu'un
            artisan qui découvre un frais après coup ne rappelle jamais.
          */}
          {/* `panel` et non `slab` : posé sur une carte `slab`, cet encadré
              avait exactement la couleur de son fond et ne se détachait plus —
              or c'est le seul bloc de la page qu'on veut faire remarquer. */}
          <p className={`mt-7 rounded-xl border border-edge bg-panel p-4 text-base leading-relaxed text-ardoise ${MESURE}`}>
            <strong className="text-encre">Ce qui n’est pas dedans&nbsp;:</strong> le nom de domaine
            à ton nom (une douzaine d’euros par an, payés directement au fournisseur, jamais à moi).
            Je te montre comment le prendre, ou je m’en occupe avec toi au téléphone.
          </p>

          {/*
            Placé juste au-dessus des boutons, et pas ailleurs : le bouton dit
            déjà « Je réserve ma place » depuis toujours, sans que rien
            n'explique pourquoi il y a des places. Cet encadré-là rend ce mot
            vrai au lieu de le laisser décoratif.

            `border-accent` et non `border-edge` : c'est le seul endroit de la
            page qui demande une décision maintenant. Mais le fond reste
            `panel` — un aplat d'accent en ferait un second bouton plein, et la
            page n'en porte qu'un.
          */}
          <p className={`mt-7 rounded-xl border border-accent bg-panel p-4 text-lg leading-relaxed text-ardoise ${MESURE}`}>
            <strong className="text-encre">
              {PLACES_EN_LETTRES.charAt(0).toUpperCase() + PLACES_EN_LETTRES.slice(1)} places à la
              fois, et c’est ce qui tient les 48&nbsp;h.
            </strong>{' '}
            Je travaille seul. Tant que {PLACES_EN_LETTRES} sites sont en cours, je n’en prends pas un de plus — c’est le seul moyen de livrer en
            deux jours au lieu de faire attendre tout le monde. Quand les places sont prises, je te
            le dis et on cale la suivante.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              className={BOUTON_PRINCIPAL}
              href={encaisseEnLigne ? contact.stripeLien : '#formulaire'}
            >
              {encaisseEnLigne ? 'Je veux mon site en 48\u00a0h' : 'Je réserve ma place'}
            </a>
            <a className={BOUTON_CONTOUR} href="#formulaire">
              J’ai une question avant
            </a>
          </div>

          {/*
            * Deux phrases, jamais la même. Le paiement en ligne est fermé tant
            * que le SIRET n'est pas actif : promettre une carte bancaire qui
            * n'encaisse pas ferait rebrousser chemin à quelqu'un de décidé.
            * On dit donc ce qui se passe vraiment — on convient ensemble.
            */}
          <p className={`mt-4 text-base text-ardoise ${MESURE}`}>
            {encaisseEnLigne
              ? 'Paiement chez Stripe. Ta carte ne passe jamais par ce site.'
              : 'Je réserve ta place, on convient du paiement ensemble. Rien à régler depuis cette page.'}
          </p>
        </div>
      </div>
    </section>
  );
}

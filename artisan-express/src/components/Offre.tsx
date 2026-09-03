import { BOUTON_CONTOUR, BOUTON_PRINCIPAL, SECTION, TITRE_SECTION } from '@/components/ui';
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
          {/* Blanc plein, pas 85 % : l’opacité rendait 2,58:1 sur le bleu. */}
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
          <p className="mt-7 rounded-xl bg-slab p-4 text-base leading-relaxed text-ardoise">
            <strong className="text-encre">Ce qui n’est pas dedans&nbsp;:</strong> le nom de domaine
            à ton nom (une douzaine d’euros par an, payés directement au fournisseur, jamais à moi).
            Je te montre comment le prendre, ou je m’en occupe avec toi au téléphone.
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
          <p className="mt-4 text-base text-ardoise">
            {encaisseEnLigne
              ? 'Paiement chez Stripe. Ta carte ne passe jamais par ce site.'
              : 'Je réserve ta place, on convient du paiement ensemble. Rien à régler depuis cette page.'}
          </p>
        </div>
      </div>
    </section>
  );
}

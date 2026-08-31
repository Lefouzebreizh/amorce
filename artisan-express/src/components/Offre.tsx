import { BOUTON_CONTOUR, BOUTON_PRINCIPAL, SECTION, TITRE_SECTION } from '@/components/ui';
import { aUnStripe, contact } from '@/lib/config';
/*
 * Aucun encaissement en ligne tant que le SIRET n'est pas actif.
 *
 * L'immatriculation est en cours au guichet unique de l'INPI et n'est pas
 * validée. Encaisser trois cents euros avant d'avoir un numéro, c'est facturer
 * sans pouvoir émettre de facture conforme — et le client qui paie n'a rien
 * d'opposable en face.
 *
 * Le bouton mène donc au formulaire déjà présent en bas de page : on réserve,
 * on convient du paiement de vive voix, et rien ne transite.
 *
 * Cette constante **commande réellement** le bouton : la passer à `true` rétablit
 * le paiement en ligne, à condition qu'un lien Stripe soit configuré. Elle n'est
 * pas un commentaire déguisé, et elle ne se bascule que sur confirmation du
 * propriétaire que le SIRET est actif.
 */
const SIRET_ACTIF = false;
const encaisseEnLigne = SIRET_ACTIF && aUnStripe;

const COMPRIS = [
  ['Paiement en une fois', '300 €, et c’est fini — aucun prélèvement ensuite, aucun abonnement.'],
  ['Livré en 48 h', 'Le compteur part quand j’ai tes infos et tes photos, pas quand tu paies.'],
  ['Une modification offerte', 'Après livraison, tu regardes, tu me dis ce qui cloche, je corrige.'],
  ['Le site est à toi', 'Le code, le texte, les images : tu repars avec si un jour tu veux changer de crémerie.'],
] as const;

export function Offre() {
  return (
    <section className={SECTION} id="offre">
      <h2 className={TITRE_SECTION}>300&nbsp;€, une fois</h2>

      <div className="mt-8 overflow-hidden rounded-2xl border-2 border-bleu">
        <div className="bg-bleu px-6 py-7 text-white sm:px-8">
          <p className="text-5xl font-bold tracking-tight sm:text-6xl">300&nbsp;€</p>
          {/* Blanc plein, pas 85 % : l’opacité rendait 2,58:1 sur le bleu. */}
          <p className="mt-2 text-lg text-white">
            Une fois. Pas d’abonnement, rien à résilier, pas de reconduction.
          </p>
        </div>

        <div className="bg-white px-6 py-7 sm:px-8">
          <dl className="grid gap-5 sm:grid-cols-2">
            {COMPRIS.map(([titre, detail]) => (
              <div key={titre} className="flex gap-3">
                <span aria-hidden="true" className="mt-0.5 text-xl font-bold text-bleu">
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
          <p className="mt-7 rounded-xl bg-bleu-pale p-4 text-base leading-relaxed text-ardoise">
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

          <p className="mt-4 text-base text-ardoise">
            {encaisseEnLigne
              ? 'Paiement chez Stripe. Ta carte ne passe jamais par ce site.'
              : 'Je réserve ma place, on convient du paiement ensemble.'}
          </p>
        </div>
      </div>
    </section>
  );
}

import { BOUTON_CONTOUR, BOUTON_PRINCIPAL, SECTION, TITRE_SECTION } from '@/components/ui';
import { aUnStripe, contact } from '@/lib/config';

const COMPRIS = [
  ['Paiement en une fois', 'Carte bancaire par Stripe. 299 €, et c’est fini — aucun prélèvement ensuite.'],
  ['Livré en 48 h', 'Le compteur part quand j’ai tes infos et tes photos, pas quand tu paies.'],
  ['Une modification offerte', 'Après livraison, tu regardes, tu me dis ce qui cloche, je corrige.'],
  ['Le site est à toi', 'Le code, le texte, les images : tu repars avec si un jour tu veux changer de crémerie.'],
] as const;

export function Offre() {
  return (
    <section className={SECTION} id="offre">
      <h2 className={TITRE_SECTION}>299&nbsp;€, une fois</h2>

      <div className="mt-8 overflow-hidden rounded-2xl border-2 border-bleu">
        <div className="bg-bleu px-6 py-7 text-white sm:px-8">
          <p className="text-5xl font-bold tracking-tight sm:text-6xl">299&nbsp;€</p>
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
            <a className={BOUTON_PRINCIPAL} href={aUnStripe ? contact.stripeLien : '#formulaire'}>
              Je veux mon site en 48&nbsp;h
            </a>
            <a className={BOUTON_CONTOUR} href="#formulaire">
              J’ai une question avant
            </a>
          </div>

          {aUnStripe ? (
            <p className="mt-4 text-base text-ardoise">
              Paiement chez Stripe. Ta carte ne passe jamais par ce site.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

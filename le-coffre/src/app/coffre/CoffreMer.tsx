'use client';

type CoffreMerProps = {
  ouvert: boolean;
  onBasculer: () => void;
};

/**
 * Accueil abstrait et premium : on suggère l'idée d'un espace privé qui
 * s'ouvre, sans image IA littérale ni faux coffre-fort décoratif.
 */
export function CoffreMer({ ouvert, onBasculer }: CoffreMerProps) {
  return (
    <section className={`coffre-mer ${ouvert ? 'coffre-mer--ouvert' : ''}`} aria-label="Mon Tiroir Secret, espace privé">
      <div className="coffre-mer__backdrop" aria-hidden="true">
        <span className="coffre-mer__halo coffre-mer__halo--cyan" />
        <span className="coffre-mer__halo coffre-mer__halo--violet" />
        <span className="coffre-mer__ray coffre-mer__ray--one" />
        <span className="coffre-mer__ray coffre-mer__ray--two" />
        <span className="coffre-mer__grid" />
      </div>

      <div className="coffre-mer__portal" aria-hidden="true">
        <span className="coffre-mer__door" />
        <span className="coffre-mer__slot coffre-mer__slot--one" />
        <span className="coffre-mer__slot coffre-mer__slot--two" />
        <span className="coffre-mer__slot coffre-mer__slot--three" />
      </div>

      <div className="coffre-mer__contenu">
        <p className="coffre-mer__eyebrow"><span /> Espace privé · studio personnel</p>
        <h2>Ton tiroir secret.<br /><em>Tout reste rangé.</em></h2>
        <p>Un endroit clair pour tes papiers, tes repères et les choses importantes — sans bruit, sans décor inutile.</p>
        <button type="button" onClick={onBasculer} aria-pressed={ouvert} className="coffre-mer__commande">
          <span aria-hidden="true">{ouvert ? '✦' : '→'}</span>
          {ouvert ? 'Revenir au calme' : 'Allumer l’espace'}
        </button>
      </div>
    </section>
  );
}

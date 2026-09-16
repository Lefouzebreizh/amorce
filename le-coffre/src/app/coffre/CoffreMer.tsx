'use client';

type CoffreMerProps = {
  ouvert: boolean;
  onBasculer?: () => void;
  compact?: boolean;
  actionHref?: string;
  actionBadge?: string;
  actionLabel?: string;
};

export function CoffreMer({
  ouvert,
  onBasculer,
  compact = false,
  actionHref,
  actionBadge,
  actionLabel,
}: CoffreMerProps) {
  const libelleAction = actionLabel ?? (ouvert ? 'Refermer doucement' : 'Ouvrir le tiroir');
  const badgeAction = actionBadge ?? (ouvert ? 'Refermer' : 'Ouvrir');

  return (
    <section
      className={`coffre-mer ${compact ? 'coffre-mer--compact' : ''} ${ouvert ? 'coffre-mer--ouvert' : ''}`}
      aria-label="Mon Tiroir Secret, espace privé"
    >
      <video
        className="coffre-mer__image"
        poster="/brand/tiroir-secret-coffre-mer-phare-v2.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src="/brand/input-e5552510-8fef-4880-ac45-106008341a94.mp4" type="video/mp4" />
      </video>

      <div className="coffre-mer__backdrop" aria-hidden="true">
        <span className="coffre-mer__lumiere coffre-mer__lumiere--large" />
        <span className="coffre-mer__lumiere coffre-mer__lumiere--fine" />
        <span className="coffre-mer__phare" />
        <span className="coffre-mer__vagues" />
        <span className="coffre-mer__porte" />
        <span className="coffre-mer__reflet" />
        <span className="coffre-mer__grain" />
      </div>

      <div className="coffre-mer__contenu">
        <p className="coffre-mer__eyebrow"><span /> Espace privé · horizon clair</p>
        <h2>Ton tiroir secret.<br /><em>La mer dehors.</em></h2>
        <p>Un refuge personnel pour ranger tes papiers, retrouver l&apos;essentiel et respirer avant chaque démarche.</p>
        {actionHref ? (
          <a href={actionHref} className="coffre-mer__commande">
            <span aria-hidden="true">{badgeAction}</span>
            {libelleAction}
          </a>
        ) : (
          <button type="button" onClick={onBasculer} aria-pressed={ouvert} className="coffre-mer__commande">
            <span aria-hidden="true">{badgeAction}</span>
            {libelleAction}
          </button>
        )}
      </div>
    </section>
  );
}

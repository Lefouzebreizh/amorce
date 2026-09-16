'use client';

import Image from 'next/image';

type CoffreMerProps = {
  ouvert?: boolean;
  compact?: boolean;
  actionHref?: string;
  actionBadge?: string;
  actionLabel?: string;
  animationActive?: boolean;
  onBasculerAnimation?: () => void;
};

export function CoffreMer({
  ouvert = false,
  compact = false,
  actionHref,
  actionBadge,
  actionLabel,
  animationActive = true,
  onBasculerAnimation,
}: CoffreMerProps) {
  const libelleAction = actionLabel ?? 'Entrer dans mon espace';
  const badgeAction = actionBadge ?? 'Entrer';

  return (
    <section
      className={`coffre-mer ${compact ? 'coffre-mer--compact' : ''} ${ouvert ? 'coffre-mer--ouvert' : ''} ${animationActive ? 'coffre-mer--anime' : 'coffre-mer--immobile'}`}
      aria-label="Mon Tiroir Secret, espace privé"
    >
      <Image
        className="coffre-mer__image"
        src="/brand/tiroir-secret-mer-sans-coffre-v1.png"
        alt=""
        fill
        sizes={compact ? '(max-width: 980px) 100vw, 60vw' : '100vw'}
        priority
        aria-hidden="true"
      />

      <div className="coffre-mer__backdrop" aria-hidden="true">
        <span className="coffre-mer__vagues" />
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
        ) : null}
        {onBasculerAnimation && (
          <button
            type="button"
            onClick={onBasculerAnimation}
            aria-pressed={!animationActive}
            className="coffre-mer__animation"
          >
            {animationActive ? 'Arrêter l’animation' : 'Reprendre l’animation'}
          </button>
        )}
      </div>
    </section>
  );
}

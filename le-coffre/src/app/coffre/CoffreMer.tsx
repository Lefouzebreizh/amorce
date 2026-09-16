'use client';

import { useEffect, useRef } from 'react';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const libelleAction = actionLabel ?? 'Entrer dans mon espace';
  const badgeAction = actionBadge ?? 'Entrer';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (animationActive) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [animationActive]);

  return (
    <section
      className={`coffre-mer ${compact ? 'coffre-mer--compact' : ''} ${ouvert ? 'coffre-mer--ouvert' : ''} ${animationActive ? '' : 'coffre-mer--immobile'}`}
      aria-label="Mon Tiroir Secret, espace privé"
    >
      <video
        ref={videoRef}
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

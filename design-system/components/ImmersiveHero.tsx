'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import { BrandButton, BrandMark } from './LefouzebreizhUI';
import './immersive-hero.css';

type HeroLayer = {
  src: string;
  alt?: string;
  depth?: number;
  opacity?: number;
  className?: string;
};

type ImmersiveHeroProps = {
  eyebrow?: string;
  title?: string;
  highlight?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  layers?: HeroLayer[];
};

export function ImmersiveHero({
  eyebrow = 'Technologie · Humain · Bretagne · Demain',
  title = 'Des horizons',
  highlight = 'plus grands',
  description = 'Des solutions utiles, humaines et innovantes, inspirées par la Bretagne et pensées pour simplifier le quotidien.',
  primaryLabel = 'Explorer nos projets',
  secondaryLabel = 'Notre histoire',
  onPrimary,
  onSecondary,
  layers = [],
}: ImmersiveHeroProps) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--lfb-pointer-x', x.toFixed(3));
        root.style.setProperty('--lfb-pointer-y', y.toFixed(3));
      });
    };

    const onLeave = () => {
      root.style.setProperty('--lfb-pointer-x', '0');
      root.style.setProperty('--lfb-pointer-y', '0');
    };

    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <section ref={rootRef} className="lfb-immersive-hero" aria-labelledby="lfb-immersive-title">
      <div className="lfb-immersive-hero__sky" aria-hidden="true" />
      <div className="lfb-immersive-hero__mist lfb-immersive-hero__mist--a" aria-hidden="true" />
      <div className="lfb-immersive-hero__mist lfb-immersive-hero__mist--b" aria-hidden="true" />

      <div className="lfb-immersive-hero__layers" aria-hidden="true">
        {layers.map((layer, index) => {
          const style = {
            '--lfb-depth': layer.depth ?? (index + 1) * 0.35,
            opacity: layer.opacity ?? 1,
          } as CSSProperties;

          return (
            <img
              key={`${layer.src}-${index}`}
              src={layer.src}
              alt=""
              className={`lfb-immersive-hero__layer ${layer.className ?? ''}`.trim()}
              style={style}
            />
          );
        })}
      </div>

      <div className="lfb-immersive-hero__vignette" aria-hidden="true" />
      <div className="lfb-immersive-hero__content">
        <BrandMark />
        <p className="lfb-eyebrow">{eyebrow}</p>
        <h1 id="lfb-immersive-title">
          {title} <span>{highlight}</span>
        </h1>
        <p className="lfb-immersive-hero__description">{description}</p>
        <div className="lfb-immersive-hero__actions">
          <BrandButton onClick={onPrimary} icon="→">{primaryLabel}</BrandButton>
          <BrandButton tone="ghost" onClick={onSecondary}>{secondaryLabel}</BrandButton>
        </div>
      </div>

      <div className="lfb-immersive-hero__beacon" aria-hidden="true" />
      <div className="lfb-immersive-hero__ocean" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

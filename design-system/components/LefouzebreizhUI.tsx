import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import './lefouzebreizh-ui.css';

type Tone = 'cyan' | 'violet' | 'amber' | 'ghost';

type BrandButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  icon?: ReactNode;
};

export function BrandButton({ tone = 'cyan', icon, children, className = '', ...props }: BrandButtonProps) {
  return (
    <button className={`lfb-button lfb-button--${tone} ${className}`.trim()} {...props}>
      <span>{children}</span>
      {icon ? <span className="lfb-button__icon" aria-hidden="true">{icon}</span> : null}
    </button>
  );
}

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title?: string;
};

export function GlassCard({ eyebrow, title, children, className = '', ...props }: GlassCardProps) {
  return (
    <section className={`lfb-glass-card ${className}`.trim()} {...props}>
      {eyebrow ? <p className="lfb-eyebrow">{eyebrow}</p> : null}
      {title ? <h3 className="lfb-card-title">{title}</h3> : null}
      <div className="lfb-card-body">{children}</div>
    </section>
  );
}

type BrandMarkProps = {
  compact?: boolean;
  tagline?: string;
};

export function BrandMark({ compact = false, tagline = 'Des horizons plus grands' }: BrandMarkProps) {
  return (
    <div className={`lfb-brand ${compact ? 'lfb-brand--compact' : ''}`.trim()} aria-label="Lefouzèbreizh">
      <span className="lfb-brand__name">Lefouzè<span>breizh</span></span>
      {!compact ? <span className="lfb-brand__tagline">{tagline}</span> : null}
    </div>
  );
}

type ProjectCardProps = {
  name: string;
  description: string;
  imageUrl?: string;
  badge?: string;
  children?: ReactNode;
};

export function ProjectCard({ name, description, imageUrl, badge, children }: ProjectCardProps) {
  return (
    <article className="lfb-project-card">
      <div
        className="lfb-project-card__media"
        style={imageUrl ? { backgroundImage: `linear-gradient(180deg, transparent, rgba(3, 7, 14, .88)), url(${imageUrl})` } : undefined}
      >
        {badge ? <span className="lfb-project-card__badge">{badge}</span> : null}
      </div>
      <div className="lfb-project-card__content">
        <h3>{name}</h3>
        <p>{description}</p>
        {children}
      </div>
    </article>
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  copy?: string;
};

export function SectionHeading({ eyebrow, title, copy }: SectionHeadingProps) {
  return (
    <header className="lfb-section-heading">
      {eyebrow ? <p className="lfb-eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {copy ? <p className="lfb-section-heading__copy">{copy}</p> : null}
    </header>
  );
}

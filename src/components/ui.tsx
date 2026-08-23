'use client';

import type { ReactNode } from 'react';

/**
 * Briques d'interface.
 *
 * `Field` impose une explication à côté de chaque réglage : dans un outil censé
 * servir à quelqu'un qui n'a jamais monté, un curseur sans phrase qui dit ce
 * qu'il fait est un curseur qu'on ne touchera pas.
 */

export function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-edge bg-panel/70 p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm tracking-wide text-mist uppercase">{title}</h3>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Field({
  label,
  help,
  children,
  value,
}: {
  label: string;
  /** Ce que le réglage change concrètement, en français courant. */
  help?: string;
  children: ReactNode;
  /** Valeur courante, affichée à droite de l'intitulé. */
  value?: string;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-mist">{label}</span>
        {value && <span className="font-mono text-xs text-muted">{value}</span>}
      </div>
      {children}
      {help && <p className="mt-1.5 text-xs leading-relaxed text-muted">{help}</p>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  title,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  disabled?: boolean;
  title?: string;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const styles: Record<string, string> = {
    primary: 'bg-accent text-ink hover:bg-accent/85 font-semibold',
    ghost: 'border border-edge bg-slab text-mist hover:border-muted hover:bg-panel',
    subtle: 'text-muted hover:text-mist hover:bg-slab',
    danger: 'border border-danger/40 text-danger hover:bg-danger/10',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Slider({
  min,
  max,
  step,
  value,
  onChange,
  ariaLabel,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="range"
      className="w-full"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

/** Choix parmi quelques options, chacune décrite au survol. */
export function Choice<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.description}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border px-2.5 py-2 text-left text-xs transition-colors ${
              active
                ? 'border-accent bg-accent/10 text-mist'
                : 'border-edge bg-slab text-muted hover:border-muted hover:text-mist'
            }`}
          >
            <span className="block font-semibold">{option.label}</span>
            {option.description && (
              <span className="mt-0.5 block text-[11px] leading-snug text-muted">{option.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Encart pédagogique, pour expliquer une notion plutôt qu'un réglage. */
export function Hint({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' }) {
  const tones = {
    neutral: 'border-edge bg-slab/60 text-muted',
    warn: 'border-warn/30 bg-warn/5 text-warn',
  };
  return (
    <p className={`rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${tones[tone]}`}>{children}</p>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-edge bg-slab/40 px-4 py-8 text-center">
      <p className="font-display text-sm text-mist uppercase">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted">{children}</p>
    </div>
  );
}

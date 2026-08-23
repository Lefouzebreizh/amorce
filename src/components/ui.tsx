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

/**
 * Couleur associée à une note.
 *
 * Utilisée par le bandeau comme par le panneau d'analyse : une même note doit
 * s'afficher de la même couleur partout, sans quoi le repère visuel ne veut
 * plus rien dire. Le seuil accepte aussi bien une note sur 100 qu'un rapport
 * de 0 à 1.
 */
export function scoreColor(score: number): string {
  const ratio = score > 1 ? score / 100 : score;
  if (ratio >= 0.75) return 'var(--color-accent)';
  if (ratio >= 0.45) return 'var(--color-warn)';
  return 'var(--color-danger)';
}

/**
 * Pastille de note du bandeau.
 *
 * Portée par les deux dispositions. `role="status"` et le libellé explicite
 * font annoncer la note par un lecteur d'écran, là où un simple nombre à côté
 * du mot « Viralité » ne veut rien dire hors contexte visuel.
 */
export function ScoreBadge({ score, compact = false }: { score: number; compact?: boolean }) {
  return (
    <div
      role="status"
      aria-label={`Note de viralité : ${score} sur 100`}
      className={`flex items-center gap-2 rounded-full border border-edge bg-slab ${
        compact ? 'px-2.5 py-0.5' : 'px-3 py-1'
      }`}
    >
      <span className="text-[11px] text-muted" aria-hidden="true">
        Viralité
      </span>
      <span className="font-display text-sm" style={{ color: scoreColor(score) }} aria-hidden="true">
        {score}
      </span>
    </div>
  );
}

/**
 * Bloc repliable, fermé par défaut.
 *
 * Sert à ranger les réglages fins. Une jauge demande de choisir une valeur, ce
 * qu'un débutant ne sait pas faire : la mettre au premier plan bloque plus
 * qu'elle n'aide. Les gestes qui produisent un résultat prévisible passent
 * devant ; les jauges restent accessibles pour qui veut affiner.
 *
 * `<details>` plutôt qu'un état React : le repli fonctionne même si rien n'est
 * encore hydraté, et le navigateur gère l'accessibilité au clavier.
 */
export function Collapsible({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="rounded-2xl border border-edge bg-panel/70">
      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-muted select-none marker:content-none hover:text-mist">
        {label} <span aria-hidden="true">▾</span>
      </summary>
      <div className="border-t border-edge px-4 py-3">{children}</div>
    </details>
  );
}

/** Rangée de gestes rapides, tous à effet immédiat et prévisible. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-1.5">{children}</div>;
}

/**
 * Boutons d'annulation et de rétablissement.
 *
 * Placés dans le bandeau, donc atteignables depuis n'importe quelle étape :
 * une mauvaise manipulation se répare là où on la constate, pas en retournant
 * dans le panneau qui l'a provoquée.
 */
export function UndoControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" onClick={onUndo} disabled={!canUndo} title="Annuler la dernière action">
        ↶
      </Button>
      <Button variant="ghost" onClick={onRedo} disabled={!canRedo} title="Rétablir">
        ↷
      </Button>
    </div>
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

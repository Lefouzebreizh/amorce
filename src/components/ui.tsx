'use client';

import { useRef, type ReactNode } from 'react';
import { useIsTouch } from '@/hooks/useMediaQuery';

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
    <section className="rounded-2xl bg-panel p-4">
      <header className="mb-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] leading-tight tracking-tight text-mist">{title}</h3>
          {subtitle && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{subtitle}</p>}
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
    <div className="mb-5 last:mb-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-mist">{label}</span>
        {value && <span className="font-mono text-[13px] text-muted tabular-nums">{value}</span>}
      </div>
      {children}
      {help && <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{help}</p>}
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
  /*
   * Trois niveaux, trois traitements distincts.
   *
   * Le remplissage est ce qui hiérarchise, pas la bordure : quatre boutons
   * cerclés du même trait se valent tous, et l'œil ne sait plus lequel presser.
   */
  const styles: Record<string, string> = {
    primary: 'bg-accent text-ink font-semibold hover:bg-accent/85 active:bg-accent/75',
    ghost: 'bg-raised text-mist hover:bg-edge active:bg-edge/70',
    /*
     * `subtle` veut dire **indisponible**, pas « discret ».
     *
     * Son seul indice visuel est un fond au survol — et un téléphone ne
     * survole pas : au repos, un bouton `subtle` est du texte gris,
     * indistinguable de la légende qui le précède. C'est exactement ce qu'on
     * veut pour Annuler et Rétablir quand il n'y a rien à annuler, et c'est le
     * seul emploi juste.
     *
     * Quatre boutons bien vivants l'ont porté — « Modifier ce texte »,
     * « Aller à l'Accroche », « Écouter », « Retirer » — et passaient tous
     * pour morts. Ils fonctionnaient ; personne ne pouvait le savoir. Pour une
     * action disponible mais secondaire, c'est `ghost` qu'il faut.
     */
    subtle: 'text-muted hover:text-mist hover:bg-raised/60',
    danger: 'text-danger hover:bg-danger/10 active:bg-danger/15',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      /*
       * 44 px **dans les deux sens** : la cible minimale qu'un doigt atteint
       * sans viser. La hauteur était fixée, la largeur non — elle ne venait
       * que du remplissage et du contenu, si bien qu'un bouton d'icône sortait
       * à 37 px de large. Mesurés d'un coup sur le studio : trente-et-un
       * boutons dans ce cas, tous ceux qui ne portent qu'un signe.
       *
       * `min-w-11` ne coûte rien aux boutons de texte, déjà plus larges — un
       * seul jeton posé ici règle les trente-et-un.
       */
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3.5 text-[13.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Distance au bouton en deçà de laquelle on considère qu'on l'a saisi.
 *
 * Généreuse, parce que le bouton est la seule cible : la barre ne répondant
 * plus, rien ne se dispute ce rayon. Il porte la zone saisissable à 72 px de
 * large, bien au-delà des 44 px d'un doigt.
 */
const THUMB_GRAB_PX = 36;

/** Déplacement à partir duquel on tranche entre régler et faire défiler. */
const INTENT_PX = 6;

/**
 * Jauge de réglage.
 *
 * Au doigt, une jauge native pose un problème que rien ne laisse deviner :
 * poser le doigt n'importe où sur la barre change la valeur immédiatement. Un
 * défilement vertical amorcé sur une jauge déréglait donc le paramètre au
 * passage — une vitesse passée à 3,20× sans que personne ne l'ait voulu.
 *
 * Le geste est arbitré ici, et **seul le bouton règle la valeur**. Poser le
 * doigt sur la barre ne fait rien, même en partant à l'horizontale : dans un
 * panneau qui n'est qu'une pile de jauges, un pouce qui effleure en fait bouger
 * une sans qu'on sache laquelle ni de combien. La barre reste la lecture de la
 * valeur, le bouton en est la commande.
 *
 * Rien ne bouge non plus au simple contact du bouton : la valeur ne suit qu'à
 * partir d'un déplacement franc, et un départ vertical rend la main à la page.
 * Le décalage entre le doigt et le bouton est conservé, sinon saisir le bouton
 * par son bord ferait sauter la valeur avant même d'avoir bougé.
 *
 * À la souris, le comportement natif est conservé — cliquer la barre pour s'y
 * rendre y est utile et sans ambiguïté.
 *
 * Le champ natif reste en place : il porte la valeur, son intitulé accessible
 * et la navigation au clavier.
 */
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
  const touch = useIsTouch();
  const trackRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; offset: number; active: boolean } | null>(null);

  /** Valeur correspondant à une position horizontale, calée sur le pas. */
  const valueAt = (clientX: number): number => {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return value;

    const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    const raw = min + ratio * (max - min);
    return Math.max(min, Math.min(max, Math.round(raw / step) * step));
  };

  /** Position actuelle du bouton, en pixels écran. */
  const thumbX = (): number => {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) return 0;
    const ratio = max === min ? 0 : (value - min) / (max - min);
    return bounds.left + ratio * bounds.width;
  };

  return (
    <div
      ref={trackRef}
      // `pan-y` rend le geste vertical à la page ; l'horizontal reste à nous.
      className="w-full [touch-action:pan-y]"
      onPointerDown={
        touch
          ? (event) => {
              // Hors du bouton, on ne retient rien : la barre est inerte.
              if (Math.abs(event.clientX - thumbX()) > THUMB_GRAB_PX) return;
              gesture.current = {
                x: event.clientX,
                y: event.clientY,
                offset: thumbX() - event.clientX,
                active: false,
              };
            }
          : undefined
      }
      onPointerMove={
        touch
          ? (event) => {
              const current = gesture.current;
              if (!current) return;

              if (!current.active) {
                const dx = Math.abs(event.clientX - current.x);
                const dy = Math.abs(event.clientY - current.y);
                // Un mouvement d'abord vertical appartient au défilement, même
                // parti du bouton : on ne reprend pas la main après coup, sous
                // peine de déclencher le réglage en plein milieu d'un balayage.
                if (dy > dx && dy > INTENT_PX) {
                  gesture.current = null;
                  return;
                }
                if (dx < INTENT_PX) return;
                current.active = true;
                event.currentTarget.setPointerCapture(event.pointerId);
              }

              onChange(valueAt(event.clientX + current.offset));
            }
          : undefined
      }
      onPointerUp={
        touch
          ? (event) => {
              if (gesture.current?.active) event.currentTarget.releasePointerCapture(event.pointerId);
              gesture.current = null;
            }
          : undefined
      }
      onPointerCancel={touch ? () => { gesture.current = null; } : undefined}
    >
      <input
        type="range"
        className={`w-full ${touch ? 'pointer-events-none' : ''}`}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
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
            className={`min-h-11 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
              active
                ? 'bg-raised text-mist ring-1 ring-select/60'
                : 'bg-slab text-muted hover:bg-raised hover:text-mist'
            }`}
          >
            <span className="block font-semibold">{option.label}</span>
            {option.description && (
              <span className="mt-1 block text-[12px] leading-snug text-muted">{option.description}</span>
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
    neutral: 'bg-slab text-muted',
    warn: 'bg-warn/10 text-warn',
  };
  return <p className={`rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed ${tones[tone]}`}>{children}</p>;
}

/**
 * Couleur associée à une note.
 *
 * Utilisée par le bandeau comme par le panneau d'analyse : une même note doit
 * s'afficher de la même couleur partout, sans quoi le repère visuel ne veut
 * plus rien dire. Le seuil accepte aussi bien une note sur 100 qu'un rapport
 * de 0 à 1.
 *
 * Quatre crans, pris dans l'échelle `gauge` et non dans l'accent. Une note est
 * un **constat**, pas une action : la dire avec la couleur des boutons faisait
 * chercher où cliquer sur un chiffre. Et la clarté de l'échelle croît d'un
 * cran à l'autre, ce qui la rend lisible même pour qui ne distingue pas le
 * rouge du vert — sur une jauge, la teinte seule ne suffit jamais.
 */
export function scoreColor(score: number): string {
  const ratio = score > 1 ? score / 100 : score;
  if (ratio >= 0.9) return 'var(--color-gauge-peak)';
  if (ratio >= 0.7) return 'var(--color-gauge-high)';
  if (ratio >= 0.45) return 'var(--color-gauge-mid)';
  return 'var(--color-gauge-low)';
}

/**
 * Pastille de note du bandeau.
 *
 * Portée par les deux dispositions. `role="status"` et le libellé explicite
 * font annoncer la note par un lecteur d'écran, là où un simple nombre à côté
 * du mot ne veut rien dire hors contexte visuel.
 *
 * Elle disait « Viralité », et l'utilisateur a eu raison de s'en plaindre :
 * personne ne peut prédire des vues honnêtement, et une note qui le prétendait
 * récompensait une vidéo à 6 % de rétention. Elle dit maintenant ce qu'elle
 * mesure vraiment — la qualité du montage — et se plafonne sur les défauts qui
 * empêchent un film d'être fini.
 */
export function ScoreBadge({ score, compact = false }: { score: number; compact?: boolean }) {
  return (
    <div
      role="status"
      aria-label={`Note de montage : ${score} sur 100`}
      className={`flex items-center gap-2 rounded-full bg-raised ${
        compact ? 'px-3 py-1' : 'px-3.5 py-1.5'
      }`}
    >
      <span className="text-[12px] text-muted" aria-hidden="true">
        Montage
      </span>
      <span
        className="font-display text-[15px] tabular-nums"
        style={{ color: scoreColor(score) }}
        aria-hidden="true"
      >
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
    <details className="rounded-2xl bg-panel">
      <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 text-[13px] font-semibold text-muted select-none marker:content-none hover:text-mist">
        {label} <span aria-hidden="true" className="ml-1.5">▾</span>
      </summary>
      <div className="px-4 pt-1 pb-4">{children}</div>
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
 *
 * L'annulation porte son nom en toutes lettres. La flèche seule ne se
 * reconnaît pas — le bouton était bien là, et personne ne l'avait vu.
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
      <Button
        variant={canUndo ? 'ghost' : 'subtle'}
        onClick={onUndo}
        disabled={!canUndo}
        title="Annuler la dernière action (Ctrl+Z)"
        className={canUndo ? 'font-semibold' : ''}
      >
        ↶ Annuler
      </Button>
      <Button
        variant={canRedo ? 'ghost' : 'subtle'}
        onClick={onRedo}
        disabled={!canRedo}
        title="Rétablir ce qui vient d’être annulé"
      >
        ↷
      </Button>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-slab px-4 py-8 text-center">
      <p className="font-display text-[15px] tracking-tight text-mist">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-[12.5px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

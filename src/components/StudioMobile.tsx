'use client';

import { useMemo } from 'react';
import { analyzeProject } from '@/lib/analysis';
import { useStudio } from '@/lib/store';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import { Preview } from './Preview';
import { Timeline } from './Timeline';
import { STEPS, StepPanel, type StepId } from './steps';
import { ScoreBadge } from './ui';

/**
 * Disposition téléphone.
 *
 * Rien n'est superposé : le panneau d'étape prend sa place dans le flux et
 * l'aperçu se réduit d'autant. Un panneau flottant par-dessus l'image
 * masquerait précisément ce qu'on est en train de régler, et il faudrait le
 * refermer à chaque vérification.
 *
 * L'aperçu reste donc visible en permanence, plus petit quand un panneau est
 * ouvert. C'est le compromis qu'impose un écran de téléphone : on ne peut pas
 * avoir à la fois une grande image et un panneau de réglages confortable.
 */
export function StudioMobile({
  engine,
  step,
  onStep,
}: {
  engine: PlaybackEngine;
  /** Étape ouverte, ou null quand seul l'aperçu est affiché. */
  step: StepId | null;
  onStep: (step: StepId | null) => void;
}) {
  const clipCount = useStudio((s) => s.project.clips.length);
  const open = step !== null;

  /*
   * Panneau ouvert, la hauteur devient la ressource rare, et il faut trancher :
   * sur un écran de 640 px déjà amputé par la barre du navigateur, un aperçu
   * utile, un panneau et une timeline ne tiennent pas ensemble.
   *
   * La timeline n'est donc conservée que pour l'étape de montage, la seule où
   * désigner un plan n'a pas d'équivalent ailleurs — sous-titres et bruitages
   * sont déjà listés dans leur propre panneau. Refermer le panneau, d'un seul
   * appui sur l'onglet actif, rend l'écran entier à l'aperçu.
   */
  const showTimeline = clipCount > 0 && (!open || step === 'montage');

  return (
    // `100dvh` et non `100vh` : sur mobile, la barre d'adresse se replie en
    // cours de route et `vh` ne suit pas, ce qui ferait dépasser la page.
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <MobileHeader />

      <section className="flex min-h-[9rem] flex-1 flex-col gap-2 overflow-hidden p-2">
        <Preview engine={engine} />
        {showTimeline && (
          <div className="shrink-0">
            <Timeline engine={engine} compact={open} />
          </div>
        )}
      </section>

      {open && (
        <section
          /*
           * Volontairement sans `shrink-0` : sur un écran court, le panneau doit
           * pouvoir céder de la hauteur à l'aperçu, dont la place minimale est
           * garantie plus haut. Le figer produirait exactement le débordement
           * qu'on cherche à éviter.
           */
          className="h-[38dvh] max-h-[24rem] min-h-[9rem] overflow-y-auto overscroll-contain border-t border-edge bg-slab/95 px-2 pt-2 pb-4"
          aria-label={STEPS.find((s) => s.id === step)?.label}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="font-display text-xs tracking-wide text-mist uppercase">
              {STEPS.find((s) => s.id === step)?.label}
            </span>
            <button
              type="button"
              onClick={() => onStep(null)}
              className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-mist"
            >
              Fermer ✕
            </button>
          </div>
          <StepPanel step={step} engine={engine} />
        </section>
      )}

      <TabBar step={step} onStep={onStep} />
    </div>
  );
}

function MobileHeader() {
  const project = useStudio((s) => s.project);
  const analysis = useMemo(() => analyzeProject(project), [project]);

  return (
    <header
      className="flex shrink-0 items-center justify-between gap-3 border-b border-edge px-3 py-2"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <span className="font-display text-base tracking-tight text-mist">amorce</span>
      {analysis.shotCount > 0 && <ScoreBadge score={analysis.score} compact />}
    </header>
  );
}

/**
 * Barre d'onglets.
 *
 * Elle défile horizontalement plutôt que de comprimer sept étapes dans la
 * largeur d'un téléphone : des cibles trop étroites se manquent au doigt, et
 * une étape qu'on rate est une étape qu'on n'utilise pas.
 */
function TabBar({ step, onStep }: { step: StepId | null; onStep: (step: StepId | null) => void }) {
  return (
    <nav
      className="flex shrink-0 gap-1 overflow-x-auto border-t border-edge bg-ink px-2 py-1.5"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      aria-label="Étapes du montage"
    >
      {STEPS.map((item) => {
        const active = item.id === step;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'step' : undefined}
            // Un second appui sur l'étape ouverte referme le panneau et rend
            // toute la hauteur à l'aperçu.
            onClick={() => onStep(active ? null : item.id)}
            className={`min-h-11 min-w-[4.75rem] shrink-0 rounded-xl border px-2 py-1.5 text-center transition-colors ${
              active ? 'border-accent bg-accent/10 text-mist' : 'border-edge text-muted'
            }`}
          >
            <span className="block text-[10px] leading-none opacity-70">{item.index}</span>
            <span className="mt-0.5 block text-[11px] leading-tight font-semibold">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

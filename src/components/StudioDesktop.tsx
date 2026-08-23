'use client';

import { useMemo } from 'react';
import { analyzeProject } from '@/lib/analysis';
import { useStudio } from '@/lib/store';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import { Preview } from './Preview';
import { Timeline } from './Timeline';
import { NextStep } from './NextStep';
import { StepPanel } from './steps';
import { STEPS, type StepId } from '@/lib/steps';
import { ScoreBadge, UndoControls } from './ui';

/**
 * Disposition ordinateur : trois colonnes.
 *
 * Le parcours reste visible en permanence à gauche et le panneau de l'étape
 * courante à droite, l'aperçu occupant le centre. La largeur disponible permet
 * de tout montrer d'un coup, ce que le téléphone ne peut pas se permettre.
 */
export function StudioDesktop({
  engine,
  step,
  onStep,
}: {
  engine: PlaybackEngine;
  step: StepId;
  onStep: (step: StepId) => void;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <DesktopHeader />

      <main className="flex min-h-0 flex-1">
        <nav className="flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-edge p-3" aria-label="Étapes du montage">
          {STEPS.map((item) => {
            const active = item.id === step;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'step' : undefined}
                onClick={() => onStep(item.id)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  active ? 'border-accent bg-accent/10' : 'border-transparent hover:border-edge hover:bg-slab'
                }`}
              >
                <span className={`text-xs font-semibold ${active ? 'text-mist' : 'text-muted'}`}>
                  {item.index}. {item.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted">{item.hint}</span>
              </button>
            );
          })}
        </nav>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-3">
          <Preview engine={engine} />
          <div className="shrink-0">
            <Timeline engine={engine} />
          </div>
        </section>

        <aside className="w-full max-w-sm shrink-0 space-y-3 overflow-y-auto border-l border-edge p-3">
          <NextStep onStep={onStep} />
          <StepPanel step={step} engine={engine} onStep={onStep} />
        </aside>
      </main>
    </div>
  );
}

function DesktopHeader() {
  const project = useStudio((s) => s.project);
  const analysis = useMemo(() => analyzeProject(project), [project]);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-edge px-4 py-2.5">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-lg tracking-tight text-mist">amorce</span>
        <span className="hidden text-xs text-muted sm:block">
          Le studio qui rend tes vidéos IA virales — tout se passe dans ton navigateur
        </span>
      </div>

      <div className="flex items-center gap-3">
        <UndoControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
        {analysis.shotCount > 0 && <ScoreBadge score={analysis.score} />}
      </div>
    </header>
  );
}

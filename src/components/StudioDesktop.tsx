'use client';

import Link from 'next/link';

import { useMemo } from 'react';
import { analyzeProject } from '@/lib/analysis';
import { useStudio } from '@/lib/store';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import { Preview } from './Preview';
import { Timeline } from './Timeline';
import { NextStep } from './NextStep';
import { PhasePanel } from './steps';
import { PHASES, phaseForStep, type StepId } from '@/lib/steps';
import { ScoreBadge, UndoControls } from './ui';

/**
 * Disposition ordinateur : trois colonnes.
 *
 * Les trois phases restent visibles à gauche et la phase courante à droite,
 * l'aperçu occupant le centre. Les outils d'une phase sont réunis dans le rail.
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
    <div className="studio-shell flex h-screen flex-col overflow-hidden">
      <DesktopHeader />

      <main className="studio-body flex min-h-0 flex-1">
        <nav className="studio-nav flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-edge p-3" aria-label="Étapes du montage">
          <p className="studio-nav-eyebrow">Le Phare <span>·</span> atelier</p>
          {PHASES.map((phase, index) => {
            const active = phase.id === phaseForStep(step).id;
            return (
              <button
                key={phase.id}
                type="button"
                aria-current={active ? 'step' : undefined}
                onClick={() => onStep(phase.firstStep)}
                className={`studio-step rounded-xl px-3 py-2.5 text-left transition-colors ${
                  active ? 'studio-step-active bg-raised ring-1 ring-select/60' : 'hover:bg-slab'
                }`}
              >
                <span className="studio-step-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="studio-step-copy">
                  <span className={`studio-step-label ${active ? 'text-mist' : 'text-muted'}`}>
                    {phase.label}
                  </span>
                  <span className="studio-step-hint">{phase.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <section className="studio-workspace flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-3">
          <div className="studio-preview-plate flex min-h-0 flex-1">
            <Preview engine={engine} onImporter={() => onStep('import')} />
          </div>
          <div className="studio-timeline-plate shrink-0">
            <Timeline engine={engine} />
          </div>
        </section>

        <aside className="studio-rail w-full max-w-sm shrink-0 space-y-3 overflow-y-auto border-l border-edge p-3">
          <NextStep onStep={onStep} />
          <PhasePanel phase={phaseForStep(step)} step={step} engine={engine} onStep={onStep} />
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
    <header className="studio-header flex shrink-0 items-center justify-between gap-4 border-b border-edge px-4 py-2.5">
      <div className="flex items-baseline gap-3">
        <Link
          href="/"
          className="studio-wordmark flex min-h-11 items-center font-display text-xl tracking-tight text-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Mouvance Studio
        </Link>
        <span className="studio-live-dot" aria-label="Studio prêt" />
        <span className="hidden text-[13px] text-muted sm:block">
          Création et montage vidéo assistés de bout en bout — tout se passe dans ton navigateur
        </span>
      </div>

      <div className="flex items-center gap-3">
        <UndoControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
        {analysis.shotCount > 0 && <ScoreBadge score={analysis.score} />}
      </div>
    </header>
  );
}

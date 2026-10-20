'use client';

import type { PlaybackEngine } from '@/hooks/usePlayback';
import { PHASES, phaseForStep, type Phase, type StepId, STEPS } from '@/lib/steps';
import { AnalysisPanel } from './panels/AnalysisPanel';
import { CinemaPanel } from './panels/CinemaPanel';
import { ClipPanel } from './panels/ClipPanel';
import { ExportPanel } from './panels/ExportPanel';
import { ImportPanel } from './panels/ImportPanel';
import { SoundPanel } from './panels/SoundPanel';
import { TextPanel } from './panels/TextPanel';

/**
 * Aiguillage vers le panneau de l'étape courante.
 *
 * Les deux tailles d'écran partagent le même aiguillage : les phases regroupent
 * les outils, et cet aiguillage conserve les panneaux existants.
 */

export function StepPanel({
  step,
  engine,
  onStep,
}: {
  step: StepId;
  engine: PlaybackEngine;
  /** Permet à un panneau de renvoyer vers l'étape qui corrige un défaut. */
  onStep: (step: StepId) => void;
}) {
  switch (step) {
    case 'import':
      return <ImportPanel engine={engine} />;
    case 'montage':
      return <ClipPanel />;
    case 'texte':
      return <TextPanel />;
    case 'son':
      return <SoundPanel engine={engine} />;
    case 'cinema':
      return <CinemaPanel />;
    case 'analyse':
      return <AnalysisPanel engine={engine} onStep={onStep} />;
    case 'export':
      return <ExportPanel engine={engine} />;
  }
}

/** Un panneau de phase regroupe les outils sans les retirer du parcours. */
export function PhasePanel({
  phase,
  step,
  engine,
  onStep,
}: {
  phase: Phase;
  step: StepId;
  engine: PlaybackEngine;
  onStep: (step: StepId) => void;
}) {
  const activeStep = phase.steps.includes(step) ? step : phase.firstStep;

  return (
    <div className="phase-tools">
      {phase.steps.length > 1 && (
        <div className="phase-tool-picker" role="group" aria-label={`Outils : ${phase.label}`}>
          {phase.steps.map((id) => {
            const item = STEPS.find((candidate) => candidate.id === id)!;
            const active = activeStep === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                className={`phase-tool-choice${active ? ' is-active' : ''}`}
                onClick={() => onStep(id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="phase-tool-body" key={activeStep}>
        <StepPanel step={activeStep} engine={engine} onStep={onStep} />
      </div>
    </div>
  );
}

/** Trois moments de travail, avec une seule phase dépliée sur téléphone. */
export function PhaseDisclosure({
  phase,
  step,
  engine,
  onStep,
}: {
  phase: Phase;
  step: StepId | null;
  engine: PlaybackEngine;
  onStep: (step: StepId | null) => void;
}) {
  const open = step !== null && phase.id === phaseForStep(step).id;

  return (
    <div
      id={`phase-${phase.id}`}
      className={`workflow-phase${open ? ' is-open' : ''}`}
    >
      <button
        type="button"
        className="workflow-phase-heading"
        aria-expanded={open}
        onClick={() => onStep(open ? null : phase.firstStep)}
      >
        <span className="workflow-phase-number">{String(PHASES.indexOf(phase) + 1).padStart(2, '0')}</span>
        <span className="workflow-phase-copy">
          <span className="workflow-phase-title">{phase.label}</span>
          <span className="workflow-phase-hint">{phase.hint}</span>
        </span>
        <span className="workflow-phase-chevron" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="workflow-phase-content">
          <PhasePanel phase={phase} step={step ?? phase.firstStep} engine={engine} onStep={(next) => onStep(next)} />
        </div>
      )}
    </div>
  );
}

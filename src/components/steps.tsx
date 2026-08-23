'use client';

import type { PlaybackEngine } from '@/hooks/usePlayback';
import { type StepId } from '@/lib/steps';
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
 * L'ordinateur affiche les étapes dans une colonne latérale, le téléphone dans
 * une barre d'onglets en bas. Les panneaux, eux, sont rigoureusement les mêmes :
 * seule la coque change.
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
      return <ImportPanel />;
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

'use client';

import type { PlaybackEngine } from '@/hooks/usePlayback';
import { AnalysisPanel } from './panels/AnalysisPanel';
import { CinemaPanel } from './panels/CinemaPanel';
import { ClipPanel } from './panels/ClipPanel';
import { ExportPanel } from './panels/ExportPanel';
import { ImportPanel } from './panels/ImportPanel';
import { SoundPanel } from './panels/SoundPanel';
import { TextPanel } from './panels/TextPanel';

/**
 * Définition du parcours, partagée par les deux dispositions.
 *
 * L'ordinateur affiche les étapes dans une colonne latérale, le téléphone dans
 * une barre d'onglets en bas. Les panneaux, eux, sont rigoureusement les mêmes :
 * seule la coque change.
 */

export type StepId = 'import' | 'montage' | 'texte' | 'son' | 'cinema' | 'analyse' | 'export';

export type Step = {
  id: StepId;
  index: number;
  label: string;
  /** Ce qu'on y fait, affiché sous l'intitulé quand la place le permet. */
  hint: string;
};

export const STEPS: Step[] = [
  { id: 'import', index: 1, label: 'Importer', hint: 'Charge tes rushes' },
  { id: 'montage', index: 2, label: 'Monter', hint: 'Ordre, durée, transitions' },
  { id: 'texte', index: 3, label: 'Accroche', hint: 'Le texte qui retient' },
  { id: 'son', index: 4, label: 'Son', hint: 'Bruitages et musique' },
  { id: 'cinema', index: 5, label: 'Cinéma', hint: 'Étalonnage et grain' },
  { id: 'analyse', index: 6, label: 'Analyser', hint: 'Ta note sur 100' },
  { id: 'export', index: 7, label: 'Exporter', hint: 'Récupère le fichier' },
];

/** Étape vers laquelle amener l'utilisateur quand il sélectionne un élément. */
export const STEP_FOR_SELECTION = { clip: 'montage', caption: 'texte', cue: 'son' } as const;

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

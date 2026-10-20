/**
 * Le parcours du studio, en données pures.
 *
 * Séparé des composants pour que la logique de guidage puisse s'y référer sans
 * dépendre de l'interface — et rester testable hors navigateur.
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

export type PhaseId = 'creer' | 'composer' | 'finaliser';

export type Phase = {
  id: PhaseId;
  label: string;
  hint: string;
  firstStep: StepId;
  steps: StepId[];
};

/** Trois repères simples, sans retirer les réglages avancés du studio. */
export const PHASES: Phase[] = [
  { id: 'creer', label: 'Créer', hint: 'Ajoute tes médias', firstStep: 'import', steps: ['import'] },
  {
    id: 'composer',
    label: 'Composer',
    hint: 'Construis ton film',
    firstStep: 'montage',
    steps: ['montage', 'texte', 'son', 'cinema'],
  },
  {
    id: 'finaliser',
    label: 'Finaliser',
    hint: 'Vérifie et exporte',
    firstStep: 'analyse',
    steps: ['analyse', 'export'],
  },
];

export function phaseForStep(step: StepId): Phase {
  return PHASES.find((phase) => phase.steps.includes(step)) ?? PHASES[0];
}

/** Étape vers laquelle amener l'utilisateur quand il sélectionne un élément. */
export const STEP_FOR_SELECTION = { clip: 'montage', caption: 'texte', cue: 'son' } as const;

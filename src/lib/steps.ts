/**
 * Le parcours du studio, en données pures.
 *
 * Séparé des composants pour que la logique de guidage puisse s'y référer sans
 * dépendre de l'interface — et rester testable hors navigateur.
 */

export type StepId = 'import' | 'montage' | 'composer' | 'texte' | 'son' | 'cinema' | 'analyse' | 'export';

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
  { id: 'composer', index: 3, label: 'Composer', hint: 'Paroles et intention musicale' },
  { id: 'texte', index: 4, label: 'Accroche', hint: 'Le texte qui retient' },
  { id: 'son', index: 5, label: 'Son', hint: 'Piste, bruitages et mixage' },
  { id: 'cinema', index: 6, label: 'Cinéma', hint: 'Étalonnage et grain' },
  { id: 'analyse', index: 7, label: 'Analyser', hint: 'Ta note sur 100' },
  { id: 'export', index: 8, label: 'Exporter', hint: 'Récupère le fichier' },
];

/** Étape vers laquelle amener l'utilisateur quand il sélectionne un élément. */
export const STEP_FOR_SELECTION = { clip: 'montage', caption: 'texte', cue: 'son' } as const;


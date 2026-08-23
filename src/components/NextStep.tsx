'use client';

import { useMemo } from 'react';
import { analyzeProject } from '@/lib/analysis';
import { applyAutoEdit } from '@/lib/autoEdit';
import { nextStep, type GuideAction } from '@/lib/guide';
import type { StepId } from '@/lib/steps';
import { clipDuration } from '@/lib/timeline';
import { useStudio } from '@/lib/store';
import { Button } from './ui';

/**
 * Bandeau de guidage.
 *
 * Toujours visible, il affiche une seule consigne et un seul bouton. C'est la
 * réponse à « je ne comprends pas ce que je dois faire » : l'analyse énumère
 * tout ce qui pourrait être amélioré, ce qui suppose déjà de savoir par quoi
 * commencer. Ici, la question ne se pose pas.
 */
export function NextStep({ onStep }: { onStep: (step: StepId) => void }) {
  const project = useStudio((s) => s.project);
  const duplicateClip = useStudio((s) => s.duplicateClip);
  const chopClip = useStudio((s) => s.chopClip);
  const addSoundsOnCuts = useStudio((s) => s.addSoundsOnCuts);

  const guide = useMemo(() => nextStep(project, analyzeProject(project)), [project]);

  /** Le plan le plus long : celui que toutes les consignes visent. */
  const longestId = useMemo(() => {
    const sorted = [...project.clips].sort((a, b) => clipDuration(b) - clipDuration(a));
    return sorted[0]?.id ?? null;
  }, [project.clips]);

  const run = (action: GuideAction) => {
    switch (action.kind) {
      case 'goto':
        onStep(action.step);
        break;
      case 'autoEdit':
        useStudio.setState({ project: applyAutoEdit(project), selection: null, playhead: 0, playing: false });
        break;
      case 'duplicateLongest':
        if (longestId) duplicateClip(longestId);
        break;
      case 'chopLongest':
        if (longestId) chopClip(longestId, 2);
        break;
      case 'soundsOnCuts':
        addSoundsOnCuts();
        break;
    }
  };

  return (
    <section
      aria-label="Prochaine étape"
      className={`rounded-2xl border px-3 py-2.5 ${
        guide.done ? 'border-accent/40 bg-accent/5' : 'border-edge bg-panel'
      }`}
    >
      <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
        {guide.done ? 'Tu peux publier' : 'À faire maintenant'}
      </p>
      <p className="mt-0.5 text-sm leading-snug font-semibold text-mist">{guide.title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{guide.why}</p>

      <Button
        variant={guide.done ? 'ghost' : 'primary'}
        className="mt-2 w-full"
        onClick={() => run(guide.action)}
      >
        {guide.actionLabel}
      </Button>
    </section>
  );
}

'use client';

import { useMemo } from 'react';
import { analyzeProject } from '@/lib/analysis';
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
  const montageExpress = useStudio((s) => s.montageExpress);

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
        // Par le store, pour que le montage express s'annule comme le reste.
        montageExpress();
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
      /*
       * Une bande accentuée sur le flanc plutôt qu'un cadre complet : elle
       * désigne le bloc comme prioritaire sans l'enfermer, et se distingue des
       * panneaux voisins qui, eux, n'ont plus de contour du tout.
       */
      className={`rounded-2xl border-l-[3px] px-3.5 py-3 ${
        guide.done ? 'border-l-accent bg-accent/8' : 'border-l-warn bg-panel'
      }`}
    >
      <p
        className="text-[11px] font-semibold tracking-[0.08em] uppercase"
        style={{ color: guide.done ? 'var(--color-accent)' : 'var(--color-warn)' }}
      >
        {guide.done ? 'Tu peux publier' : 'À faire maintenant'}
      </p>
      <p className="mt-1.5 text-[16px] leading-snug font-semibold text-mist">{guide.title}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{guide.why}</p>

      <Button
        variant={guide.done ? 'ghost' : 'primary'}
        className="mt-3 w-full"
        onClick={() => run(guide.action)}
      >
        {guide.actionLabel}
      </Button>
    </section>
  );
}

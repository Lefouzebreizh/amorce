'use client';

import { useEffect, useMemo } from 'react';
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
 * Disposition téléphone : une seule page qui défile.
 *
 * Les sept étapes vivaient derrière une barre d'onglets. Le raisonnement était
 * défendable — un panneau à la fois, toute la hauteur pour lui — mais il avait
 * deux coûts mesurés. La barre occupait 628 px dans un écran de 393, donc
 * Cinéma, Analyser et Exporter tenaient hors champ derrière un défilement
 * latéral que personne ne découvre. Et surtout, elle demandait de **choisir**
 * une étape avant de voir ce qu'elle contient, alors qu'on ne sait pas encore
 * ce qu'on cherche.
 *
 * Tout est donc à la suite, dans l'ordre du travail. On descend, on voit ce
 * qui existe, on s'arrête où c'est utile. C'est le geste que le pouce fait
 * déjà partout ailleurs, et il ne se rate pas.
 *
 * L'aperçu reste **collé en haut** : on règle une image, il faut la voir
 * pendant qu'on la règle. Sans cela, chaque réglage demanderait de remonter,
 * et c'est exactement ce qu'un panneau flottant faisait payer.
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

  /*
   * Le guide ne change plus d'onglet : il fait défiler jusqu'à l'étape. Le
   * parent continue de poser `step`, et c'est ce changement qu'on suit — ainsi
   * « Aller à l'import » amène vraiment à l'import, au lieu de ne rien faire
   * visiblement sur une page où tout est déjà là.
   */
  useEffect(() => {
    if (!step) return;
    document.getElementById(ancre(step))?.scrollIntoView({
      // `smooth` seulement si l'utilisateur ne l'a pas refusé : un défilement
      // animé non désiré est exactement ce que `prefers-reduced-motion` vise.
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [step]);

  return (
    // `100dvh` et non `100vh` : sur mobile, la barre d'adresse se replie en
    // cours de route et `vh` ne suit pas, ce qui ferait dépasser la page.
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <MobileHeader />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/*
          Collé en haut, et non simplement premier dans le flux : c'est ce qui
          permet de régler un plan en le regardant. `bg-ink` est obligatoire —
          un fond transparent laisserait défiler les panneaux **sous** l'image.
        */}
        {/*
          Hauteur **fixe**, pas maximale. `Preview` s'étire sur la hauteur qu'on
          lui donne ; sans valeur définie, un canvas 9:16 dans 393 px de large
          en réclame près de sept cents et mange tout l'écran. Le premier essai
          posait `max-h-[42dvh]`, qui ne contraint rien tant que rien ne fixe la
          hauteur — l'aperçu prenait toute la page.

          `z-20` et non `z-10` : la barre de lecture vit dans le même bloc, et
          les panneaux passaient dessous en défilant.
        */}
        <section className="sticky top-0 z-20 flex h-[38dvh] flex-col gap-1.5 bg-ink p-2 pb-1.5 shadow-[0_10px_18px_-10px_rgba(0,0,0,0.95)]">
          <Preview engine={engine} />
          {clipCount > 0 && <Timeline engine={engine} compact />}
        </section>

        <div className="space-y-3 px-2 pt-2 pb-8">
          <NextStep onStep={onStep} />

          {STEPS.map((item) => (
            <section
              key={item.id}
              id={ancre(item.id)}
              aria-label={item.label}
              // `scroll-mt` compense la hauteur de l'aperçu collé : sans lui,
              // un saut vers une étape la place derrière l'image.
              // Pas d'en-tête ici : chaque panneau porte déjà son titre
              // numéroté. En ajouter un le faisait paraître deux fois, et une
              // répétition se lit comme un bug avant de se lire comme un plan.
              className="scroll-mt-[40dvh]"
            >
              <StepPanel step={item.id} engine={engine} onStep={onStep} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** L'ancre d'une étape, pour que le guide puisse y faire défiler la page. */
export function ancre(id: StepId) {
  return `etape-${id}`;
}

function MobileHeader() {
  const project = useStudio((s) => s.project);
  const analysis = useMemo(() => analyzeProject(project), [project]);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);

  return (
    <header
      className="flex shrink-0 items-center justify-between gap-3 border-b border-edge px-3 py-2.5"
      style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
    >
      <span className="font-display text-[19px] tracking-tight text-mist">amorce</span>
      <div className="flex items-center gap-2">
        <UndoControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
        {analysis.shotCount > 0 && <ScoreBadge score={analysis.score} compact />}
      </div>
    </header>
  );
}

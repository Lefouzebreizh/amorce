'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
   * L'aperçu agrandi. Dans le bloc collé, l'image mesure 80 × 142 px sur un
   * Redmi — 16 % de la hauteur d'écran là où le bloc en réserve 38 %, parce que
   * la barre de lecture et la frise prennent plus de place que l'image. Agrandi,
   * elle passe à près de la largeur entière.
   *
   * On garde une bande du contenu visible dessous plutôt que d'occuper tout
   * l'écran : c'est elle qui dit que la page continue, et qui évite l'impression
   * d'être enfermé dans une vue sans sortie.
   */
  const [agrandi, setAgrandi] = useState(false);

  /*
   * Le guide ne change plus d'onglet : il fait défiler jusqu'à l'étape. Le
   * parent continue de poser `step`, et c'est ce changement qu'on suit — ainsi
   * « Aller à l'import » amène vraiment à l'import, au lieu de ne rien faire
   * visiblement sur une page où tout est déjà là.
   */
  /*
   * Et il ne se déclenche pas au montage. L'étape ouverte a déjà une valeur au
   * premier rendu, si bien que l'effet faisait défiler la page de 183 px avant
   * toute action — assez pour couper la carte « à faire maintenant », qui
   * passait à −110 px. C'est-à-dire que l'écran d'arrivée cachait précisément
   * la seule chose qui répond à « je ne sais pas quoi faire ».
   *
   * Un défilement se justifie quand l'utilisateur demande à aller quelque part.
   * Arriver n'est pas le demander.
   *
   * On compare donc l'étape à la précédente, plutôt que de compter les rendus :
   * en développement, React monte deux fois, et un garde-fou « premier rendu »
   * se laisse traverser à la seconde passe — la page défilait toujours, et rien
   * ne le signalait puisque le code avait l'air juste.
   */
  const etapePrecedente = useRef(step);
  useEffect(() => {
    const change = etapePrecedente.current !== step;
    etapePrecedente.current = step;
    if (!change || !step) return;
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
        {/*
          Et seulement s'il y a quelque chose à montrer. À vide, ce bloc
          réservait 38 % de la hauteur à un rectangle noir portant « importe
          tes vidéos » — le premier écran d'un téléphone était donc à moitié
          occupé par l'absence de contenu. Rendu conditionnel plutôt que
          replié : un aperçu de zéro pixel garde ses marges et son ombre.
        */}
        {clipCount > 0 && (
          <section
            className={`sticky top-0 z-20 flex flex-col gap-1.5 bg-ink p-2 pb-1.5 shadow-[0_10px_18px_-10px_rgba(0,0,0,0.95)] ${
              agrandi ? 'h-[80dvh]' : 'h-[38dvh]'
            }`}
          >
            <Preview engine={engine} agrandi={agrandi} onAgrandir={() => setAgrandi((v) => !v)} />
            {/*
              La frise s'efface pendant l'agrandissement : ses 98 px repris,
              c'est autant que l'image gagne, et on n'agrandit pas pour
              découper — on agrandit pour regarder.
            */}
            {!agrandi && <Timeline engine={engine} compact />}
          </section>
        )}

        <div className="space-y-3 px-2 pt-2 pb-8">
          <NextStep onStep={onStep} />

          {STEPS.map((item) => (
            <section
              key={item.id}
              id={ancre(item.id)}
              aria-label={item.label}
              // `scroll-mt` compense la hauteur de l'aperçu collé : sans lui,
              // un saut vers une étape la place derrière l'image. Il la suit
              // donc : quand l'aperçu n'est pas rendu, la même marge laisserait
              // 40 % d'écran vide au-dessus du panneau qu'on vient d'atteindre.
              // Pas d'en-tête ici : chaque panneau porte déjà son titre
              // numéroté. En ajouter un le faisait paraître deux fois, et une
              // répétition se lit comme un bug avant de se lire comme un plan.
              className={
                clipCount === 0 ? 'scroll-mt-2' : agrandi ? 'scroll-mt-[82dvh]' : 'scroll-mt-[40dvh]'
              }
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

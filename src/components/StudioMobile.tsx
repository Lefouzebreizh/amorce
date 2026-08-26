'use client';

import { useEffect, useMemo, useRef } from 'react';
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
 * Disposition téléphone.
 *
 * Rien n'est superposé : le panneau d'étape prend sa place dans le flux et
 * l'aperçu se réduit d'autant. Un panneau flottant par-dessus l'image
 * masquerait précisément ce qu'on est en train de régler, et il faudrait le
 * refermer à chaque vérification.
 *
 * L'aperçu reste donc visible en permanence, plus petit quand un panneau est
 * ouvert. C'est le compromis qu'impose un écran de téléphone : on ne peut pas
 * avoir à la fois une grande image et un panneau de réglages confortable.
 *
 * **Toutes les étapes sont dans la même page.** Elles se suivent dans la zone
 * défilante, et la barre du bas amène à l'une d'elles au lieu de masquer les
 * autres. N'afficher qu'une étape à la fois donnait sept écrans dont aucun ne
 * disait ce qu'il y avait dans les six autres : on cherchait la voix off dans
 * les bruitages, on ne savait pas qu'un réglage existait.
 *
 * L'aperçu, lui, ne défile pas. C'est ce qui rend la page unique tenable :
 * ailleurs, on règle un curseur en regardant le vide.
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
  const open = step !== null;
  const flux = useRef<HTMLElement>(null);
  /**
   * Instant du dernier défilement provoqué par un appui.
   *
   * L'observation de ce qui est à l'écran met à jour l'onglet actif pendant
   * qu'on fait défiler. Mais un appui déclenche lui aussi un défilement, et
   * les sections traversées en chemin réclameraient l'onglet tour à tour :
   * la barre clignoterait et finirait sur la mauvaise. On l'ignore donc le
   * temps que le défilement provoqué s'achève.
   */
  const guide = useRef(0);

  // Amener la section demandée, sans brusquerie.
  useEffect(() => {
    if (!step || !flux.current) return;
    guide.current = Date.now();
    flux.current.querySelector(`#section-${step}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  // Suivre ce qu'on regarde, pour que la barre dise la vérité.
  useEffect(() => {
    const zone = flux.current;
    if (!zone) return;

    const observateur = new IntersectionObserver(
      (entrees) => {
        if (Date.now() - guide.current < 700) return;
        const visible = entrees.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = visible?.target.id.replace('section-', '') as StepId | undefined;
        if (id && id !== step) onStep(id);
      },
      { root: zone, rootMargin: '0px 0px -70% 0px' },
    );

    for (const item of STEPS) {
      const cible = zone.querySelector(`#section-${item.id}`);
      if (cible) observateur.observe(cible);
    }
    return () => observateur.disconnect();
  }, [step, onStep]);

  /*
   * La timeline descend dans la section Monter, au lieu de rester sous l'aperçu.
   *
   * Mesuré sur un écran de 640 px : elle coûtait 98 px en permanence, la barre
   * de transport 66, et il ne restait que 104 px de haut à l'image — 59 px de
   * large. Or c'est sur cette image qu'on touche et déplace les sous-titres.
   * La manipulation directe, le geste le plus naturel du studio, devenait
   * impossible pour montrer une timeline dont on ne se sert qu'au montage.
   *
   * Dans le flux, elle ne coûte rien au reste du temps et ne provoque aucun
   * saut quand le défilement change l'étape courante. Hors zone de réglages,
   * elle reprend sa place sous l'aperçu, qui dispose alors de tout l'écran.
   */
  const showTimeline = clipCount > 0 && !open;

  return (
    // `100dvh` et non `100vh` : sur mobile, la barre d'adresse se replie en
    // cours de route et `vh` ne suit pas, ce qui ferait dépasser la page.
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <MobileHeader />

      {/*
        L'aperçu ne descend pas sous 13 rem.

        C'est sur lui qu'on touche et qu'on déplace les textes : à 59 px de
        large — ce que donnait une zone de réglages trop gourmande — viser un
        sous-titre au doigt devient impossible, et la manipulation directe, qui
        est le geste le plus naturel du studio, disparaît sans qu'on comprenne
        pourquoi.
      */}
      <section className="flex min-h-[13rem] flex-1 flex-col gap-2 overflow-hidden p-2">
        <Preview engine={engine} />
        {showTimeline && (
          <div className="shrink-0">
            <Timeline engine={engine} compact={open} />
          </div>
        )}
      </section>

      {open && (
        <section
          ref={flux}
          /*
           * Volontairement sans `shrink-0` : sur un écran court, la zone doit
           * pouvoir céder de la hauteur à l'aperçu, dont la place minimale est
           * garantie plus haut. La figer produirait exactement le débordement
           * qu'on cherche à éviter.
           */
          className="h-[34dvh] max-h-[22rem] min-h-[8rem] overflow-y-auto overscroll-contain border-t border-edge bg-slab px-3 pt-3 pb-5"
          aria-label="Toutes les étapes"
        >
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => onStep(null)}
              className="-mr-1 min-h-11 rounded-lg px-3 text-[13px] text-muted hover:text-mist"
            >
              Fermer ✕
            </button>
          </div>

          {/* La consigne reste en tête du flux : c'est en cherchant quoi faire
              qu'on la veut, et elle ne doit pas dépendre de l'étape regardée. */}
          <NextStep onStep={onStep} />

          {STEPS.map((item) => (
            <section key={item.id} id={`section-${item.id}`} className="scroll-mt-3 pt-6 first:pt-4">
              <div className="mb-2 flex items-baseline gap-2 px-0.5">
                <span className="font-mono text-[12px] text-muted">{item.index}</span>
                <span className="font-display text-[17px] tracking-tight text-mist">{item.label}</span>
              </div>
              <div className="space-y-3">
                {item.id === 'montage' && clipCount > 0 && <Timeline engine={engine} compact />}
                <StepPanel step={item.id} engine={engine} onStep={onStep} />
              </div>
            </section>
          ))}
        </section>
      )}

      {/* Panneau fermé, la consigne prend sa place au-dessus de la barre
          d'étapes : elle reste visible quoi qu'il arrive. */}
      {!open && (
        <div className="shrink-0 px-2 pb-2">
          <NextStep onStep={onStep} />
        </div>
      )}

      <TabBar step={step} onStep={onStep} />
    </div>
  );
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

/**
 * Barre d'onglets.
 *
 * Elle défile horizontalement plutôt que de comprimer sept étapes dans la
 * largeur d'un téléphone : des cibles trop étroites se manquent au doigt, et
 * une étape qu'on rate est une étape qu'on n'utilise pas.
 */
function TabBar({ step, onStep }: { step: StepId | null; onStep: (step: StepId | null) => void }) {
  return (
    <nav
      className="flex shrink-0 gap-1 overflow-x-auto border-t border-edge bg-ink px-2 py-1.5"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      aria-label="Étapes du montage"
    >
      {STEPS.map((item) => {
        const active = item.id === step;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'step' : undefined}
            // Un second appui sur l'étape ouverte referme le panneau et rend
            // toute la hauteur à l'aperçu.
            onClick={() => onStep(active ? null : item.id)}
            className={`min-h-12 min-w-[5.25rem] shrink-0 rounded-xl px-2 py-1.5 text-center transition-colors ${
              active ? 'bg-raised text-mist ring-1 ring-accent/60' : 'text-muted hover:bg-slab'
            }`}
          >
            <span className="block text-[11px] leading-none opacity-60">{item.index}</span>
            <span className="mt-1 block text-[12.5px] leading-tight font-semibold">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

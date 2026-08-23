'use client';

import { useMemo } from 'react';
import { analyzeProject, type Analysis, type CriterionId } from '@/lib/analysis';
import { useStudio } from '@/lib/store';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import type { StepId } from '../steps';
import { Button, EmptyState, Hint, Panel, scoreColor } from '../ui';

/**
 * Étape qui corrige chaque critère.
 *
 * Une note sans chemin vers la correction laisse l'utilisateur chercher : le
 * bouton nomme l'étape et y emmène directement.
 */
const STEP_FOR_CRITERION: Record<CriterionId, StepId> = {
  hook: 'texte',
  rythme: 'montage',
  tension: 'montage',
  texte: 'texte',
  son: 'son',
  format: 'montage',
};

const STEP_LABEL: Record<StepId, string> = {
  import: 'Importer',
  montage: 'Monter',
  texte: 'Accroche',
  son: 'Son',
  cinema: 'Cinéma',
  analyse: 'Analyser',
  export: 'Exporter',
};

/** En dessous, le critère mérite qu'on explique comment le redresser. */
const REMEDY_THRESHOLD = 0.8;

/** Durée visée par le découpage automatique, en secondes. */
const CHOP_TARGET = 2;

/**
 * Note de viralité.
 *
 * La note seule ne sert à rien : ce qui compte, c'est le conseil rattaché et le
 * moyen d'aller voir le problème. Chaque descente de tension est donc cliquable
 * et amène la tête de lecture au bon endroit.
 *
 * L'analyse porte sur la structure du montage — rythme, accroche, ponctuation —
 * et non sur le contenu des images. Le panneau le dit explicitement plutôt que
 * de laisser croire à un jugement sur la qualité du film.
 */
export function AnalysisPanel({
  engine,
  onStep,
}: {
  engine: PlaybackEngine;
  onStep: (step: StepId) => void;
}) {
  const project = useStudio((s) => s.project);
  const analysis = useMemo(() => analyzeProject(project), [project]);
  const chopClip = useStudio((s) => s.chopClip);
  const addSoundsOnCuts = useStudio((s) => s.addSoundsOnCuts);
  const fillTensionGaps = useStudio((s) => s.fillTensionGaps);

  /**
   * Correction applicable en un appui, quand le geste ne demande aucun choix.
   *
   * Tout ne s'automatise pas : écrire une accroche ou choisir quoi couper
   * relève de l'intention, et un bouton qui déciderait à la place produirait
   * une vidéo que personne n'a voulue. Ces critères-là renvoient à l'étape
   * correspondante plutôt que d'agir.
   */
  const autoFix = useMemo(() => {
    const fixes: Partial<Record<CriterionId, { label: string; run: () => void }>> = {};

    const longest = [...project.clips].sort(
      (a, b) => (b.outPoint - b.inPoint) / b.speed - (a.outPoint - a.inPoint) / a.speed,
    )[0];
    if (longest && (longest.outPoint - longest.inPoint) / longest.speed > 3.5) {
      fixes.rythme = {
        label: `✂ Découper le plan le plus long en morceaux de ${CHOP_TARGET} s`,
        run: () => chopClip(longest.id, CHOP_TARGET),
      };
    }

    fixes.son = {
      label: '♪ Poser un bruitage sur chaque coupe',
      run: addSoundsOnCuts,
    };

    if (analysis.slumps.length > 0) {
      fixes.tension = {
        label: `✨ Relancer l’attention dans ${analysis.slumps.length} passage${analysis.slumps.length > 1 ? 's' : ''}`,
        run: () => fillTensionGaps(analysis.slumps.map((slump) => slump.start)),
      };
    }

    return fixes;
  }, [project.clips, analysis.slumps, chopClip, addSoundsOnCuts, fillTensionGaps]);

  if (analysis.shotCount === 0) {
    return (
      <Panel title="6 · Analyser" subtitle="Une note sur 100 et la liste de ce qui fait décrocher.">
        <EmptyState title="Rien à analyser">
          Monte au moins un plan, puis reviens ici. L’analyse notera l’accroche, le rythme, la tenue de
          la tension, les sous-titres et le son.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      <Panel title="6 · Note de viralité" subtitle="Ce que la structure de ton montage laisse présager.">
        <ScoreHeader analysis={analysis} />

        <div className="mt-4 space-y-3">
          {analysis.criteria.map((criterion) => {
            const target = STEP_FOR_CRITERION[criterion.id];
            const needsWork = criterion.score < REMEDY_THRESHOLD;

            return (
              <div key={criterion.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-mist">{criterion.label}</span>
                  <span className="font-mono text-[11px] text-muted">
                    {Math.round(criterion.score * criterion.weight)} / {criterion.weight}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slab">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${Math.round(criterion.score * 100)}%`,
                      backgroundColor: scoreColor(criterion.score),
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted">{criterion.detail}</p>

                {needsWork && (
                  <div className="mt-1.5 rounded-lg border border-edge bg-slab/70 p-2.5">
                    <p className="text-[11px] leading-relaxed text-mist">
                      <span className="font-semibold">Comment corriger : </span>
                      {criterion.remedy}
                    </p>

                    {autoFix[criterion.id] ? (
                      <>
                        <Button
                          variant="primary"
                          className="mt-2 w-full text-[11px]"
                          onClick={autoFix[criterion.id]!.run}
                        >
                          {autoFix[criterion.id]!.label}
                        </Button>
                        <p className="mt-1 text-[10px] text-muted">
                          Le bouton ↶ du bandeau annule si le résultat ne te plaît pas.
                        </p>
                      </>
                    ) : (
                      <Button
                        variant="subtle"
                        className="mt-1 px-0 text-[11px]"
                        onClick={() => onStep(target)}
                      >
                        Aller à « {STEP_LABEL[target]} » →
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="Courbe de tension"
        subtitle="L’attention que ton montage relance au fil du temps. Les creux marqués sont les décrochages."
      >
        <TensionChart analysis={analysis} onSeek={engine.seek} />

        {analysis.slumps.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {analysis.slumps.map((slump) => (
              <li key={slump.start}>
                <button
                  type="button"
                  onClick={() => engine.seek(slump.start)}
                  className="w-full rounded-lg border border-warn/30 bg-warn/5 px-2.5 py-1.5 text-left text-[11px] text-warn transition-colors hover:bg-warn/10"
                >
                  {slump.duration.toFixed(1)} s de creux à partir de {slump.start.toFixed(1)} s — cliquer pour
                  y aller
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-accent">Aucun décrochage détecté. Le rythme tient du début à la fin.</p>
        )}
      </Panel>

      {analysis.advice.length > 0 && (
        <Panel title="Ce qu’il faut corriger" subtitle="Trié par nombre de points à récupérer.">
          <ul className="space-y-1.5">
            {analysis.advice.map((item, index) => (
              <li
                key={index}
                className="flex gap-2.5 rounded-xl border border-edge bg-slab px-3 py-2"
              >
                <span className="shrink-0 font-mono text-xs font-semibold text-accent">+{item.impact}</span>
                <span className="text-xs leading-relaxed text-mist">{item.message}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Hint>
        L’analyse juge la <strong className="text-mist">structure</strong> du montage : cadence des
        coupes, présence d’une accroche, ponctuation sonore, couverture en texte. Elle ne regarde pas
        le contenu des images — une note élevée ne dit pas que ton idée est bonne, seulement que rien
        dans le montage ne fera fuir le spectateur.
      </Hint>
    </div>
  );
}

function ScoreHeader({ analysis }: { analysis: Analysis }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-edge bg-slab px-4 py-3">
      <div className="text-center">
        <p className="font-display text-4xl leading-none" style={{ color: scoreColor(analysis.score) }}>
          {analysis.score}
        </p>
        <p className="mt-0.5 text-[10px] text-muted">sur 100</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-mist">{analysis.verdict}</p>
        <p className="mt-0.5 text-[11px] text-muted">
          {analysis.shotCount} plan{analysis.shotCount > 1 ? 's' : ''} · {analysis.duration.toFixed(1)} s ·{' '}
          {analysis.averageShot.toFixed(1)} s par plan
        </p>
      </div>
    </div>
  );
}

/** Courbe d'attention, tracée en SVG et cliquable pour se déplacer. */
function TensionChart({ analysis, onSeek }: { analysis: Analysis; onSeek: (time: number) => void }) {
  const width = 300;
  const height = 64;
  const { curve, duration } = analysis;

  if (curve.length < 2) return null;

  const points = curve
    .map((sample) => {
      const x = (sample.time / duration) * width;
      const y = height - sample.value * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-16 w-full cursor-pointer"
      preserveAspectRatio="none"
      role="img"
      aria-label="Courbe de tension du montage"
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        onSeek(((event.clientX - bounds.left) / bounds.width) * duration);
      }}
    >
      {/* Zones de décrochage, peintes sous la courbe pour rester lisibles. */}
      {analysis.slumps.map((slump) => (
        <rect
          key={slump.start}
          x={(slump.start / duration) * width}
          y={0}
          width={((slump.end - slump.start) / duration) * width}
          height={height}
          fill="var(--color-warn)"
          opacity={0.14}
        />
      ))}

      <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

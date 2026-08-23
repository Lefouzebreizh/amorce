'use client';

import { useMemo } from 'react';
import { analyzeProject, type Analysis } from '@/lib/analysis';
import { useStudio } from '@/lib/store';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import { EmptyState, Hint, Panel } from '../ui';

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
export function AnalysisPanel({ engine }: { engine: PlaybackEngine }) {
  const project = useStudio((s) => s.project);
  const analysis = useMemo(() => analyzeProject(project), [project]);

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

        <div className="mt-4 space-y-2.5">
          {analysis.criteria.map((criterion) => (
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
                    backgroundColor: barColor(criterion.score),
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted">{criterion.detail}</p>
            </div>
          ))}
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

function barColor(score: number): string {
  if (score >= 0.75) return 'var(--color-accent)';
  if (score >= 0.45) return 'var(--color-warn)';
  return 'var(--color-danger)';
}

function ScoreHeader({ analysis }: { analysis: Analysis }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-edge bg-slab px-4 py-3">
      <div className="text-center">
        <p className="font-display text-4xl leading-none" style={{ color: barColor(analysis.score / 100) }}>
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

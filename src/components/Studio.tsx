'use client';

import { useEffect, useMemo, useState } from 'react';
import { analyzeProject } from '@/lib/analysis';
import type { FontSet } from '@/lib/captions';
import { useStudio } from '@/lib/store';
import { usePlayback } from '@/hooks/usePlayback';
import { Preview } from './Preview';
import { Timeline } from './Timeline';
import { AnalysisPanel } from './panels/AnalysisPanel';
import { CinemaPanel } from './panels/CinemaPanel';
import { ClipPanel } from './panels/ClipPanel';
import { ExportPanel } from './panels/ExportPanel';
import { ImportPanel } from './panels/ImportPanel';
import { SoundPanel } from './panels/SoundPanel';
import { TextPanel } from './panels/TextPanel';

/**
 * Coque du studio.
 *
 * Le parcours est numéroté de 1 à 7 et toujours visible. Un éditeur vidéo
 * classique pose tous ses outils à plat et laisse l'utilisateur deviner par où
 * commencer ; ici l'ordre est donné, quitte à ce qu'un habitué le contourne en
 * cliquant directement sur l'étape qui l'intéresse.
 */

type StepId = 'import' | 'montage' | 'texte' | 'son' | 'cinema' | 'analyse' | 'export';

const STEPS: { id: StepId; index: number; label: string; hint: string }[] = [
  { id: 'import', index: 1, label: 'Importer', hint: 'Charge tes rushes' },
  { id: 'montage', index: 2, label: 'Monter', hint: 'Ordre, durée, transitions' },
  { id: 'texte', index: 3, label: 'Accroche', hint: 'Le texte qui retient' },
  { id: 'son', index: 4, label: 'Son', hint: 'Bruitages et musique' },
  { id: 'cinema', index: 5, label: 'Cinéma', hint: 'Étalonnage et grain' },
  { id: 'analyse', index: 6, label: 'Analyser', hint: 'Ta note sur 100' },
  { id: 'export', index: 7, label: 'Exporter', hint: 'Récupère le fichier' },
];

/**
 * Résout les polices réellement chargées.
 *
 * Le canvas a besoin du nom de famille effectif — une variable CSS n'y a aucun
 * sens. On lit donc la valeur calculée une fois la page montée, avec un repli
 * sur les polices système au cas où le chargement échouerait.
 */
const FALLBACK_FONTS: FontSet = { display: 'system-ui, sans-serif', body: 'system-ui, sans-serif' };

function readFonts(): FontSet {
  // Le rendu serveur n'a pas de feuille de style calculée : on y renvoie le
  // repli, remplacé par les vraies polices dès l'hydratation. Aucune incidence
  // sur le HTML produit, ces valeurs ne servent qu'au canvas.
  if (typeof document === 'undefined') return FALLBACK_FONTS;

  const styles = getComputedStyle(document.documentElement);
  const display = styles.getPropertyValue('--font-display').trim();
  const body = styles.getPropertyValue('--font-body').trim();
  return display && body ? { display, body } : FALLBACK_FONTS;
}

function useFonts(): FontSet {
  const [fonts] = useState<FontSet>(readFonts);
  return fonts;
}

export function Studio() {
  const fonts = useFonts();
  const engine = usePlayback(fonts);
  const [step, setStep] = useState<StepId>('import');
  // Sélectionner un plan sur la timeline amène l'étape qui sait le régler :
  // sans cela, le clic ouvrirait un panneau qui ne parle pas de ce qu'on vient
  // de sélectionner, et rien n'indiquerait où aller.
  //
  // Le changement passe par l'abonnement au store plutôt que par un effet
  // dépendant de la sélection : on ne réagit qu'aux transitions réelles, sans
  // déclencher de rendu en cascade à chaque modification du projet.
  useEffect(
    () =>
      useStudio.subscribe((state, previous) => {
        if (state.selection === previous.selection || state.selection === null) return;
        const target = { clip: 'montage', caption: 'texte', cue: 'son' } as const;
        setStep(target[state.selection.kind]);
      }),
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Ne jamais voler une frappe destinée à un champ de saisie.
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const store = useStudio.getState();
      if (event.code === 'Space') {
        event.preventDefault();
        engine.toggle();
      } else if (event.key === 's' || event.key === 'S') {
        store.splitClipAtPlayhead();
      } else if (event.key === 'ArrowLeft') {
        engine.seek(store.playhead - (event.shiftKey ? 1 : 0.1));
      } else if (event.key === 'ArrowRight') {
        engine.seek(store.playhead + (event.shiftKey ? 1 : 0.1));
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      <main className="flex min-h-0 flex-1">
        <nav className="hidden w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-edge p-3 lg:flex">
          {STEPS.map((item) => {
            const active = item.id === step;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(item.id)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  active ? 'border-accent bg-accent/10' : 'border-transparent hover:border-edge hover:bg-slab'
                }`}
              >
                <span className={`text-xs font-semibold ${active ? 'text-mist' : 'text-muted'}`}>
                  {item.index}. {item.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted">{item.hint}</span>
              </button>
            );
          })}
        </nav>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-3">
          <Preview engine={engine} />
          <div className="shrink-0">
            <Timeline engine={engine} />
          </div>
        </section>

        <aside className="w-full max-w-sm shrink-0 overflow-y-auto border-l border-edge p-3">
          {/* Sur écran étroit, la navigation par étapes bascule au-dessus du panneau. */}
          <div className="mb-3 flex gap-1 overflow-x-auto lg:hidden">
            {STEPS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(item.id)}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  item.id === step ? 'border-accent bg-accent/10 text-mist' : 'border-edge text-muted'
                }`}
              >
                {item.index}. {item.label}
              </button>
            ))}
          </div>

          {step === 'import' && <ImportPanel />}
          {step === 'montage' && <ClipPanel />}
          {step === 'texte' && <TextPanel />}
          {step === 'son' && <SoundPanel engine={engine} />}
          {step === 'cinema' && <CinemaPanel />}
          {step === 'analyse' && <AnalysisPanel engine={engine} />}
          {step === 'export' && <ExportPanel engine={engine} />}
        </aside>
      </main>
    </div>
  );
}

function Header() {
  const project = useStudio((s) => s.project);
  const analysis = useMemo(() => analyzeProject(project), [project]);

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-edge px-4 py-2.5">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-lg tracking-tight text-mist">amorce</span>
        <span className="hidden text-xs text-muted sm:block">
          Le studio qui rend tes vidéos IA virales — tout se passe dans ton navigateur
        </span>
      </div>

      {analysis.shotCount > 0 && (
        <div className="flex items-center gap-2 rounded-full border border-edge bg-slab px-3 py-1">
          <span className="text-[11px] text-muted">Viralité</span>
          <span
            className="font-display text-sm"
            style={{
              color:
                analysis.score >= 75
                  ? 'var(--color-accent)'
                  : analysis.score >= 45
                    ? 'var(--color-warn)'
                    : 'var(--color-danger)',
            }}
          >
            {analysis.score}
          </span>
        </div>
      )}
    </header>
  );
}

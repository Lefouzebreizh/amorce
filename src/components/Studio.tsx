'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FontSet } from '@/lib/captions';
import { useStudio } from '@/lib/store';
import { useIsCompact } from '@/hooks/useMediaQuery';
import { usePlayback } from '@/hooks/usePlayback';
import { usePersistence } from '@/hooks/usePersistence';
import { StudioDesktop } from './StudioDesktop';
import { StudioMobile } from './StudioMobile';
import { STEP_FOR_SELECTION, type StepId } from '@/lib/steps';

/**
 * Point d'entrée du studio.
 *
 * Le moteur de lecture, les polices et l'étape courante vivent ici, au-dessus
 * des deux dispositions : passer de l'une à l'autre — rotation de l'écran,
 * fenêtre redimensionnée — ne doit ni interrompre la lecture ni ramener
 * l'utilisateur à la première étape.
 */

const FALLBACK_FONTS: FontSet = { display: 'system-ui, sans-serif', body: 'system-ui, sans-serif' };

/**
 * Résout les polices réellement chargées.
 *
 * Le canvas a besoin du nom de famille effectif — une variable CSS n'y a aucun
 * sens. Le rendu serveur, qui n'a pas de feuille de style calculée, retombe sur
 * les polices système ; ces valeurs ne servent qu'au canvas et n'apparaissent
 * jamais dans le HTML produit.
 */
function readFonts(): FontSet {
  if (typeof document === 'undefined') return FALLBACK_FONTS;

  const styles = getComputedStyle(document.documentElement);
  const display = styles.getPropertyValue('--font-display').trim();
  const body = styles.getPropertyValue('--font-body').trim();
  return display && body ? { display, body } : FALLBACK_FONTS;
}

export function Studio() {
  const [fonts] = useState<FontSet>(readFonts);
  const engine = usePlayback(fonts);
  const compact = useIsCompact();
  usePersistence();

  // Sur téléphone, aucun panneau n'est ouvert au départ : l'aperçu occupe tout
  // l'écran, et le parcours s'offre dans la barre du bas.
  const [step, setStep] = useState<StepId | null>('import');

  // Sélectionner un élément amène l'étape qui sait le régler. Le changement
  // passe par l'abonnement au store plutôt que par un effet dépendant de la
  // sélection : on ne réagit qu'aux transitions réelles, sans déclencher de
  // rendu en cascade à chaque modification du projet.
  useEffect(
    () =>
      useStudio.subscribe((state, previous) => {
        if (state.selection === previous.selection || state.selection === null) return;
        setStep(STEP_FOR_SELECTION[state.selection.kind]);
      }),
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Ne jamais voler une frappe destinée à un champ de saisie.
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const store = useStudio.getState();

      // Annulation au clavier, avec Maj pour rétablir — la convention partout.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }

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

  const openStep = useCallback((next: StepId) => setStep(next), []);

  if (compact) {
    return <StudioMobile engine={engine} step={step} onStep={setStep} />;
  }

  // La colonne latérale d'un grand écran affiche toujours une étape : on
  // retombe sur l'import si le panneau avait été refermé côté téléphone.
  return <StudioDesktop engine={engine} step={step ?? 'import'} onStep={openStep} />;
}

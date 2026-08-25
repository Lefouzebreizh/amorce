'use client';

import { useEffect, useRef } from 'react';
import { fromStored, requiredFiles, toStored } from '@/lib/persist';
import { loadFiles, loadProject, pruneFiles, saveProject } from '@/lib/storage';
import { useStudio } from '@/lib/store';

/**
 * Retrouve le montage de la dernière visite, puis le tient à jour.
 *
 * Tout se passe après le montage du composant, jamais au chargement du module :
 * l'état initial doit rester identique côté serveur et côté navigateur, sinon
 * l'hydratation diverge. Le studio s'ouvre donc sur un projet vide, remplacé
 * une fraction de seconde plus tard s'il y avait quelque chose à reprendre.
 */

/**
 * Délai d'inactivité avant écriture.
 *
 * Écrire à chaque frappe saturerait la base pendant qu'on saisit un sous-titre.
 * Attendre l'arrêt du geste suffit — et le départ de la page est rattrapé
 * séparément, sans quoi fermer l'onglet juste après une modification la perdrait.
 */
const SAVE_DEBOUNCE_MS = 800;

export function useProjectPersistence(): void {
  /** Empêche l'écriture tant que la reprise n'a pas eu lieu. */
  const ready = useRef(false);
  /** Le double montage du mode strict ne doit pas reprendre deux fois. */
  const started = useRef(false);

  useEffect(() => {
    /*
     * Le mode strict monte, démonte, puis remonte. La reprise ne doit donc avoir
     * lieu qu'une fois — d'où ce drapeau — et surtout, le démontage intermédiaire
     * ne doit rien interrompre : une lecture annulée en cours de route laisserait
     * la sauvegarde définitivement désarmée, et le montage ne serait plus jamais
     * écrit. Rien n'est à nettoyer ici, le projet retrouvé partant dans un store
     * extérieur à React, qui survit au cycle de vie du composant.
     */
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        const stored = await loadProject();
        if (!stored) return;

        const blobs = await loadFiles(requiredFiles(stored));
        const urls = new Map<string, string>();
        for (const [id, blob] of blobs) urls.set(id, URL.createObjectURL(blob));

        const project = fromStored(stored, urls);
        // Un projet dont plus aucun fichier n'a été retrouvé n'apporte rien, et
        // remplacerait le projet neuf par un montage vide portant son ancien nom.
        if (project.assets.length === 0) {
          for (const url of urls.values()) URL.revokeObjectURL(url);
          return;
        }

        useStudio.getState().restore(project);
        // Les fichiers qu'aucun média ne réclame plus occupent le quota pour rien.
        void pruneFiles(requiredFiles(toStored(project)));
      } finally {
        ready.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      if (!ready.current) return;
      clearTimeout(timer);
      void saveProject(toStored(useStudio.getState().project));
    };

    const unsubscribe = useStudio.subscribe((state, previous) => {
      if (state.project === previous.project || !ready.current) return;
      clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
    });

    // `pagehide` plutôt que `beforeunload` : c'est le seul évènement que les
    // navigateurs mobiles émettent de façon fiable quand on quitte l'onglet.
    window.addEventListener('pagehide', flush);

    return () => {
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('pagehide', flush);
    };
  }, []);
}

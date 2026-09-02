'use client';

import { useEffect } from 'react';
import { clear, load, save, worthSaving } from '@/lib/persistence';
import { useStudio } from '@/lib/store';

/**
 * Reprise du montage entre deux visites.
 *
 * Deux précautions gouvernent ce qui suit.
 *
 * La relecture n'a lieu qu'après le montage du composant, jamais dans l'état
 * initial : le serveur et le navigateur doivent partir de valeurs identiques,
 * sans quoi la première image sort dans la mauvaise disposition. Elle est aussi
 * abandonnée si l'utilisateur a déjà importé quelque chose entre-temps — sur un
 * gros projet la lecture prend le temps qu'elle prend, et écraser un rush
 * fraîchement déposé serait pire que de ne rien reprendre.
 *
 * L'écriture attend que les modifications cessent. Faire glisser une jauge
 * produit des dizaines de changements par seconde, et enregistrer à chacun
 * mettrait le stockage à genoux pour un résultat qui ne survit qu'un instant.
 */

/** Délai de calme avant d'écrire, en millisecondes. */
const QUIET_MS = 900;

export function usePersistence(): void {
  useEffect(() => {
    let abandoned = false;

    void load()
      .then((project) => {
        if (abandoned || !project) return;
        // L'utilisateur n'a rien fait pendant la lecture : on peut reprendre.
        if (useStudio.getState().project.assets.length > 0) return;
        useStudio.setState({ project, selection: null, playhead: 0, playing: false });
      })
      .catch(() => {
        // Stockage indisponible — navigation privée, quota refusé. Le studio
        // fonctionne exactement comme avant, sans reprise.
        useStudio.setState({ storageError: 'Reprise indisponible sur ce navigateur.' });
      });

    return () => {
      abandoned = true;
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previous = useStudio.getState().project;

    const unsubscribe = useStudio.subscribe((state) => {
      if (state.project === previous) return;
      previous = state.project;

      // Un projet devenu vide n'est pas « rien à faire » : c'est un effacement.
      // Rendre la main ici laissait les rushes dans le stockage pour toujours,
      // puisque c'est `save` qui porte le ménage des fichiers déréférencés — et
      // retirer son dernier rush est précisément le geste de qui veut que ses
      // vidéos disparaissent. `clear` existait pour ça, sans être appelé.
      const projet = previous;
      const conserver = worthSaving(projet);

      clearTimeout(timer);
      timer = setTimeout(() => {
        void (conserver ? save(projet) : clear())
          .then(() => {
            if (useStudio.getState().storageError) useStudio.setState({ storageError: null });
          })
          .catch(() => {
            // Un effacement qui échoue ne parle pas de place manquante : le
            // message doit dire ce qui s'est passé, sans quoi l'utilisateur
            // croit son montage perdu alors qu'il est intact.
            useStudio.setState({
              storageError: conserver
                ? 'Ton montage ne peut pas être conservé : il n’y a plus de place sur cet appareil. Exporte avant de fermer.'
                : 'Les fichiers gardés sur cet appareil n’ont pas pu être effacés. Réessaie, ou vide les données du site.',
            });
          });
      }, QUIET_MS);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}

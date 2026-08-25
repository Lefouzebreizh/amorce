'use client';

import { useEffect } from 'react';
import { drainShared, sharedCount } from '@/lib/share';
import { useStudio } from '@/lib/store';

/**
 * Enregistre le service worker et récupère ce qu'il a reçu.
 *
 * Le worker n'est là que pour une chose : rendre Amorce destinataire du bouton
 * « Partager » d'Android, dont les octets arrivent intacts là où le sélecteur de
 * fichiers en rend parfois zéro.
 *
 * Une réserve : Android ne propose la cible de partage que si l'application est
 * **installée** sur l'écran d'accueil. Tant qu'elle ne l'est pas, ce worker ne
 * sert à rien — d'où la consigne affichée dans l'étape Importer, sans laquelle
 * la fonction dormirait sans que personne ne sache qu'elle existe.
 *
 * Si un partage survenait avant que le worker ne soit actif, la requête partirait
 * sur le réseau et échouerait. La fenêtre est étroite — Chrome n'expose la cible
 * qu'après une installation, qui exige elle-même un worker enregistré — mais elle
 * existe, et c'est la seule circonstance où un fichier quitterait l'appareil.
 */
export function useSharedFiles(onReceived: () => void): void {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // `updateViaCache: 'none'` : le worker lui-même ne doit jamais venir d'un
    // cache HTTP. C'est ce qui garantit qu'une correction parvienne à l'appareil
    // au lieu d'y rester bloquée derrière une version périmée.
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {
        // Navigation privée, contexte non sécurisé, navigateur sans worker : le
        // studio fonctionne exactement comme avant, sans partage.
      });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sharedCount(window.location.search) === 0) return;

    let abandoned = false;

    void drainShared()
      .then((files) => {
        if (abandoned || files.length === 0) return;
        useStudio.getState().setSharedFiles(files);
        onReceived();
      })
      .catch(() => undefined)
      .finally(() => {
        // Le drapeau est effacé de l'adresse : sans cela, un rechargement
        // rejouerait un partage déjà traité, et l'utilisateur ne comprendrait
        // pas d'où vient le doublon.
        if (!abandoned) window.history.replaceState(null, '', window.location.pathname);
      });

    return () => {
      abandoned = true;
    };
  }, [onReceived]);
}

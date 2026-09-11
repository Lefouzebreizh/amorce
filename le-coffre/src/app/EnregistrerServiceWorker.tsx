'use client';

import { useEffect } from 'react';

// Enregistre le service worker de la PWA — un composant client isolé,
// jamais dans `layout.tsx` lui-même, qui reste un composant serveur.
// `navigator.serviceWorker` n'existe que sur HTTPS (ou localhost) : absent
// silencieusement ailleurs, sans erreur à afficher.
export function EnregistrerServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Une PWA non installable en repli reste une application qui
        // fonctionne normalement dans l'onglet — jamais bloquant.
      });
    }
  }, []);
  return null;
}

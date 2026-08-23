'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Suit une media query CSS depuis React.
 *
 * `useSyncExternalStore` est l'outil prévu pour lire une source extérieure à
 * React : il évite le couple effet + `setState` qui rendrait la première image
 * dans la mauvaise disposition, et il resynchronise de lui-même si la valeur
 * change entre le rendu et l'abonnement — rotation de l'écran, par exemple.
 *
 * Le rendu serveur, qui n'a pas de fenêtre, retombe sur `fallback`.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return fallback;
    return window.matchMedia(query).matches;
  }, [query, fallback]);

  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Vrai sur les écrans étroits, où la disposition passe en une seule colonne. */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}

/** Vrai quand le pointeur est un doigt : glisser-déposer et survol sont exclus. */
export function useIsTouch(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/*
 * État renvoyé par l'action du Bilan Patrimoine.
 *
 * Séparé de `bilan.ts` ('use server') parce qu'un fichier `'use server'` ne
 * peut exporter que des fonctions asynchrones — une constante ou un type y
 * fait échouer le build. Même séparation que `etat.ts` / `projets.ts`.
 */
import type { ErreursChamps } from '@/lib/validation';
import type { Bilan } from '@/lib/bilan/redaction';
import type { Situation } from '@/lib/bilan/modeles';

export type EtatBilan = {
  statut: 'inactif' | 'succes' | 'erreur';
  message: string;
  erreurs: ErreursChamps;
  bilan: Bilan | null;
  situation: Situation | null;
};

export const ETAT_INITIAL_BILAN: EtatBilan = {
  statut: 'inactif',
  message: '',
  erreurs: {},
  bilan: null,
  situation: null,
};

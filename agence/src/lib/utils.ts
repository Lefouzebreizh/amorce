import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Fusionne des classes Tailwind en laissant la dernière gagner.
 * `clsx` seul concaténerait `px-2` et `px-4` sans que l'ordre décide.
 */
export function cn(...entrees: ClassValue[]): string {
  return twMerge(clsx(entrees));
}

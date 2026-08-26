/*
 * État renvoyé par toutes les Server Actions de formulaire.
 *
 * Une forme unique pour tous les formulaires : `useActionState` la reçoit telle
 * quelle, le composant affiche `message` et pose `erreurs[champ]` sous le champ
 * concerné. L'objet doit rester sérialisable — il traverse la frontière
 * serveur / navigateur.
 */
import type { ErreursChamps } from '@/lib/validation';

export type EtatFormulaire = {
  statut: 'inactif' | 'succes' | 'erreur';
  message: string;
  erreurs: ErreursChamps;
};

export const ETAT_INITIAL: EtatFormulaire = {
  statut: 'inactif',
  message: '',
  erreurs: {},
};

export function echec(message: string, erreurs: ErreursChamps = {}): EtatFormulaire {
  return { statut: 'erreur', message, erreurs };
}

export function succes(message: string): EtatFormulaire {
  return { statut: 'succes', message, erreurs: {} };
}

/**
 * Trace l'incident côté serveur et renvoie une phrase destinée à l'utilisateur.
 *
 * Le message d'origine n'est jamais transmis au navigateur : celui d'une erreur
 * PostgREST cite le nom des tables et des politiques, celui d'une exception
 * réseau cite l'hôte interne. L'utilisateur n'en fera rien, un attaquant si.
 */
export function journaliser(cause: unknown, repli: string): EtatFormulaire {
  console.error('[socle-agence]', cause);
  return echec(repli);
}

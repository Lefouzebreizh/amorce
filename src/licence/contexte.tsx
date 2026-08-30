'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { type Licence } from './useLicence.ts';
import { ETAT_INITIAL } from './types.ts';

/**
 * L'état de licence, partagé par la coque et par le panneau qui le règle.
 *
 * Un contexte plutôt qu'une prop enfilée : le studio a **deux coques** —
 * téléphone et ordinateur — qui rendent les mêmes panneaux, et faire passer
 * l'état par leurs signatures obligeait à modifier les deux à chaque fois. Un
 * contexte plutôt que le magasin du projet, aussi : la licence n'est pas une
 * décision de montage, elle n'a rien à faire dans l'historique d'annulation.
 *
 * Le repli hors fournisseur n'est pas une commodité de test : il garantit
 * qu'un panneau rendu isolément retombe sur l'offre libre au lieu de lever.
 * Un studio qui refuserait de s'afficher parce qu'une facture n'a pas pu être
 * lue serait exactement ce que la frontière du §4 interdit.
 */
const Contexte = createContext<Licence | null>(null);

/*
 * L'état est reçu, pas fabriqué ici.
 *
 * La coque appelle `useLicence` elle-même : elle a besoin du statut avant de
 * construire le moteur, pour lui donner sa signature. Le laisser naître dans
 * le fournisseur obligerait à un second appel, donc à une seconde requête au
 * serveur pour la même clé au démarrage.
 */
export function FournisseurLicence({ valeur, children }: { valeur: Licence; children: ReactNode }) {
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

const HORS_FOURNISSEUR: Licence = {
  etat: ETAT_INITIAL,
  cle: '',
  verification: false,
  serveur: false,
  erreur: null,
  enregistrer: async () => ETAT_INITIAL,
  retirer: () => undefined,
};

export function useLicenceContexte(): Licence {
  return useContext(Contexte) ?? HORS_FOURNISSEUR;
}

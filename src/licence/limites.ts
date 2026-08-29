import { type Etat, type Statut } from './types.ts';

/**
 * Ce que l'offre libre borne, et ce que l'abonnement ouvre.
 *
 * **C'est le seul endroit à modifier pour changer l'offre.** Une valeur
 * recopiée ailleurs deviendrait fausse le jour où celle-ci change, et personne
 * ne s'en apercevrait avant qu'un client paie pour quelque chose qu'il avait
 * déjà.
 *
 * Le principe qui a présidé au découpage : **rien n'est mutilé.** On peut
 * monter, régler, écouter et exporter sans payer. Ce que l'abonnement retire,
 * c'est la signature sur l'image et le compteur — pas une fonction du studio.
 * Le public visé est celui que l'urgence fabriquée blesse le plus, et un
 * studio qui retiendrait une fonctionnalité en otage serait exactement le
 * procédé qu'on s'interdit.
 */
export type Capacite =
  /** Une signature discrète sur l'image exportée. */
  | 'sansSignature'
  /** Le nombre d'exports par jour. */
  | 'exportsParJour'
  /** L'export en pleine définition, 1080 × 1920. */
  | 'pleineDefinition';

type Bornes = {
  sansSignature: boolean;
  exportsParJour: number;
  pleineDefinition: boolean;
};

export const OFFRES: Record<Exclude<Statut, 'inconnu'>, Bornes> = {
  libre: {
    sansSignature: false,
    exportsParJour: 3,
    pleineDefinition: false,
  },
  pro: {
    sansSignature: true,
    exportsParJour: Number.POSITIVE_INFINITY,
    pleineDefinition: true,
  },
};

/**
 * Les bornes qui s'appliquent, y compris quand on ne sait rien.
 *
 * `inconnu` retombe sur l'offre libre, et jamais l'inverse. Un serveur éteint,
 * une connexion coupée, une réponse en retard : dans tous ces cas le studio
 * fonctionne, avec les bornes de l'offre libre. C'est la seule lecture qui
 * respecte la règle du dépôt — *le studio doit rester utilisable si le serveur
 * est éteint* — et c'est aussi la seule qui ne fasse pas payer une panne à
 * quelqu'un qui n'y est pour rien.
 *
 * L'inverse — ouvrir le pro par défaut — serait plus généreux une seconde et
 * odieux la suivante : l'interface retirerait ce qu'elle vient d'accorder.
 */
export function bornes(etat: Etat): Bornes {
  return OFFRES[etat.statut === 'pro' ? 'pro' : 'libre'];
}

/** Vrai si la capacité demandée est ouverte dans cet état. */
export function autorise(etat: Etat, capacite: 'sansSignature' | 'pleineDefinition'): boolean {
  return bornes(etat)[capacite];
}

/**
 * Combien d'exports restent aujourd'hui.
 *
 * Le compte est fourni par l'appelant plutôt que lu ici : ce module ne garde
 * aucun état et ne touche à aucun stockage. C'est ce qui lui permet d'être
 * testé sans navigateur, et de rester une décision plutôt qu'une mémoire.
 */
export function exportsRestants(etat: Etat, dejaFaitsAujourdhui: number): number {
  return Math.max(0, bornes(etat).exportsParJour - dejaFaitsAujourdhui);
}

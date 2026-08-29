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
 * monter, régler, écouter et exporter autant qu'on veut sans payer. Ce que
 * l'abonnement retire vit dans l'image produite — la signature, la définition —
 * pas dans le studio. Le public visé est celui que l'urgence fabriquée blesse
 * le plus, et un studio qui retiendrait une fonctionnalité en otage serait
 * exactement le procédé qu'on s'interdit.
 */
export type Capacite =
  /** Une signature discrète sur l'image exportée. */
  | 'sansSignature'
  /** L'export en pleine définition, 1080 × 1920. */
  | 'pleineDefinition';

type Bornes = Record<Capacite, boolean>;

/*
 * Pas de plafond d'exports par jour, et la raison n'est pas commerciale.
 *
 * Un tel plafond ne s'applique nulle part. Le montage et l'export tournent
 * entièrement dans le navigateur : un compteur gardé sur l'appareil s'efface
 * en trois secondes, et le porter côté serveur reviendrait à lui envoyer ce
 * que la personne fabrique et quand — c'est-à-dire du pistage, que ce dépôt
 * s'interdit sans détour.
 *
 * Resterait une limite qui ne gêne que ceux qui ne savent pas la contourner.
 * C'est la définition d'une fausse contrainte : elle ne protège rien et elle
 * punit les honnêtes.
 *
 * Ce que l'offre borne se limite donc à ce qui vit **dans l'image produite** —
 * la signature et la définition. Cela se voit dans le fichier, cela ne demande
 * de savoir sur personne, et cela reste vrai le jour où quelqu'un ouvre les
 * outils de développement : au pire il retire lui-même une signature, il ne
 * ment à personne d'autre.
 */
export const OFFRES: Record<Exclude<Statut, 'inconnu'>, Bornes> = {
  libre: {
    sansSignature: false,
    pleineDefinition: false,
  },
  pro: {
    sansSignature: true,
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

/**
 * Vrai si la capacité demandée est ouverte dans cet état.
 *
 * Ce module ne garde aucun état et ne touche à aucun stockage : tout ce dont
 * il a besoin lui est passé. C'est ce qui le rend testable sans navigateur, et
 * ce qui en fait une décision plutôt qu'une mémoire.
 */
export function autorise(etat: Etat, capacite: Capacite): boolean {
  return bornes(etat)[capacite];
}

import { autorise, cout, PLAFOND_MENSUEL, type Prestation, type Refus } from './tarifs.ts';
import type { Demande, Etat, Fournisseur } from './minimax.ts';

/**
 * La passerelle de génération — phase 2, celle qui manquait entre la détection
 * (`src/lib/manques.ts`, dans le studio) et une vidéo qui existe.
 *
 * **Un service séparé, et c'est la seule forme qui tienne la promesse.** Le
 * moteur de montage d'Amorce ne connaît pas le réseau, et cet invariant n'est
 * vérifiable que s'il n'a rien à importer qui le connaisse — d'où un troisième
 * service à côté de `licence-serveur/` et `comptes-serveur/`, plutôt qu'un
 * module dans le studio. Le studio demandera une génération et recevra une
 * adresse ; il ne saura jamais à qui.
 *
 * **Ce que ce service ne fait pas**, et chaque ligne évite un glissement :
 *
 * - il ne stocke rien — le compteur de dépense et le grand livre de crédits
 *   sont ailleurs, derrière les interfaces ci-dessous ;
 * - il ne reçoit aucun média de l'appareil — voir l'en-tête de `minimax.ts` ;
 * - il ne connaît pas le solde d'un client. Le grand livre de `comptes-serveur`
 *   compte ce que **les clients** détiennent ; le compteur d'ici compte ce que
 *   **nous** devons au fournisseur. Deux nombres qui se ressemblent et qui ne
 *   sont pas le même : les confondre ferait payer un plafond par un crédit.
 */

/** Ce que le service a besoin de savoir et d'écrire sur la dépense du mois. */
export type Compteur = {
  /** Ce qui a déjà été dépensé sur le mois en cours, en dollars. */
  dejaDepense(mois: string): Promise<number>;
  /**
   * Enregistre une dépense. **Idempotent sur `id`** — la même raison que
   * `crediter` chez `comptes-serveur` : un appel rejoué ne doit pas compter
   * deux fois contre le plafond, sans quoi le plafond se ferme tout seul.
   */
  inscrire(id: string, mois: string, montant: number): Promise<void>;
};

export type Lancement =
  | { lance: true; tache: string; cout: number }
  | { lance: false; refus: Refus };

/** Le mois d'un instant, au format `AAAA-MM` — la fenêtre du plafond. */
export function mois(instant: Date): string {
  return `${instant.getUTCFullYear()}-${String(instant.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Lance une génération, ou refuse en disant pourquoi.
 *
 * L'ordre des trois gestes n'est pas négociable, et c'est la seule chose que ce
 * fichier protège vraiment :
 *
 * 1. **le veto** — on regarde le prix et le plafond ;
 * 2. **l'inscription** — on compte la dépense **avant** de la faire ;
 * 3. **l'appel** au fournisseur.
 *
 * Compter après l'appel serait plus simple et faux : une réponse perdue entre
 * les deux laisserait une génération payée que le compteur ignore, et le
 * plafond dériverait vers le haut à chaque incident. Compter d'abord fait
 * l'erreur dans l'autre sens — une génération comptée qui n'a pas eu lieu —,
 * et c'est celle qu'on veut, parce qu'elle se voit et qu'elle ne coûte rien.
 */
export async function lancer(
  fournisseur: Fournisseur,
  compteur: Compteur,
  prestation: Prestation,
  demande: Demande,
  identifiant: string,
  maintenant: Date = new Date(),
): Promise<Lancement> {
  const fenetre = mois(maintenant);
  const verdict = autorise(prestation, await compteur.dejaDepense(fenetre));
  if (!verdict.autorise) return { lance: false, refus: verdict.refus };

  await compteur.inscrire(identifiant, fenetre, verdict.cout);
  const tache = await fournisseur.lancerVideo(demande);
  return { lance: true, tache, cout: verdict.cout };
}

/** Où en est une tâche. Passe-plat volontaire : rien à décider ici. */
export function suivre(fournisseur: Fournisseur, tache: string): Promise<Etat> {
  return fournisseur.suivre(tache);
}

export { autorise, cout, PLAFOND_MENSUEL };
export type { Prestation, Refus, Demande, Etat, Fournisseur };

'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { demanderEtat } from './client.ts';
import { lireCle, oublierCle, poserCle, sabonnerALaCle } from './cle.ts';
import { serveurConfigure } from './etat.ts';
import { ETAT_INITIAL, type Etat } from './types.ts';

/**
 * Le branchement qui manquait entre la licence et le studio.
 *
 * Tout le module existait — lire une clé, la ranger, interroger le serveur,
 * décider de ce qu'une offre autorise — et **rien ne l'appelait**. `Studio.tsx`
 * passait `ETAT_INITIAL`, une constante figée ; `poserCle` et `demanderEtat`
 * n'avaient aucun appelant hors de leurs tests. Une personne qui payait
 * quarante-neuf euros recevait une clé qu'elle ne pouvait coller nulle part.
 *
 * ## Ce que ce fichier promet, et ce qu'il ne promet pas
 *
 * Il rend l'état **réel** : la clé rangée dans le navigateur, confrontée au
 * serveur au démarrage. Il ne fabrique aucun droit — c'est le serveur qui dit
 * `pro`, jamais le client. Une clé collée sans serveur pour la valider laisse
 * l'offre libre, et c'est voulu : un studio qui se croirait payé sur la seule
 * foi d'une chaîne de caractères se débloquerait avec n'importe quoi.
 *
 * ## Pourquoi l'inconnu retombe sur l'offre libre
 *
 * Serveur éteint, réseau coupé, réponse illisible : l'état reste `inconnu`, et
 * `autorise` traite `inconnu` comme `libre`. Le studio ne se bloque donc
 * jamais parce qu'une facture n'a pas pu être vérifiée. C'est le sens de la
 * frontière écrite dans `CLAUDE.md` §4 — la licence pilote ce que l'interface
 * propose, jamais ce que le moteur fait d'un fichier, et le studio doit rester
 * utilisable serveur éteint.
 */

/**
 * Ce qu'on dit quand le serveur n'a pas répondu.
 *
 * Surtout pas « clé invalide » : la cause la plus probable après un
 * déploiement est une adresse de studio absente des origines autorisées du
 * serveur, et le navigateur bloque alors la réponse sans rien dire. Accuser la
 * clé enverrait la personne chercher une faute de frappe pendant des heures.
 */
const SERVEUR_MUET =
  'Le serveur de licence n’a pas répondu. Ta clé n’est pas en cause — réessaie dans un instant.';

export type Licence = {
  etat: Etat;
  /** La clé rangée, telle quelle. Vide s'il n'y en a pas. */
  cle: string;
  /** Vrai pendant l'interrogation du serveur. */
  verification: boolean;
  /** Vrai quand un endroit où payer existe. */
  serveur: boolean;
  /** Dernier échec, pour que l'interface le dise au lieu de rester muette. */
  erreur: string | null;
  /** Range une clé et la confronte au serveur. Rend l'état obtenu. */
  enregistrer: (cle: string) => Promise<Etat>;
  /** Oublie la clé et revient à l'offre libre. */
  retirer: () => void;
};

export function useLicence(): Licence {
  /*
   * La clé se lit par `useSyncExternalStore`, comme toute source extérieure à
   * React dans ce dépôt.
   *
   * Deux raisons, et la seconde est un vrai défaut évité. La première : c'est
   * l'outil prévu, et il dispense de l'effet suivi d'un `setState` que la règle
   * du dépôt interdit. La seconde : `localStorage` n'existe pas au rendu
   * serveur, et le studio est rendu côté serveur avant d'arriver dans le
   * navigateur. Lire la clé au premier rendu donnerait donc une valeur au
   * serveur et une autre au navigateur — un écart d'hydratation, que React
   * répare en silence en jetant le rendu.
   */
  const cle = useSyncExternalStore(sabonnerALaCle, lireCle, () => '');

  const [etat, setEtat] = useState<Etat>(ETAT_INITIAL);
  const [repondu, setRepondu] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const serveur = serveurConfigure();
  const aVerifier = serveur && cle !== '';

  /*
   * L'attente se **déduit**, elle ne se pose pas.
   *
   * Un `setVerification(true)` en tête d'effet est exactement ce que la règle
   * du dépôt refuse, et il serait de toute façon faux au premier rendu : il y
   * aurait une image affichant « pas de licence » avant celle qui dit « je
   * vérifie ». Ici l'attente est vraie dès le premier rendu, sans état.
   */
  const verification = aVerifier && !repondu;

  /*
   * Le montage double de React en mode strict relancerait la vérification.
   * Une seule suffit, et deux requêtes pour la même clé au démarrage sont un
   * défaut visible dans les journaux du serveur.
   */
  const demandee = useRef('');

  useEffect(() => {
    if (!aVerifier || demandee.current === cle) return;
    demandee.current = cle;

    let vivant = true;
    // Aucun `setState` synchrone ici : tout passe par le retour de la promesse,
    // ce que la règle autorise et ce qui évite les rendus en cascade.
    void demanderEtat(cle).then(({ etat: obtenu, joignable }) => {
      if (!vivant) return;
      setEtat(obtenu);
      setRepondu(true);
      // Au démarrage on ne crie pas sur une clé : si le serveur n'a pas
      // répondu, c'est lui qu'on nomme, jamais la clé de quelqu'un qui a payé.
      if (!joignable) setErreur(SERVEUR_MUET);
    });

    return () => {
      vivant = false;
    };
  }, [aVerifier, cle]);

  const enregistrer = useCallback(async (proposee: string): Promise<Etat> => {
    const propre = proposee.trim();
    setErreur(null);

    if (propre === '') {
      setErreur('Colle la clé reçue après ton achat.');
      return ETAT_INITIAL;
    }
    if (!serveurConfigure()) {
      setErreur('La vérification n’est pas encore ouverte. Réessaie plus tard.');
      return ETAT_INITIAL;
    }
    if (!poserCle(propre)) {
      setErreur('Ton navigateur refuse d’enregistrer la clé. Quitte la navigation privée.');
      return ETAT_INITIAL;
    }

    // La clé vient d'être rangée : l'effet ci-dessus la verrait aussi, mais on
    // interroge ici pour pouvoir rendre le résultat à l'appelant et nommer
    // l'échec. `demandee` retient la clé pour que l'effet ne redemande pas.
    demandee.current = propre;
    setRepondu(false);
    const { etat: obtenu, joignable } = await demanderEtat(propre);
    setEtat(obtenu);
    setRepondu(true);

    /*
     * On distingue « serveur muet » de « clé refusée », et c'est un
     * raisonnement corrigé : on avait d'abord écrit que le client ne pouvait
     * pas faire la différence. Il le peut — une coupure, un délai dépassé ou
     * un partage entre origines refusé **lèvent**, là où un serveur qui
     * rejette une clé rend 200 avec `libre`.
     *
     * Le cas qui compte est le troisième. Le jour où l'adresse du studio n'est
     * pas listée dans les réglages du serveur, le navigateur bloque la réponse
     * et tout le monde retombe sur l'offre libre. Sans cette distinction,
     * quelqu'un qui vient de payer lit « cette clé n'a pas été reconnue » et
     * part chercher une faute de frappe qui n'existe pas.
     */
    if (!joignable) {
      setErreur(SERVEUR_MUET);
    } else if (obtenu.statut !== 'pro') {
      setErreur('Cette clé n’a pas été reconnue. Vérifie-la caractère par caractère.');
    }
    return obtenu;
  }, []);

  const retirer = useCallback(() => {
    oublierCle();
    demandee.current = '';
    setEtat(ETAT_INITIAL);
    setRepondu(false);
    setErreur(null);
  }, []);

  return { etat, cle, verification, serveur, erreur, enregistrer, retirer };
}

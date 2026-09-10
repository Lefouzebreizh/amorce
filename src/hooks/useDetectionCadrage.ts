'use client';

import { useEffect } from 'react';
import { detecterCadrage } from '@/lib/detection.ts';
import { useStudio } from '@/lib/store.ts';

/**
 * Fait tourner la détection de sujet sur les rushes qui n'en ont pas encore.
 *
 * C'est le seul appelant de `detecterCadrage`. Le module de détection est
 * arrivé sans branchement (#834) : il savait mesurer, personne ne le lui
 * demandait, et `asset.cadrage` restait vide — donc le trépied déjà présent
 * dans le rendu n'avait aucune trajectoire à suivre.
 *
 * ## Après l'import, jamais pendant
 *
 * La détection échantillonne dix fois par seconde de rush : quarante
 * déplacements de tête de lecture pour un plan de quatre secondes, trois cents
 * pour trente. Sur un téléphone, chacun coûte des dizaines de millisecondes.
 * La faire dans la boucle d'import ajouterait plusieurs secondes par fichier à
 * une attente que l'utilisateur subit déjà, compteur sous les yeux.
 *
 * Le rush entre donc dans la bibliothèque **immédiatement**, utilisable, et sa
 * trajectoire le rejoint quand elle est prête. Un rush sans trajectoire se rend
 * exactement comme avant — au milieu : rien n'attend, rien ne clignote.
 *
 * ## Un seul à la fois, et jamais pendant un export
 *
 * Deux contraintes, et la seconde est un invariant du dépôt.
 *
 * Un `<video>` de plus, c'est un décodeur de plus, et un navigateur Android
 * n'en accorde que six à huit (invariant n°3). L'export les mobilise tous et
 * sort **noir sans erreur** au-delà : la file s'arrête donc tant que
 * `exportEnCours` est levé, et ne rouvre son `<video>` qu'une fois l'export
 * fini.
 *
 * Un seul rush à la fois, pour la même raison, et parce que deux détections
 * simultanées se disputeraient le fil principal sans rien accélérer : le coût
 * est dans les déplacements de tête de lecture, pas dans le modèle.
 */
/**
 * Les rushes sur lesquels la détection a renoncé.
 *
 * Hors du crochet, à dessein : sans cette mémoire, un rush que le détecteur
 * refuse serait réessayé à chaque changement du store, indéfiniment, et la
 * file ne passerait jamais au suivant.
 */
const refuses = new Set<string>();

export function useDetectionCadrage(): void {
  useEffect(() => {
    let vivant = true;
    let occupe = false;

    const tour = async () => {
      if (!vivant || occupe) return;

      const etat = useStudio.getState();
      if (etat.exportEnCours) return;

      /*
       * On ne cherche que les rushes larges et encore sans trajectoire.
       *
       * `detecterCadrage` refuse déjà les sources verticales — elles n'ont
       * aucun côté à perdre —, mais les écarter ici évite d'ouvrir un `<video>`
       * et de charger le modèle pour rien : sur un montage entièrement
       * vertical, qui est le cas courant, la file ne fait jamais rien.
       */
      const aFaire = etat.project.assets.find(
        (asset) =>
          !asset.cadrage
          && asset.kind === 'video'
          && asset.width > asset.height
          && !refuses.has(asset.id),
      );
      if (!aFaire) return;

      occupe = true;
      const video = document.createElement('video');
      try {
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.src = aFaire.url;
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error('rush illisible'));
        });

        const cadrage = await detecterCadrage(video);
        if (!vivant) return;
        // `null` : modèle absent, navigateur qui refuse le WASM, rush illisible.
        // On note le refus pour ne pas repartir en boucle sur le même fichier.
        if (cadrage) useStudio.getState().poserCadrage(aFaire.id, cadrage);
        else refuses.add(aFaire.id);
      } catch {
        refuses.add(aFaire.id);
      } finally {
        /*
         * Rendre le décodeur tout de suite, sans attendre le ramasse-miettes.
         * Vider `src` ne suffit pas seul : c'est `load()` qui relâche pour de
         * bon la ressource attachée à l'élément.
         */
        video.removeAttribute('src');
        video.load();
        occupe = false;
      }
    };

    /*
     * On repasse à chaque changement du store — un import, un export qui se
     * termine — plutôt qu'à intervalle fixe : une minuterie qui tourne pour
     * rien sur un montage vertical est exactement le genre de réveil qui vide
     * une batterie sans que personne le voie.
     */
    const desabonner = useStudio.subscribe(() => void tour());
    void tour();

    return () => {
      vivant = false;
      desabonner();
    };
  }, []);
}

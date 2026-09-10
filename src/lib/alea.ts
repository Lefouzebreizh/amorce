/**
 * Le hasard reproductible du moteur.
 *
 * Un rendu doit être **identique d'une exécution à l'autre**, et l'aperçu doit
 * montrer ce que l'export gravera. `Math.random` casse les deux : le bruit
 * entendu en prévisualisation n'est pas celui du fichier, et deux exports du
 * même montage ne rendent pas le même fichier.
 *
 * Ce module existe parce que la règle était déjà écrite dans `sfx.ts`, appliquée
 * à la réponse impulsionnelle de la réverbération… et pas au bruit blanc deux
 * fonctions plus haut, ni au grain de l'étalonnage. Un générateur rangé chez
 * l'audio ne pouvait pas servir à l'image sans faire dépendre le second du
 * premier : le sortir est ce qui permet aux trois d'employer le même.
 *
 * `frontiere.test.ts` refuse désormais tout `Math.random` non déclaré dans le
 * moteur, pour que la quatrième occurrence ne s'ajoute pas en silence.
 */

/**
 * Générateur pseudo-aléatoire à graine fixe — xorshift 32 bits.
 *
 * Assez bon pour du bruit et du grain, tient en cinq lignes, et surtout : même
 * graine, même suite, toujours. C'est la seule propriété qu'on lui demande.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

/**
 * Du micro — ou d'un fichier — vers ce que YAMNet attend.
 *
 * Jumeau navigateur de `adaptateurs/audio.py`, qui fait la même chose avec
 * ffmpeg. Les deux doivent rendre la même découpe, sans quoi les fenêtres ne
 * tombent pas aux mêmes instants et les deux moitiés du produit divergent.
 *
 * Ce module est un **adaptateur** : c'est le seul endroit, avec `yamnet.ts`,
 * qui connaît le navigateur. Le cœur (`../verdict.ts` et ses voisins) ne sait
 * rien de `AudioContext`, et c'est ce qui le rend éprouvable sur des scores
 * écrits à la main.
 */

export const FREQUENCE = 16_000;
export const TAILLE_FENETRE = 15_600;          // 0,975 s, ce que le modèle prend
export const PAS = TAILLE_FENETRE / 2 | 0;     // recouvrement de 50 %

/**
 * Décode n'importe quel son que le navigateur sait lire, et le ramène en
 * **mono 16 kHz**.
 *
 * Le rééchantillonnage est confié à `OfflineAudioContext`, qui le fait avec un
 * vrai filtre plutôt qu'en prenant un échantillon sur trois. La différence
 * n'est pas cosmétique : un sous-échantillonnage naïf replie les aigus vers le
 * grave, et la hauteur mesurée ensuite par autocorrélation serait fausse sans
 * que rien ne le signale.
 */
export async function versMono16k(donnees: ArrayBuffer): Promise<Float32Array> {
  // Un `AudioContext` jetable sert seulement à décoder ; c'est le contexte
  // hors ligne qui rééchantillonne.
  const decodeur = new AudioContext();
  let brut: AudioBuffer;
  try {
    brut = await decodeur.decodeAudioData(donnees.slice(0));
  } finally {
    void decodeur.close();
  }

  const duree = Math.max(1, Math.ceil(brut.duration * FREQUENCE));
  const hors = new OfflineAudioContext(1, duree, FREQUENCE);
  const source = hors.createBufferSource();
  source.buffer = brut;
  source.connect(hors.destination);
  source.start();
  const rendu = await hors.startRendering();
  return rendu.getChannelData(0);
}

/**
 * Découpe en fenêtres de 15 600 échantillons, avec 50 % de recouvrement.
 *
 * Un enregistrement plus court qu'une fenêtre est **complété de silence**
 * plutôt que refusé : quelqu'un qui appuie une demi-seconde sur le bouton doit
 * obtenir un verdict, pas une erreur. C'est le même choix que côté Python.
 */
export function fenetrer(echantillons: Float32Array): Float32Array[] {
  if (echantillons.length === 0) return [];
  if (echantillons.length < TAILLE_FENETRE) {
    const rempli = new Float32Array(TAILLE_FENETRE);
    rempli.set(echantillons);
    return [rempli];
  }
  const sortie: Float32Array[] = [];
  for (let debut = 0; debut + TAILLE_FENETRE <= echantillons.length; debut += PAS) {
    sortie.push(echantillons.subarray(debut, debut + TAILLE_FENETRE));
  }
  return sortie;
}

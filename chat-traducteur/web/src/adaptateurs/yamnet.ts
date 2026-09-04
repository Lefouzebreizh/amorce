/**
 * YAMNet dans le navigateur, et la mesure qui a décidé qu'on pouvait s'y fier.
 *
 * ## Ce qui a été mesuré le 04/09/2026
 *
 * Le même vecteur de 15 600 échantillons passé dans les deux moteurs — le
 * `ai_edge_litert` de Python et le WASM de `@tensorflow/tfjs-tflite` conduit
 * par un vrai Chromium — rend **exactement les mêmes 521 scores** :
 *
 *     écart maximum sur les 521 classes : 0.000e+0
 *
 * Bit pour bit. C'est ce qui autorise à parler d'un seul produit plutôt que de
 * deux : tout ce que le corpus Python a mesuré — le plancher de `Caterwaul`,
 * la classe muette `Hiss`, le bâillement rangé en rugissement — vaut ici sans
 * être remesuré.
 *
 * ## Le blocage qu'on croyait avoir, et qui n'existe pas
 *
 * `@tensorflow/tfjs-tflite` est en `0.0.1-alpha.10`, ce qui n'inspire rien de
 * bon, et la crainte était qu'il aille chercher son WASM sur un CDN — refusé
 * par le mandataire, comme tous les autres. **Les fichiers WASM sont livrés
 * dans le paquet npm** : `setWasmPath` sur un dossier local suffit, et rien ne
 * sort de la machine. C'est aussi ce qui permet à l'application de tourner
 * hors ligne, ce qui n'est pas un détail pour un produit dont l'argument est
 * que rien ne quitte l'appareil.
 *
 * ## Ce qui reste vrai malgré la mesure
 *
 * La licence du **fichier de poids** n'est toujours pas établie — voir
 * `../../README.md`, section Licences. Ce module le charge, il ne le résout
 * pas.
 */

import type { Fenetre } from "../verdict.ts";

/** Ce que ce module attend du moteur, et rien de plus. */
export interface MoteurTflite {
  setWasmPath(chemin: string): void;
  loadTFLiteModel(url: string): Promise<{ predict(entree: unknown): unknown }>;
}

export interface Tenseur {
  tensor(donnees: Float32Array, forme: number[]): unknown;
  setBackend(nom: string): Promise<boolean>;
  ready(): Promise<void>;
}

export interface OptionsModele {
  /** Adresse du `.tflite`. */
  modele: string;
  /** Dossier qui sert les `.wasm` — **local**, jamais un CDN. */
  cheminWasm: string;
  /** Les 521 étiquettes, dans l'ordre du modèle. */
  etiquettes: string[];
}

export class Oreille {
  #modele: { predict(entree: unknown): unknown } | null = null;

  constructor(
    private readonly tf: Tenseur,
    private readonly tflite: MoteurTflite,
    private readonly options: OptionsModele,
  ) {
    if (options.etiquettes.length !== 521) {
      // Une liste d'étiquettes de la mauvaise longueur ne casse rien à
      // l'exécution : les scores sortent dans le bon ordre avec les mauvais
      // noms, et le verdict devient faux en restant plausible. C'est le
      // défaut le plus cher de ce projet, sous une forme de plus.
      throw new Error(
        `521 étiquettes attendues, ${options.etiquettes.length} reçues — ` +
        "relancer outils/extraire-etiquettes.py",
      );
    }
  }

  async ouvrir(): Promise<void> {
    if (this.#modele) return;
    await this.tf.setBackend("cpu");
    await this.tf.ready();
    this.tflite.setWasmPath(this.options.cheminWasm);
    this.#modele = await this.tflite.loadTFLiteModel(this.options.modele);
  }

  /** Une fenêtre de 15 600 échantillons -> les 521 scores nommés. */
  async ecouter(fenetre: Float32Array): Promise<Fenetre> {
    if (!this.#modele) throw new Error("Appeler `ouvrir()` avant `ecouter()`.");
    const entree = this.tf.tensor(fenetre, [fenetre.length]);
    const sortie = this.#modele.predict(entree) as { data(): Promise<ArrayLike<number>> };
    const scores = await sortie.data();
    const nomme: Fenetre = {};
    for (let i = 0; i < this.options.etiquettes.length; i++) {
      nomme[this.options.etiquettes[i]] = scores[i];
    }
    return nomme;
  }

  /** Toutes les fenêtres, dans l'ordre — ce que `juger` attend. */
  async ecouterToutes(fenetres: Float32Array[]): Promise<Fenetre[]> {
    const sortie: Fenetre[] = [];
    for (const f of fenetres) sortie.push(await this.ecouter(f));
    return sortie;
  }
}

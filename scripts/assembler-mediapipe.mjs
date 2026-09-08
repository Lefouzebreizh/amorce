/**
 * Pose les fichiers de MediaPipe dans `public/`, pour qu'Amorce les serve elle-même.
 *
 * Deux raisons, et aucune n'est le confort.
 *
 * **Aucun CDN.** La promesse d'Amorce est qu'aucun fichier ne quitte l'appareil ;
 * aller chercher un WASM chez un tiers à chaque ouverture révélerait au moins
 * qu'on ouvre le studio, et ferait dépendre le montage d'un hôte qu'on ne tient
 * pas. Servis depuis notre propre origine, ils se mettent en cache une fois et
 * l'application marche hors ligne — même mesure que `chat-traducteur/web`.
 *
 * **Aucun binaire versionné**, invariant n°8. Le WASM et le modèle sont
 * récupérés à la construction, jamais commités : `public/mediapipe/` est ignoré
 * par git.
 *
 * Ce qui est copié, et ce que ça pèse — mesuré le 08/09/2026 :
 *
 * | fichier | brut | sur le réseau |
 * | --- | --- | --- |
 * | `vision_wasm_internal.wasm` | 11,21 Mo | 3,26 Mo gzip |
 * | `vision_wasm_internal.js` | 0,31 Mo | 0,07 Mo |
 * | `blaze_face_short_range.tflite` | 0,22 Mo | 0,22 Mo |
 *
 * Soit **3,6 Mo au premier usage**, mis en cache ensuite. Le paquet npm entier
 * pèse 36,8 Mo : on n'en sert qu'un dixième, et surtout pas la variante sans
 * SIMD ni le module de débogage.
 *
 * Usage : npm run mediapipe (lancé aussi par `prebuild`).
 */
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'public', 'mediapipe');
const PAQUET = join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision');

/**
 * Le modèle, chez Google.
 *
 * `storage.googleapis.com` est le seul hôte de modèles que le mandataire laisse
 * passer — mesuré plusieurs fois sur ce dépôt, `tfhub.dev`, `kaggle.com` et
 * `huggingface.co` rendent `000`. C'est aussi celui dont `chat-traducteur` tire
 * YAMNet.
 *
 * `short_range` et non `full_range` : le premier vise un visage à moins de deux
 * mètres, ce qui est exactement le cadre d'un rush filmé au téléphone, et il
 * pèse cinq fois moins.
 */
const MODELE = 'https://storage.googleapis.com/mediapipe-models/face_detector'
  + '/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

/**
 * Ce qu'on copie du paquet, et rien de plus.
 *
 * `vision_wasm_nosimd_internal` est écarté : tout navigateur qui sait faire
 * tourner l'export d'Amorce sait faire du SIMD, et le garder doublerait le
 * poids servi pour un repli que personne n'emprunte.
 * `vision_wasm_module_internal` est le module de débogage, hors production.
 */
const DU_PAQUET = [
  'wasm/vision_wasm_internal.wasm',
  'wasm/vision_wasm_internal.js',
  'vision_bundle.mjs',
];

mkdirSync(join(DEST, 'wasm'), { recursive: true });

if (!existsSync(PAQUET)) {
  console.error('@mediapipe/tasks-vision est absent : lance npm install d’abord.');
  process.exit(1);
}

let total = 0;
for (const relatif of DU_PAQUET) {
  const source = join(PAQUET, relatif);
  if (!existsSync(source)) {
    console.error(`introuvable dans le paquet : ${relatif}`);
    process.exit(1);
  }
  const cible = join(DEST, relatif);
  mkdirSync(dirname(cible), { recursive: true });
  copyFileSync(source, cible);
  const taille = statSync(cible).size;
  total += taille;
  console.log(`${relatif.padEnd(34)} ${(taille / 1048576).toFixed(2)} Mo`);
}

/**
 * Un modèle qu'on n'a pas ne casse pas la construction.
 *
 * Ce script tourne en `prebuild`, donc à chaque déploiement. Faire échouer la
 * construction parce qu'un hôte extérieur a hoqueté reviendrait à rendre toute
 * la mise en production d'Amorce dépendante de Google — pour une fonctionnalité
 * **facultative**, qui plus est : `detecterCadrage` rend `null` quand les
 * fichiers manquent, et le rush se cadre alors au milieu, comme avant.
 *
 * On crie donc fort dans le journal et on sort en succès. Le défaut se voit à
 * la lecture du journal, et personne ne perd son déploiement.
 */
const cibleModele = join(DEST, 'visage.tflite');
if (existsSync(cibleModele)) {
  console.log('visage.tflite                      déjà là');
  total += statSync(cibleModele).size;
} else {
  let reponse;
  try {
    reponse = await fetch(MODELE);
  } catch (erreur) {
    console.warn(`\n⚠  le modèle est injoignable (${String(erreur).slice(0, 80)}).`);
    console.warn('   Le studio se construit quand même ; le cadrage suivi restera inactif.');
    process.exit(0);
  }
  if (!reponse.ok) {
    console.warn(`\n⚠  le modèle a répondu ${reponse.status} sur ${MODELE}`);
    console.warn('   Le studio se construit quand même ; le cadrage suivi restera inactif.');
    process.exit(0);
  }
  const octets = Buffer.from(await reponse.arrayBuffer());
  /*
   * La taille est vérifiée, pas supposée.
   *
   * Un mandataire qui refuse peut rendre une page d'erreur avec un code 200 :
   * on écrirait alors quelques kilo-octets de HTML sous un nom de modèle, et le
   * défaut n'apparaîtrait qu'au premier chargement dans le navigateur, sous la
   * forme d'une erreur illisible.
   */
  if (octets.length < 100_000) {
    console.warn(`\n⚠  le modèle fait ${octets.length} octets : ce n’est pas un modèle.`);
    console.warn('   Rien n’est écrit ; le cadrage suivi restera inactif.');
    process.exit(0);
  }
  writeFileSync(cibleModele, octets);
  total += octets.length;
  console.log(`visage.tflite                      ${(octets.length / 1048576).toFixed(2)} Mo`);
}

console.log(`\n${(total / 1048576).toFixed(2)} Mo posés dans public/mediapipe/ — non versionnés.`);

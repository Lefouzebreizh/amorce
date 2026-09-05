// Rassemble le dossier statique déposable de l'application.
//
// Il n'existait pas jusqu'au 05/09/2026, et son absence était le seul écart
// entre « l'application tourne » et « l'application est en ligne » :
// `outils/epreuve.mjs` sert `dist/` et les trois fichiers de TensorFlow
// **depuis `node_modules`, à la volée**, ce qu'aucun hébergeur ne sait faire.
// L'épreuve n'est donc pas un serveur de production en petit — c'est un
// montage virtuel qui n'a jamais eu besoin que les fichiers existent quelque
// part.
//
// Ce que ce script produit vit dans `public/`, **ignoré par git** : il porte
// les 4,1 Mo de YAMNet et 3,5 Mo de WASM, et le §8 de `CLAUDE.md` refuse tout
// binaire versionné. Il se reconstruit d'une commande, ce qui est la seule
// raison pour laquelle on peut se permettre de ne pas le garder.

import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const TF = join(RACINE, 'node_modules', '@tensorflow')
const SORTIE = join(RACINE, 'public')

// Le modèle n'est pas dans le dépôt (`.gitignore` de `chat-traducteur/`), et
// il ne le sera jamais. Il se télécharge depuis `storage.googleapis.com`,
// seul hôte qui réponde — `tfhub.dev`, `kaggle.com` et `huggingface.co`
// rendent tous `000` depuis une session distante.
//
// Ce script sait le chercher lui-même, et pas seulement le réclamer : c'est
// ce qui permet à un serveur de construction — qui part d'un clone nu, sans
// Python et sans les 4 Mo — de fabriquer le dossier tout seul. Les mêmes
// taille et empreinte que `scripts/telecharger_modeles.py`, recopiées à
// dessein : un poids qui change sous le même nom déplacerait tous les scores,
// et donc le seuil de la porte, qui est réglé dessus.
const MODELE = join(RACINE, '..', 'modeles', 'yamnet.tflite')
const MODELE_URL = 'https://storage.googleapis.com/mediapipe-models/'
  + 'audio_classifier/yamnet/float32/1/yamnet.tflite'
const MODELE_TAILLE = 4_126_810
const MODELE_MD5 = 'd02e1b838813107817b755d09d6b56b3'

async function assurerLeModele() {
  if (existsSync(MODELE) && (await stat(MODELE)).size === MODELE_TAILLE) return
  console.log(`Téléchargement du modèle depuis ${MODELE_URL}`)
  const reponse = await fetch(MODELE_URL)
  if (!reponse.ok) throw new Error(`${reponse.status} sur ${MODELE_URL}`)
  const octets = Buffer.from(await reponse.arrayBuffer())
  const md5 = createHash('md5').update(octets).digest('hex')
  if (octets.length !== MODELE_TAILLE || md5 !== MODELE_MD5) {
    throw new Error(`Modèle inattendu : ${octets.length} o, md5 ${md5}`)
  }
  await mkdir(dirname(MODELE), { recursive: true })
  await writeFile(MODELE, octets)
  console.log(`  ${octets.length} o, md5 conforme`)
}

// Les trois `tf-*.js` que `page/index.html` charge en balises `<script>`, et
// que l'épreuve sert depuis `node_modules`. Leur nom dans la page est figé :
// le changer casserait la page sans casser aucun test.
const SCRIPTS = [
  ['tfjs-core/dist/tf-core.js', 'tf/tf-core.js'],
  ['tfjs-backend-cpu/dist/tf-backend-cpu.js', 'tf/tf-backend-cpu.js'],
  ['tfjs-tflite/dist/tf-tflite.js', 'tf/tf-tflite.js'],
]

async function principal() {
  await assurerLeModele()

  await rm(SORTIE, { recursive: true, force: true })
  await mkdir(join(SORTIE, 'tf'), { recursive: true })
  await mkdir(join(SORTIE, 'modeles'), { recursive: true })

  // Bâtir avant de copier : `dist/` peut porter une version d'hier, et un
  // dossier déposé n'a aucun moyen de le signaler.
  execFileSync('npx', ['tsc', '-p', 'tsconfig.navigateur.json'],
               { cwd: RACINE, stdio: 'inherit' })

  await cp(join(RACINE, 'page', 'index.html'), join(SORTIE, 'index.html'))
  await cp(join(RACINE, 'dist'), join(SORTIE, 'dist'), { recursive: true })
  // Les 521 étiquettes d'AudioSet, chargées par `fetch` et non par une balise
  // — donc invisibles à une lecture de `index.html`. Oubliées au premier jet :
  // la page se chargeait, le bouton répondait, et le premier son restait sans
  // verdict pour toujours. C'est `epreuve-public.mjs` qui l'a dit, en comptant
  // les 404 ; aucun test unitaire ne pouvait le voir.
  await cp(join(RACINE, 'donnees'), join(SORTIE, 'donnees'), { recursive: true })
  for (const [source, cible] of SCRIPTS) {
    await cp(join(TF, source), join(SORTIE, cible))
  }
  // Tout le dossier `wasm/`, sans trier : le moteur choisit à l'exécution
  // entre quatre variantes selon ce que le navigateur accorde (SIMD, fils
  // d'exécution), et n'en nomme aucune à l'avance. En copier trois sur
  // quatre marche sur la machine qui a testé et échoue ailleurs.
  await cp(join(TF, 'tfjs-tflite', 'wasm'), join(SORTIE, 'wasm'),
           { recursive: true })
  await cp(MODELE, join(SORTIE, 'modeles', 'yamnet.tflite'))

  const poids = async (chemin) => (await stat(join(SORTIE, chemin))).size
  console.log(`\nAssemblé dans public/`)
  console.log(`  index.html         ${await poids('index.html')} o`)
  console.log(`  dist/appli.js      ${await poids('dist/appli.js')} o`)
  console.log(`  donnees/etiquettes ${await poids('donnees/etiquettes.json')} o`)
  console.log(`  modeles/yamnet     ${await poids('modeles/yamnet.tflite')} o`)
}

await principal()

/**
 * Le dossier déposé tourne-t-il ? — l'épreuve du tas de fichiers, pas du montage.
 *
 * `outils/epreuve.mjs` conduit l'application par un serveur qui **reconstitue**
 * les chemins depuis `node_modules` : sa table d'alias fait exister
 * `./tf/tf-core.js` et `./wasm/` sans qu'aucun fichier ne soit à cet endroit.
 * C'est ce qui lui permet de ne rien recopier, et c'est aussi ce qui la rend
 * incapable de dire si un hébergeur saurait servir la même page.
 *
 * Celle-ci sert `public/` **à plat**, sans un seul alias : ce que le disque ne
 * porte pas rend 404, exactement comme chez l'hébergeur. Elle ne remplace donc
 * pas l'autre — l'autre compare deux moteurs au bit près, celle-ci compare un
 * dossier à ce qu'il prétend contenir.
 *
 *     node outils/assembler.mjs && node outils/epreuve-public.mjs
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const RACINE = resolve(import.meta.dirname, '..')
const PUBLIC = join(RACINE, 'public')
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

for (const [quoi, chemin] of [
  ['Chromium', CHROME],
  ['le dossier assemblé (node outils/assembler.mjs)', PUBLIC],
  ['le signal d\'épreuve (npm run temoins:chaine)', join(RACINE, 'temoins', 'signal.wav')],
]) {
  if (!existsSync(chemin)) {
    console.log(`⊘ non effectué : ${quoi} est absent.`)
    process.exit(3)
  }
}

const { chromium } = await import(join(RACINE, '..', '..', 'node_modules', 'playwright', 'index.mjs'))

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.json': 'application/json', '.wasm': 'application/wasm',
  '.tflite': 'application/octet-stream',
}

// Toutes les requêtes, y compris celles qui échouent : un 404 silencieux sur
// un WASM se traduit par une page qui charge et ne répond jamais, et c'est
// précisément le défaut que cette épreuve existe pour attraper.
const manquants = []
const serveur = createServer(async (req, res) => {
  const url = decodeURI(req.url.split('?')[0])
  const chemin = join(PUBLIC, normalize(url === '/' ? '/index.html' : url))
  try {
    const octets = await readFile(chemin)
    res.writeHead(200, { 'content-type': TYPES[extname(chemin)] ?? 'application/octet-stream' })
    res.end(octets)
  } catch {
    manquants.push(url)
    res.writeHead(404); res.end('non')
  }
})
await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
const port = serveur.address().port

const chaine = JSON.parse(await readFile(join(RACINE, 'temoins', 'chaine.json'), 'utf-8'))
const nav = await chromium.launch({ executablePath: CHROME })
const page = await nav.newPage()
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
await page.setViewportSize({ width: 393, height: 873 })      // le terrain de référence
await page.goto(`http://127.0.0.1:${port}/`)
await page.waitForFunction('window.appliPrete === true', { timeout: 120_000 })

let echecs = 0

// Le même fichier que l'autre épreuve, donc le même verdict attendu : si le
// dossier déposé rendait autre chose, c'est qu'il ne porte pas le même code.
const wav = await readFile(join(RACINE, 'temoins', 'signal.wav'))
await page.evaluate(async (octets) => {
  await window.ecouterOctets(new Uint8Array(octets).buffer)
}, Array.from(wav))
const obtenu = await page.evaluate(() => ({
  verdict: window.dernierVerdict(), fenetres: window.nbFenetres(),
}))
const memeChaine =
  obtenu.fenetres === chaine.fenetres &&
  obtenu.verdict.intention === chaine.verdict.intention &&
  obtenu.verdict.source === chaine.verdict.source &&
  obtenu.verdict.raison === chaine.verdict.raison
if (!memeChaine) echecs++
console.log(`  ${memeChaine ? '✓' : '✗'} chaîne complète  ${obtenu.fenetres} fenêtres ` +
  `(python ${chaine.fenetres})  ${obtenu.verdict.intention} (python ${chaine.verdict.intention})`)

// Et la carte, qui est le produit : le bouton qui l'enregistre doit exister et
// être **dans le premier écran**, défaut déjà payé une fois.
const carte = await page.evaluate(() => {
  const v = window.jugerScores([{ Cat: 0.500, Purr: 0.586 }])
  const b = document.getElementById('telecharger')
  return { intention: v.intention, source: v.source,
           bas: b.getBoundingClientRect().bottom, hauteur: window.innerHeight }
})
const carteOk = carte.intention === 'contentement' && carte.source === 'mesuree'
  && carte.bas <= carte.hauteur
if (!carteOk) echecs++
console.log(`  ${carteOk ? '✓' : '✗'} carte à l'écran  ${carte.intention} (${carte.source}), ` +
  `bouton à ${Math.round(carte.bas)} px sur ${carte.hauteur}`)
await page.screenshot({ path: join(RACINE, 'temoins', 'ecran-public.png') })

// Un seul 404 est attendu, et il est mesuré plutôt que supposé : à 826 ms,
// `tf-tflite.js` cherche son chargeur WASM **à côté de lui-même**, avant que
// `setWasmPath` ait été appelé — l'appel vit dans `ouvrir()`, donc plus tard.
// Le vrai fichier se charge à 1296 ms depuis `/wasm/`, et le verdict tombe.
// La sonde est donc sans effet ; ce qui compte est qu'elle soit **nommée** :
// une liste de 404 tolérés sans raison écrite finit par tout tolérer.
const SONDE = '/tf/tflite_web_api_cc_simd.js'
const inattendus = [...new Set(manquants)].filter((u) => u !== SONDE)

if (inattendus.length) {
  echecs++
  console.log(`  ✗ ${inattendus.length} fichier(s) manquant(s) dans public/ :`)
  for (const m of inattendus.slice(0, 10)) console.log(`      ${m}`)
} else {
  console.log('  ✓ aucun 404 inattendu — le dossier porte ce que la page demande')
}
if (erreurs.length) { echecs++; console.log('  ✗ erreurs :', erreurs) }

await nav.close(); serveur.close()
console.log(echecs ? `\n✗ ${echecs} échec(s)` : '\n✓ le dossier déposé tourne')
process.exit(echecs ? 1 : 0)

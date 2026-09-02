#!/usr/bin/env node
// Conduit l'application dans un vrai Chromium, sur un vrai flux HLS.
//
// Pourquoi ce script existe séparément de `npm test` : les tests unitaires ne
// voient ni la mise en page, ni le lecteur, ni le mandataire de flux. Ce sont
// exactement les trois choses qui cassent sans qu'aucune assertion ne bronche.
//
// Il n'est **pas** lancé par l'intégration continue, et c'est délibéré :
// Playwright vit dans les dépendances de la racine du dépôt, que la CI d'IPTV
// n'installe pas — voir « le piège du projet niché » dans /nouveau-projet. Il se
// lance à la main avant de livrer un changement d'interface.
//
// Ce qu'il monte, dans l'ordre :
//
//   1. un flux HLS réel fabriqué par ffmpeg (20 s, segmenté) ;
//   2. un serveur d'origine qui le sert **sans en-tête CORS** — c'est ce qui
//      rend le mandataire nécessaire, et donc vérifiable ;
//   3. un catalogue importé dans une base jetable ;
//   4. l'application, conduite au format du terrain de référence.

import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { basename, join } from 'node:path'
import { setTimeout as attendre } from 'node:timers/promises'

const RACINE = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const ESSAI = join(RACINE, '.essai')
const FLUX = join(ESSAI, 'flux')
const BASE = join(ESSAI, 'essai.db')
const PORT_ORIGINE = 8099
const PORT_APP = 3210
// Le terrain de référence du dépôt : Redmi Note 12 Plus, Chrome Android.
const ECRAN = { width: 393, height: 873 }

const echecs = []
const verifier = (condition, quoi) => {
  if (condition) console.log(`  ✓ ${quoi}`)
  else {
    console.log(`  ✗ ${quoi}`)
    echecs.push(quoi)
  }
}

function commande(programme, args, options = {}) {
  return new Promise((resoudre, rejeter) => {
    const enfant = spawn(programme, args, { stdio: 'pipe', ...options })
    let sortie = ''
    enfant.stdout?.on('data', (bloc) => (sortie += bloc))
    enfant.stderr?.on('data', (bloc) => (sortie += bloc))
    enfant.on('error', rejeter)
    enfant.on('close', (code) =>
      code === 0 ? resoudre(sortie) : rejeter(new Error(`${programme} a rendu ${code}\n${sortie}`)),
    )
  })
}

async function fabriquerFlux() {
  if (existsSync(join(FLUX, 'essai.m3u8'))) return true
  mkdirSync(FLUX, { recursive: true })
  try {
    await commande('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=20',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=20',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '50', '-c:a', 'aac', '-shortest',
      '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod',
      '-hls_segment_filename', join(FLUX, 'seg%03d.ts'),
      join(FLUX, 'essai.m3u8'),
    ])
    return true
  } catch {
    console.log('  … ffmpeg absent : la lecture ne sera pas vérifiée (le reste, si)')
    return false
  }
}

/**
 * Le serveur du « fournisseur ». Il ne pose **aucun** en-tête CORS, exprès :
 * c'est la situation réelle, et c'est ce qui prouve que le mandataire sert à
 * quelque chose. Il accepte n'importe quel chemin finissant par `.m3u8` pour
 * que les URL ressemblent à celles d'un panneau (`/live/…`, `/movie/…`).
 */
function serveurOrigine() {
  const serveur = createServer((requete, reponse) => {
    const chemin = new URL(requete.url ?? '/', 'http://x').pathname
    // Une chaîne géobloquée, telle qu'un vrai fournisseur la refuse : un 403
    // sur le manifeste lui-même. C'est le cas relevé sur une installation
    // réelle, et celui que le lecteur confondait avec un trou réseau.
    if (chemin.includes('/refuse/')) {
      reponse.writeHead(403)
      reponse.end('interdit')
      return
    }
    // Sans ffmpeg, `fabriquerFlux` a renoncé et l'a dit — en promettant que
    // « le reste » serait vérifié. Cette garde-là est ce qui rend la promesse
    // vraie : sans elle, `readFileSync` levait un ENOENT dans le gestionnaire
    // de requête, ce qui tuait le processus entier au lieu de sauter la seule
    // lecture. Le plantage laissait en plus le `next start` orphelin, si bien
    // que les deux exécutions suivantes échouaient sur « le port 3210 répond
    // déjà » — une cause qui n'était plus la vraie. Les segments, dix lignes
    // plus bas, étaient gardés depuis toujours : c'est l'asymétrie qui a coûté.
    const manifeste = join(FLUX, 'essai.m3u8')
    if (chemin.endsWith('.m3u8') && existsSync(manifeste)) {
      reponse.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl' })
      reponse.end(readFileSync(manifeste))
      return
    }
    const segment = join(FLUX, basename(chemin))
    if (/^seg\d+\.ts$/.test(basename(chemin)) && existsSync(segment)) {
      reponse.writeHead(200, { 'content-type': 'video/mp2t' })
      createReadStream(segment).pipe(reponse)
      return
    }
    reponse.writeHead(404)
    reponse.end('non')
  })
  return new Promise((resoudre) => serveur.listen(PORT_ORIGINE, '127.0.0.1', () => resoudre(serveur)))
}

const LISTE = [
  '#EXTM3U url-tvg="http://127.0.0.1:8099/epg.xml"',
  '#EXTINF:-1 tvg-id="tf1.fr" group-title="FR | TNT",FR | TF1 HD',
  `http://127.0.0.1:${PORT_ORIGINE}/live/u/p/1.m3u8`,
  '#EXTINF:-1 group-title="FR | TNT",FR | Canal+ Cinéma FHD',
  `http://127.0.0.1:${PORT_ORIGINE}/live/u/p/2.m3u8`,
  '#EXTINF:-1 group-title="FR | SPORT",FR | RMC Sport 1 4K',
  `http://127.0.0.1:${PORT_ORIGINE}/live/u/p/3.m3u8`,
  '#EXTINF:-1 group-title="FILMS VF",Le Fabuleux Destin (2001) MULTI 1080p',
  `http://127.0.0.1:${PORT_ORIGINE}/movie/u/p/7.m3u8`,
  '#EXTINF:-1 group-title="FILMS VOSTFR",Le Grand Bleu (1988) VOSTFR HD',
  `http://127.0.0.1:${PORT_ORIGINE}/movie/u/p/8.m3u8`,
  '#EXTINF:-1 group-title="SERIES VF",Kaamelott S01E01',
  `http://127.0.0.1:${PORT_ORIGINE}/series/u/p/11.m3u8`,
  '#EXTINF:-1 group-title="SERIES VF",Kaamelott S01E02',
  `http://127.0.0.1:${PORT_ORIGINE}/series/u/p/12.m3u8`,
  '#EXTINF:-1 group-title="SERIES VOSTFR",[VOSTFR] Breaking Bad S01E01',
  `http://127.0.0.1:${PORT_ORIGINE}/series/u/p/21.m3u8`,
  '#EXTINF:-1 group-title="FR | TNT",FR | Chaîne Géobloquée',
  `http://127.0.0.1:${PORT_ORIGINE}/live/refuse/99.m3u8`,
].join('\n')

/**
 * Un guide de test calé sur l'instant présent.
 *
 * Les horaires sont calculés au lancement plutôt qu'écrits en dur : une grille
 * figée serait « en ce moment » le jour où on l'écrit et jamais plus, et la
 * vérification passerait au vert en ne vérifiant rien.
 */
function guideXmltv() {
  const format = (date) =>
    date.toISOString().replace(/[-:T]/g, '').slice(0, 14) + ' +0000'
  const maintenant = Date.now()
  const avant = new Date(maintenant - 30 * 60 * 1000)
  const milieu = new Date(maintenant + 30 * 60 * 1000)
  const apres = new Date(maintenant + 90 * 60 * 1000)

  return `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="tf1.fr"><display-name>TF1</display-name></channel>
  <programme start="${format(avant)}" stop="${format(milieu)}" channel="tf1.fr">
    <title>Le Journal de 20h</title>
    <desc>L&apos;actualité du jour &amp; le sport.</desc>
    <category>Information</category>
  </programme>
  <programme start="${format(milieu)}" stop="${format(apres)}" channel="tf1.fr">
    <title><![CDATA[Film : Les Bronzés]]></title>
  </programme>
</tv>`
}

async function importer() {
  rmSync(BASE, { force: true })
  rmSync(`${BASE}-wal`, { force: true })
  rmSync(`${BASE}-shm`, { force: true })
  const { ouvrirDepot } = await import(`${RACINE}/src/cache/depot.ts`)
  const { importerM3U } = await import(`${RACINE}/src/cache/importer.ts`)
  const cache = ouvrirDepot(BASE)
  const resume = await importerM3U(cache, LISTE, {
    adresse: `http://127.0.0.1:${PORT_ORIGINE}/get.php?username=jean&password=s3cr3t`,
  })
  const { importerEpg } = await import(`${RACINE}/src/cache/importer.ts`)
  const guide = await importerEpg(cache, guideXmltv())
  // Une série « déclarée » sans ses épisodes, comme en sert un panneau Xtream.
  // Aucun panneau n'est joignable ici : c'est précisément ce qu'on veut voir —
  // la fiche s'affiche quand même, et l'application dit pourquoi elle est vide.
  const sourceXtream = cache.declarerSource({
    genre: 'xtream',
    adresse: 'http://127.0.0.1:9/panneau',
    utilisateur: 'jean',
  })
  cache.enregistrerFiches(sourceXtream, [
    {
      id: 'se_essai',
      refExterne: '42',
      titre: 'Engrenages',
      titreBrut: 'Engrenages',
      annee: 2005,
      logo: undefined,
      resume: 'Une brigade criminelle parisienne.',
      genres: ['Policier'],
      groupe: 'SERIES FR',
      langue: 'vf',
    },
    // Un vrai panneau Xtream en déclare couramment plusieurs milliers : la
    // page Séries lisait `cache.fiches({ limite: 500 })`, un plafond qui
    // amputait silencieusement les trois quarts d'un catalogue de 4 000
    // séries. Ce lot-ci, à lui seul, dépasse ce plafond — dans un thème
    // différent d'Engrenages, pour ne pas noyer la vérification de sa fiche.
    ...Array.from({ length: 549 }, (_, i) => ({
      id: `se_lot_${String(i).padStart(4, '0')}`,
      refExterne: `lot${String(i)}`,
      titre: `Série de lot ${String(i).padStart(4, '0')}`,
      titreBrut: `Série de lot ${String(i).padStart(4, '0')}`,
      annee: 2020,
      logo: undefined,
      resume: undefined,
      genres: ['Action'],
      groupe: 'SERIES ACTION',
      langue: 'vf',
    })),
  ])

  const film = cache.lister({ genre: 'film' })[0]
  const chaine = cache.lister({ genre: 'direct' }).find((element) => element.tvgId === 'tf1.fr')
  const refusee = cache.lister({ genre: 'direct' }).find((element) => element.url.includes('/refuse/'))
  cache.fermer()
  return {
    ...resume,
    idFilm: film?.id,
    idChaine: chaine?.id,
    idRefusee: refusee?.id,
    programmes: guide.ecrits,
  }
}

async function attendrePret(url, secondes = 60) {
  for (let i = 0; i < secondes * 4; i += 1) {
    try {
      const reponse = await fetch(url)
      if (reponse.ok) return true
    } catch {
      /* pas encore là */
    }
    await attendre(250)
  }
  return false
}

async function principal() {
  console.log('── Flux HLS de test')
  const avecFlux = await fabriquerFlux()

  console.log('── Serveur d’origine (sans CORS, comme un vrai fournisseur)')
  const origine = await serveurOrigine()

  console.log('── Import du catalogue')
  const resume = await importer()
  console.log(`  ${resume.ecrits} entrées, ${resume.programmes} programmes`)

  console.log('── Application')
  // Le port doit être libre, et le vérifier n'est pas de la prudence de trop :
  // un serveur resté d'une exécution précédente répondrait à la place du nôtre,
  // avec un code plus ancien. On mesurerait alors une version qui n'existe plus,
  // et les défauts trouvés seraient imaginaires — une heure perdue, mesurée.
  if (await attendrePret(`http://127.0.0.1:${PORT_APP}/`, 0.25)) {
    origine.close()
    throw new Error(
      `Le port ${PORT_APP} répond déjà. Un serveur d'une exécution précédente y est resté :` +
        ` l'arrêter avant de relancer.`,
    )
  }

  // `detached` puis un signal au **groupe** : `npm run start` engendre un
  // `next start` fils, et tuer le npm laisse l'enfant vivant avec le port.
  const app = spawn('npm', ['run', 'start', '--', '--port', String(PORT_APP)], {
    cwd: RACINE,
    env: { ...process.env, IPTV_BASE: BASE, NODE_ENV: 'production' },
    stdio: 'pipe',
    detached: true,
  })
  let journalApp = ''
  app.stdout.on('data', (bloc) => (journalApp += bloc))
  app.stderr.on('data', (bloc) => (journalApp += bloc))

  const arreter = () => {
    try {
      if (app.pid !== undefined) process.kill(-app.pid, 'SIGTERM')
    } catch {
      app.kill('SIGTERM')
    }
    origine.close()
  }

  try {
    if (!(await attendrePret(`http://127.0.0.1:${PORT_APP}/`))) {
      console.error(journalApp)
      throw new Error("l'application n'a pas démarré")
    }

    const { chromium } = await import('playwright')
    // Le Chromium préinstallé du conteneur ne porte pas le même numéro de build
    // que celui qu'attend le Playwright de la racine : lancé sans indication,
    // il réclame un téléchargement que la politique réseau refuse. Le lien
    // `/opt/pw-browsers/chromium` pointe sur le binaire réel, et `IPTV_CHROMIUM`
    // laisse la main sur une machine où il est ailleurs.
    const binaire =
      process.env.IPTV_CHROMIUM ??
      (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
    const navigateur = await chromium.launch(binaire === undefined ? {} : { executablePath: binaire })
    const contexte = await navigateur.newContext({ viewport: ECRAN, locale: 'fr-FR' })
    const page = await contexte.newPage()
    const erreursConsole = []
    page.on('pageerror', (erreur) => erreursConsole.push(erreur.message))

    const debordement = async () =>
      page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

    for (const [chemin, attendu] of [
      ['/', 'Bonsoir'],
      ['/direct', 'En direct'],
      ['/films', 'Films'],
      ['/series', 'Séries'],
      ['/recherche', 'Chercher'],
    ]) {
      await page.goto(`http://127.0.0.1:${PORT_APP}${chemin}`, { waitUntil: 'networkidle' })
      const titre = await page.locator('h1').first().textContent()
      verifier(titre?.includes(attendu) === true, `${chemin} affiche « ${attendu} »`)
      verifier(!(await debordement()), `${chemin} ne déborde pas à ${ECRAN.width} px`)
      await page.screenshot({ path: join(ESSAI, `ecran${chemin.replace(/\//g, '-')}.png`) })
    }

    console.log('── Recherche')
    await page.goto(`http://127.0.0.1:${PORT_APP}/recherche`, { waitUntil: 'networkidle' })
    await page.fill('input[name=q]', 'fabul')
    await page.press('input[name=q]', 'Enter')
    await page.waitForLoadState('networkidle')
    verifier(
      (await page.locator('text=Le Fabuleux Destin').count()) > 0,
      'la recherche « fabul » trouve Le Fabuleux Destin',
    )

    console.log('── Le guide des programmes')
    await page.goto(`http://127.0.0.1:${PORT_APP}/direct`, { waitUntil: 'networkidle' })
    verifier(
      (await page.locator('text=Le Journal de 20h').count()) > 0,
      'la grille du direct montre ce qui passe en ce moment',
    )
    verifier(
      (await page.locator('text=Film : Les Bronzés').count()) > 0,
      'et ce qui suit, titre en CDATA compris',
    )
    const barre = await page.evaluate(() => {
      const trait = document.querySelector('span[style*="width"]')
      return trait === null ? -1 : Number.parseFloat(trait.getAttribute('style')?.match(/[\d.]+/)?.[0] ?? '-1')
    })
    verifier(barre > 5 && barre < 95, `la barre d'avancement est cohérente (${barre} %)`)

    if (resume.idChaine !== undefined) {
      await page.goto(`http://127.0.0.1:${PORT_APP}/lecture/${encodeURIComponent(resume.idChaine)}`, {
        waitUntil: 'domcontentloaded',
      })
      await page.waitForLoadState('load')
      verifier(
        (await page.locator("text=L'actualité du jour & le sport.").count()) > 0,
        'la page de lecture affiche le résumé du programme',
      )
      await page.screenshot({ path: join(ESSAI, 'ecran-direct.png') })
    }

    console.log('── Séries déclarées, épisodes absents')
    // 550 fiches déclarées, plus Kaamelott et Breaking Bad déduites du M3U
    // de tête : 552 en tout. Au-delà du seuil de regroupement par thème, la
    // page racine montre des dossiers — c'est là, dans son propre en-tête,
    // que le plafond de lecture (corrigé à 20 000) se vérifie.
    await page.goto(`http://127.0.0.1:${PORT_APP}/series`, { waitUntil: 'networkidle' })
    verifier(
      (await page.locator('text=552 séries').count()) > 0,
      'les 552 séries du catalogue sont toutes comptées, aucune n’est amputée par un plafond',
    )
    await page.goto(`http://127.0.0.1:${PORT_APP}/series?theme=Policier`, { waitUntil: 'networkidle' })
    verifier(
      (await page.locator('text=Engrenages').count()) > 0,
      'une série déclarée s’affiche avant d’avoir ses épisodes',
    )
    verifier(
      (await page.locator('text=Épisodes à charger').count()) > 0,
      'et son état est dit plutôt que montré comme « 0 épisode »',
    )
    await page.goto(`http://127.0.0.1:${PORT_APP}/series/Engrenages`, { waitUntil: 'networkidle' })
    verifier(
      (await page.locator('text=Une brigade criminelle parisienne.').count()) > 0,
      'sa fiche montre le résumé du panneau',
    )
    verifier(
      (await page.locator('text=n’ont pas pu être chargés').count()) > 0,
      'et explique l’absence au lieu d’afficher une page vide',
    )

    console.log('── Cibles tactiles')
    await page.goto(`http://127.0.0.1:${PORT_APP}/direct`, { waitUntil: 'networkidle' })
    const tropPetites = await page.evaluate(() =>
      [...document.querySelectorAll('a, button')]
        .map((element) => ({ t: element.textContent?.trim().slice(0, 20), h: element.getBoundingClientRect().height }))
        .filter((mesure) => mesure.h > 0 && mesure.h < 44),
    )
    verifier(tropPetites.length === 0, `toutes les cibles font 44 px (${tropPetites.length} en défaut)`)
    if (tropPetites.length > 0) console.log('   ', JSON.stringify(tropPetites.slice(0, 5)))

    if (avecFlux && resume.idFilm !== undefined) {
      console.log('── Le chemin complet du flux, par le mandataire')
      const app = `http://127.0.0.1:${PORT_APP}`

      const manifeste = await (await fetch(`${app}/api/flux?e=${resume.idFilm}`)).text()
      verifier(manifeste.startsWith('#EXTM3U'), 'le mandataire rend un manifeste HLS')

      const uris = manifeste.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('#'))
      verifier(
        uris.length > 0 && uris.every((l) => l.startsWith('/api/flux?u=')),
        `les ${uris.length} segments repassent par le mandataire`,
      )

      const segment = await fetch(`${app}${uris[0]}`)
      const octets = (await segment.arrayBuffer()).byteLength
      verifier(
        segment.status === 200 && (segment.headers.get('content-type') ?? '').includes('mp2t'),
        'un segment est relayé avec son type',
      )
      verifier(octets > 100_000, `le segment pèse ${Math.round(octets / 1024)} Ko`)

      // Le mandataire ne doit pas être un proxy ouvert : sans signature valide,
      // il refuse — sinon n'importe qui s'en servirait pour atteindre le réseau
      // local depuis cette machine.
      const falsifie = await fetch(
        `${app}/api/flux?u=${encodeURIComponent('http://127.0.0.1:8099/essai.m3u8')}&s=faux`,
      )
      verifier(falsifie.status === 403, 'une adresse non signée est refusée (403)')

      console.log('── Le lecteur, dans le navigateur')
      const demandes = []
      page.on('request', (requete) => {
        if (requete.url().includes('/api/flux')) demandes.push(requete.url())
      })
      // `networkidle` n'arrivera jamais ici, et ce n'est pas un défaut : un
      // lecteur qui lit un flux **fait du réseau en continu**, par définition.
      // L'attendre expire au bout de trente secondes, sur une page parfaitement
      // saine.
      await page.goto(`${app}/lecture/${encodeURIComponent(resume.idFilm)}`, {
        waitUntil: 'domcontentloaded',
      })
      // `domcontentloaded` n'attend pas la feuille de style : une capture prise
      // là rend une page sans aucun style, et fait croire à une régression.
      await page.waitForLoadState('load')
      await page.waitForSelector('video')
      await page.evaluate(() => {
        const video = document.querySelector('video')
        return video === null ? undefined : video.play().catch(() => undefined)
      })
      await attendre(4000)
      verifier(
        demandes.some((url) => url.includes('?e=')),
        'le lecteur demande le manifeste au mandataire',
      )
      verifier(
        demandes.some((url) => url.includes('?u=')),
        'et va chercher les segments par le même chemin',
      )

      // La preuve la plus forte qu'on puisse obtenir sans décodeur : hls.js
      // annonce la durée du média. Il ne peut la connaître qu'en ayant lu le
      // manifeste **entier** au travers du mandataire, réécriture comprise.
      const duree = await page.evaluate(() => document.querySelector('video')?.duration ?? 0)
      verifier(
        Math.abs(duree - 20) < 1,
        `le lecteur connaît la durée du média (${duree.toFixed(1)} s, attendu 20 s)`,
      )
      await page.screenshot({ path: join(ESSAI, 'ecran-lecture.png') })

      console.log('── Sous-titres externes, sans clé')
      // La dégradation compte autant que la fonctionnalité : sans clé, on doit
      // obtenir une phrase qui dit quoi faire, pas une erreur ni un silence.
      await page.click('text=Chercher des sous-titres')
      await page.waitForSelector('text=OPENSUBTITLES_API_KEY', { timeout: 5000 })
      verifier(true, 'sans clé, l’interface dit laquelle poser au lieu d’échouer')
    }

    if (resume.idFilm !== undefined) {
      console.log('── Bande-annonce, sans panneau Xtream')
      // Même exigence que pour les sous-titres : sans abonnement, on doit
      // obtenir une phrase qui explique, pas un bouton qui ne fait rien.
      await page.goto(`http://127.0.0.1:${PORT_APP}/lecture/${encodeURIComponent(resume.idFilm)}`, {
        waitUntil: 'domcontentloaded',
      })
      await page.waitForLoadState('load')
      await page.click('text=Chercher la bande-annonce')
      await page.waitForSelector('text=Une liste M3U n’en fournit aucune', { timeout: 5000 })
      verifier(true, 'sans panneau, l’absence est expliquée plutôt que muette')
    }

    if (resume.idRefusee !== undefined) {
      console.log('── Un flux refusé le dit, au lieu de tourner indéfiniment')
      // Relevé sur une vraie installation : le mandataire renvoyait le 403 du
      // fournisseur en 404 ms, et l'écran affichait « Connexion au flux… » sans
      // fin. La cause était un `startLoad()` sans condition ni plafond sur
      // toute erreur réseau — un flux géobloqué se redemandait pour toujours.
      await page.goto(
        `http://127.0.0.1:${PORT_APP}/lecture/${encodeURIComponent(resume.idRefusee)}`,
        { waitUntil: 'domcontentloaded' },
      )
      await page.waitForLoadState('load')
      await page.waitForSelector('text=/refusé ce flux \\(403\\)/', { timeout: 15000 })
      verifier(true, 'le refus du fournisseur est nommé, avec son code')
      const tourne = (await page.locator('text=Connexion au flux').count()) > 0
      verifier(!tourne, 'et l’indicateur de chargement a cédé la place')
    }

    {
      console.log('── Entretien : le cul-de-sac du catalogue tout masqué')
      // Défaut trouvé en regardant l'écran, pas par un test : après un balayage
      // qui condamne tout, l'accueil basculait sur « le catalogue est vide,
      // importez une liste » — donc il accusait la mauvaise cause ET faisait
      // disparaître le bloc d'entretien, seul chemin de retour. On enferme.
      const entretien = `http://127.0.0.1:${PORT_APP}/api/entretien`
      const poster = async (tache) => {
        const reponse = await fetch(entretien, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tache, lot: 500 }),
        })
        return reponse.json()
      }

      // Tout condamner **pour de vrai** : on éteint le serveur d'origine avant
      // le balayage. Sans cela la moitié des flux répondent encore et l'écran
      // « tout masqué » ne se produit jamais — c'est ce qu'a montré le premier
      // passage, et c'est exactement le genre de décor trop favorable qui rend
      // un contrôle vert sans rien prouver.
      await new Promise((resoudre) => origine.close(resoudre))
      let restants = Infinity
      for (let tour = 0; tour < 20 && restants > 0; tour += 1) {
        const lot = await poster('tester')
        if ((lot.faits ?? 0) === 0) break
        restants = lot.restants ?? 0
      }
      verifier(restants === 0, 'le balayage par lots se termine')

      await page.goto(`http://127.0.0.1:${PORT_APP}/`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('load')
      const masque = (await page.locator('text=Tout est masqué').count()) > 0
      const retour = (await page.locator('text=Tout remettre en jeu').count()) > 0
      verifier(masque, 'tout masqué se dit, au lieu de « le catalogue est vide »')
      verifier(retour, 'et le bouton qui répare reste à l’écran')

      await page.click('text=Tout remettre en jeu')
      // On attend le titre, pas le message : `router.refresh()` redemande le
      // rendu serveur sans l'attendre, donc le message arrive avant lui. Lire
      // le titre à cet instant rend l'ancien, et le contrôle devient instable —
      // il passait tant que la page était courte, et a cédé à la neuvième
      // entrée du décor.
      await page.waitForSelector('h1:has-text("Bonsoir")', { timeout: 30000 })
      verifier(true, 'un clic ramène le catalogue entier')

      // Le serveur d'origine reste éteint : ce contrôle est le dernier à en
      // avoir besoin, et le rallumer donnerait un décor différent de celui
      // qu'ont vu les contrôles précédents.
      // Ce qui n'est PAS vérifié ici, et il faut le dire : le décodage.
      // Mesuré sur ce conteneur — le Chromium de Playwright est compilé sans
      // les codecs propriétaires : `canPlayType('video/mp4; codecs="avc1…"')`
      // rend la chaîne vide et `MediaSource.isTypeSupported` rend faux pour
      // H.264 comme pour AAC (VP9, lui, passe). Aucun flux IPTV réel n'étant
      // en VP9, l'image ne s'affichera jamais ici, quoi que fasse le code.
      const codecs = await page.evaluate(() => ({
        h264: MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'),
      }))
      if (!codecs.h264) {
        console.log('  … décodage non vérifiable : ce Chromium n’a ni H.264 ni AAC.')
        console.log('    Le chemin réseau est prouvé ; l’image se regarde dans un vrai Chrome.')
      }
    }

    verifier(erreursConsole.length === 0, `aucune erreur JavaScript (${erreursConsole.length})`)
    if (erreursConsole.length > 0) console.log('   ', erreursConsole.slice(0, 3).join(' | '))

    await navigateur.close()
  } finally {
    arreter()
  }

  console.log()
  if (echecs.length === 0) {
    console.log(`✓ Interface vérifiée. Captures dans ${ESSAI}/`)
    return 0
  }
  console.log(`✗ ${echecs.length} défaut(s) : ${echecs.join(', ')}`)
  return 1
}

process.exitCode = await principal()

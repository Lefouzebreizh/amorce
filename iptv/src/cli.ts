// Une ligne de commande, avant l'interface.
//
// Elle existe pour une raison de méthode, pas de confort : tant qu'il n'y a pas
// d'écran, c'est le seul moyen de **regarder** ce que le cœur fait d'une vraie
// liste, plutôt que de le déduire d'une suite de tests verte. Elle sert aussi de
// premier utilisateur du dépôt — si une requête manque, elle manque ici d'abord.

import { createReadStream } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { networkInterfaces } from 'node:os'
import { createGunzip } from 'node:zlib'

import { ouvrirDepot, type Depot } from './cache/depot.ts'
import { importerEpg, importerM3U } from './cache/importer.ts'
import type { SourceTexte } from './flux/lignes.ts'
import { masquerIdentifiants } from './ingestion/xtream.ts'

const AIDE = `Usage : iptv <commande> [options]

  importer <fichier|url>   Analyse une liste M3U et remplit le cache
  epg <fichier|url>        Charge un guide XMLTV (.xml ou .xml.gz)
  grille [chaine]          Ce qui passe en ce moment
  adresse                  L'adresse à taper sur le téléphone et la télévision
  resume                   Ce que le cache contient
  chercher <mots...>       Recherche plein texte
  groupes                  Les groupes, du plus fourni au moins fourni
  series                   Les séries et leur nombre d'épisodes

Options :
  --base=<chemin>          Fichier de cache (défaut : donnees/iptv.db)
  --limite=<n>             Nombre de résultats (défaut : 20)
`

function lireOption(args: readonly string[], nom: string): string | undefined {
  const prefixe = `--${nom}=`
  const trouve = args.find((arg) => arg.startsWith(prefixe))
  return trouve === undefined ? undefined : trouve.slice(prefixe.length)
}

/**
 * Ouvre un fichier ou une adresse, en décompressant au besoin.
 *
 * Les guides XMLTV sont presque toujours servis en `.gz` — c'est un fichier de
 * 200 Mo qui en pèse 15 compressé. Sans ce détour, l'analyseur reçoit des
 * octets binaires et ne trouve aucune balise, sans erreur : il rend simplement
 * zéro programme, ce qui est le plus long à comprendre.
 */
async function ouvrirSource(chemin: string): Promise<SourceTexte> {
  const compresse = /\.gz($|\?)/i.test(chemin)

  if (/^https?:\/\//i.test(chemin)) {
    const reponse = await fetch(chemin)
    if (!reponse.ok) {
      throw new Error(
        `Le serveur a répondu ${reponse.status} sur ${masquerIdentifiants(chemin, '')}`,
      )
    }
    if (reponse.body === null) throw new Error('Réponse sans corps')
    const encodage = reponse.headers.get('content-encoding') ?? ''
    // `fetch` défait lui-même un `content-encoding: gzip` ; il ne défait pas un
    // fichier qui *est* un .gz. Les deux se ressemblent et ne se traitent pas
    // pareil.
    if (!compresse || /gzip/i.test(encodage)) return reponse.body
    return reponse.body.pipeThrough(new DecompressionStream('gzip'))
  }

  const fichier = createReadStream(chemin)
  return compresse ? fichier.pipe(createGunzip()) : fichier
}

function afficherElements(depot: Depot, elements: ReturnType<Depot['lister']>): void {
  if (elements.length === 0) {
    console.log('  (rien)')
    return
  }
  for (const element of elements) {
    const marques = [element.langue, element.qualite]
      .filter((marque) => marque !== 'inconnue')
      .join(' · ')
    const situation =
      element.serie !== undefined && element.saison !== undefined
        ? ` — ${element.serie} S${String(element.saison).padStart(2, '0')}E${String(element.episode ?? 0).padStart(2, '0')}`
        : ''
    console.log(
      `  ${element.genre.padEnd(6)} ${element.titre}${situation}${marques === '' ? '' : `  [${marques}]`}`,
    )
  }
  void depot
}

async function principal(argv: readonly string[]): Promise<number> {
  const [commande, ...reste] = argv
  if (commande === undefined || commande === '--help' || commande === '-h') {
    console.log(AIDE)
    return 0
  }

  const chemin = lireOption(reste, 'base') ?? 'donnees/iptv.db'
  const limite = Number.parseInt(lireOption(reste, 'limite') ?? '20', 10)
  mkdirSync(dirname(chemin), { recursive: true })
  const depot = ouvrirDepot(chemin)

  try {
    switch (commande) {
      case 'importer': {
        const adresse = reste.find((arg) => !arg.startsWith('--'))
        if (adresse === undefined) {
          console.error('Il manque le fichier ou l’adresse de la liste.')
          return 2
        }
        const source = await ouvrirSource(adresse)
        const resume = await importerM3U(depot, source, { adresse })
        console.log(
          `Importé : ${resume.ecrits} entrées en ${(resume.dureeMs / 1000).toFixed(1)} s` +
            (resume.retires > 0 ? `, ${resume.retires} retirées` : ''),
        )
        return 0
      }

      case 'epg': {
        const adresse = reste.find((arg) => !arg.startsWith('--'))
        if (adresse === undefined) {
          console.error('Il manque le fichier ou l’adresse du guide.')
          return 2
        }
        const resume = await importerEpg(depot, await ouvrirSource(adresse))
        console.log(
          `Guide : ${resume.ecrits} programmes sur ${resume.chaines} chaînes déclarées` +
            ` en ${(resume.dureeMs / 1000).toFixed(1)} s` +
            (resume.purges > 0 ? `, ${resume.purges} périmés retirés` : ''),
        )
        if (resume.ignores > 0) console.log(`  ${resume.ignores} entrées incomprises`)
        return 0
      }

      case 'grille': {
        const voulue = reste.find((arg) => !arg.startsWith('--'))
        const chaines = depot
          .lister({ genre: 'direct', limite: 500 })
          .filter((element) => element.tvgId !== undefined)
          .filter((element) => voulue === undefined || element.titre.toLowerCase().includes(voulue.toLowerCase()))
        const identifiants = [...new Set(chaines.map((element) => element.tvgId ?? ''))]
        const antennes = depot.maintenant(identifiants)
        let vues = 0
        for (const chaine of chaines) {
          const antenne = antennes.get(chaine.tvgId ?? '')
          if (antenne?.actuel === undefined) continue
          const heure = new Date(antenne.actuel.debut).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })
          console.log(`  ${heure}  ${chaine.titre.padEnd(22).slice(0, 22)}  ${antenne.actuel.titre}`)
          vues += 1
          if (vues >= limite) break
        }
        if (vues === 0) {
          console.log('  Aucun programme. Le guide est-il chargé (« epg ») et les tvg-id')
          console.log('  de la liste correspondent-ils à ceux du guide ?')
        }
        return 0
      }

      case 'adresse': {
        /*
         * La question qui bloque tout le monde au premier lancement, et à
         * laquelle aucune documentation ne peut répondre : « quelle adresse je
         * tape sur mon téléphone ? » Elle dépend de la box, elle change quand
         * on rebranche, et un exemple écrit dans un README est pris pour la
         * vraie réponse — c'est arrivé.
         */
        const port = lireOption(reste, 'port') ?? '3000'
        const adresses: string[] = []
        for (const [nom, cartes] of Object.entries(networkInterfaces())) {
          for (const carte of cartes ?? []) {
            // `internal` écarte la boucle locale ; la famille se compare en
            // texte *et* en nombre, Node ayant changé d'avis entre deux
            // versions majeures (« IPv4 » puis 4).
            const v4 = carte.family === 'IPv4' || (carte.family as unknown as number) === 4
            if (!v4 || carte.internal) continue
            adresses.push(`  http://${carte.address}:${port}   (via ${nom})`)
          }
        }

        if (adresses.length === 0) {
          console.log('Cette machine n’a aucune adresse réseau : elle n’est branchée')
          console.log('ni en Wi-Fi ni en Ethernet. Le téléphone ne pourra pas la joindre.')
          return 1
        }

        console.log('À taper dans le navigateur du téléphone, sur le même Wi-Fi :')
        console.log()
        for (const adresse of adresses) console.log(adresse)
        console.log()
        console.log('Il faut que « npm run dev » tourne ici, dans une autre fenêtre.')
        if (adresses.length > 1) {
          console.log('Plusieurs adresses : essayez la première, puis les suivantes.')
        }
        return 0
      }

      case 'resume': {
        console.log(`Total : ${depot.compter()} entrées`)
        for (const genre of ['direct', 'film', 'serie'] as const) {
          console.log(`  ${genre.padEnd(7)} ${depot.compter({ genre })}`)
        }
        console.log('Par langue :')
        for (const langue of ['vf', 'multi', 'vostfr', 'vo', 'inconnue'] as const) {
          const n = depot.compter({ langue })
          if (n > 0) console.log(`  ${langue.padEnd(9)} ${n}`)
        }
        return 0
      }

      case 'chercher': {
        const mots = reste.filter((arg) => !arg.startsWith('--')).join(' ')
        afficherElements(depot, depot.chercher(mots, { limite }))
        return 0
      }

      case 'groupes': {
        for (const groupe of depot.groupes().slice(0, limite)) {
          console.log(`  ${String(groupe.compte).padStart(6)}  ${groupe.nom}`)
        }
        return 0
      }

      case 'series': {
        for (const serie of depot.series().slice(0, limite)) {
          console.log(`  ${serie.serie} — ${serie.saisons} saison(s), ${serie.episodes} épisode(s)`)
        }
        return 0
      }

      default:
        console.error(`Commande inconnue : ${commande}\n`)
        console.log(AIDE)
        return 2
    }
  } finally {
    depot.fermer()
  }
}

process.exitCode = await principal(process.argv.slice(2))

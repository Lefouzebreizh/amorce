// Une ligne de commande, avant l'interface.
//
// Elle existe pour une raison de méthode, pas de confort : tant qu'il n'y a pas
// d'écran, c'est le seul moyen de **regarder** ce que le cœur fait d'une vraie
// liste, plutôt que de le déduire d'une suite de tests verte. Elle sert aussi de
// premier utilisateur du dépôt — si une requête manque, elle manque ici d'abord.

import { createReadStream } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { ouvrirDepot, type Depot } from './cache/depot.ts'
import { importerM3U } from './cache/importer.ts'
import type { SourceTexte } from './flux/lignes.ts'
import { masquerIdentifiants } from './ingestion/xtream.ts'

const AIDE = `Usage : iptv <commande> [options]

  importer <fichier|url>   Analyse une liste M3U et remplit le cache
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

async function ouvrirSource(chemin: string): Promise<SourceTexte> {
  if (/^https?:\/\//i.test(chemin)) {
    const reponse = await fetch(chemin)
    if (!reponse.ok) {
      throw new Error(
        `Le serveur a répondu ${reponse.status} sur ${masquerIdentifiants(chemin, '')}`,
      )
    }
    if (reponse.body === null) throw new Error('Réponse sans corps')
    return reponse.body
  }
  return createReadStream(chemin)
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

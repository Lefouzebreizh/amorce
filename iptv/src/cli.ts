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
import { importerEpg, importerM3U, importerXtream } from './cache/importer.ts'
import { creerClientXtream, ErreurXtream } from './ingestion/xtream.ts'
import { chargerEnv, identifiantsXtream } from './serveur/reglages.ts'
import { guideDemo, LISTE_DEMO } from './demo.ts'
import type { Genre } from './domaine/types.ts'
import {
  choisirCandidats,
  ranimerFlux,
  rangerCatalogue,
  testerCatalogue,
} from './entretien/taches.ts'
import type { SourceTexte } from './flux/lignes.ts'
import { masquerIdentifiants } from './ingestion/xtream.ts'

const AIDE = `Usage : iptv <commande> [options]

  demo                     Remplit le cache avec des chaînes de test publiques
  importer <fichier|url>   Analyse une liste M3U et remplit le cache
  xtream [serveur user mdp] Importe depuis un panneau Xtream (ou depuis .env)
  epg <fichier|url>        Charge un guide XMLTV (.xml ou .xml.gz)
  grille [chaine]          Ce qui passe en ce moment
  adresse                  L'adresse à taper sur le téléphone et la télévision
  resume                   Ce que le cache contient
  chercher <mots...>       Recherche plein texte
  groupes                  Les groupes, du plus fourni au moins fourni
  series                   Les séries et leur nombre d'épisodes
  tester [--genre=…]       Éprouve les flux et masque ceux qui ne répondent plus
  ranimer                  Remet à l'essai tout ce qui avait été marqué mort
  ranger                   Repose l'ordre des chaînes et les thèmes des films

Options :
  --base=<chemin>          Fichier de cache (défaut : donnees/iptv.db)
  --limite=<n>             Nombre de résultats (défaut : 20)
  --genre=<direct|film|serie>  Restreint « tester » à un genre
  --parallele=<n>          Tests menés de front, tous hôtes confondus (défaut : 12)
  --par-hote=<n>           Tests de front sur un même hôte (défaut : 1)
  --delai=<s>              Secondes avant d'abandonner un flux (défaut : 8)
  --tout                   Retester même ce qui l'a déjà été
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
  // Next lit `.env` tout seul ; la ligne de commande, non.
  chargerEnv()
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
      case 'demo': {
        /*
         * La première question n'est pas « comment je branche mon
         * fournisseur », c'est « est-ce que ça marche ». Sans réponse à
         * celle-là, un écran vide se confond avec une panne.
         */
        const resume = await importerM3U(depot, LISTE_DEMO, {
          adresse: 'demonstration',
        })
        const guide = await importerEpg(depot, guideDemo())
        console.log(`Démonstration prête : ${resume.ecrits} entrées, ${guide.ecrits} programmes.`)
        console.log()
        console.log('Ensuite, dans cette fenêtre :        npm run dev')
        console.log('Et dans une seconde fenêtre :        npm run iptv -- adresse')
        console.log()
        console.log('Ces chaînes sont des flux de test publics, pas un abonnement.')
        console.log('Pour brancher le vôtre : npm run iptv -- importer <votre lien>')
        return 0
      }

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

      case 'xtream': {
        const positionnels = reste.filter((arg) => !arg.startsWith('--'))
        const identifiants =
          positionnels.length >= 3 && positionnels[0] !== undefined
            ? {
                serveur: positionnels[0],
                utilisateur: positionnels[1] ?? '',
                motDePasse: positionnels[2] ?? '',
              }
            : identifiantsXtream()

        if (identifiants === undefined) {
          console.error('Il manque les identifiants du panneau. Deux façons :')
          console.error('  npm run iptv -- xtream http://hote:8080 utilisateur motdepasse')
          console.error('  ou IPTV_XTREAM_SERVEUR / _UTILISATEUR / _MOT_DE_PASSE dans .env')
          return 2
        }

        let client
        try {
          client = creerClientXtream(identifiants)
        } catch (cause) {
          console.error(cause instanceof ErreurXtream ? cause.message : String(cause))
          return 2
        }

        // Le compte avant le catalogue : un abonnement expiré rend des listes
        // vides et non une erreur, et l'import « réussirait » avec zéro entrée.
        // Autant le dire tout de suite, avec l'échéance et le nombre de flux
        // simultanés — les deux choses qu'on cherche quand quelque chose cloche.
        let compte
        try {
          compte = await client.verifierCompte()
        } catch (cause) {
          console.error(cause instanceof ErreurXtream ? cause.message : String(cause))
          return 1
        }

        console.log(`Compte : ${compte.actif ? 'actif' : 'INACTIF'}${compte.statut === undefined ? '' : ` (${compte.statut})`}`)
        if (compte.expiration !== undefined) {
          const jours = Math.round((compte.expiration.getTime() - Date.now()) / 86_400_000)
          console.log(
            `  échéance : ${compte.expiration.toLocaleDateString('fr-FR')} (${jours} jour${Math.abs(jours) > 1 ? 's' : ''})`,
          )
        }
        if (compte.connexionsMax !== undefined) {
          console.log(`  flux simultanés : ${compte.connexionsActives ?? 0} sur ${compte.connexionsMax}`)
        }
        if (!compte.actif) {
          console.error('Abonnement inactif : le panneau rendrait des listes vides.')
          return 1
        }

        const resume = await importerXtream(depot, client, {
          utilisateur: identifiants.utilisateur,
        })
        console.log(
          `Importé : ${resume.ecrits} entrées et ${resume.fiches} séries` +
            ` en ${(resume.dureeMs / 1000).toFixed(1)} s` +
            (resume.retires > 0 ? `, ${resume.retires} retirées` : ''),
        )
        console.log('Les épisodes d’une série se chargent à l’ouverture de sa fiche.')
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
        const etats = depot.compterParEtat()
        if (etats.vivants + etats.morts > 0) {
          console.log(
            `État des flux : ${String(etats.vivants)} testés vivants, ` +
              `${String(etats.morts)} hors service (masqués), ${String(etats.inconnus)} jamais testés`,
          )
        }
        console.log('Par langue :')
        for (const langue of ['vf', 'multi', 'vostfr', 'vo', 'inconnue'] as const) {
          const n = depot.compter({ langue })
          if (n > 0) console.log(`  ${langue.padEnd(9)} ${n}`)
        }
        // Affiché ici et pas au moment de l'import : le retrait se constate à
        // la fin d'un import, mais il se lit plus tard — quand on cherche le
        // film qu'on avait commencé et qu'on ne retrouve pas.
        const retraits = depot.retraits()
        if (retraits.length > 0) {
          console.log(`\nDisparus du catalogue, et vous les aviez marqués (${retraits.length}) :`)
          for (const retrait of retraits.slice(0, 20)) {
            const ou = retrait.serie ? ` — ${retrait.serie}` : ''
            console.log(`  ${retrait.retireLe.slice(0, 10)}  ${retrait.titre}${ou}`)
          }
          if (retraits.length > 20) console.log(`  … et ${retraits.length - 20} autre(s)`)
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

      case 'tester': {
        // La décision — qui tester, quoi marquer — vit dans `entretien/taches.ts`,
        // partagée avec l'interface. Ici il ne reste que l'affichage.
        const candidats = choisirCandidats(depot, {
          genre: lireOption(reste, 'genre') as Genre | undefined,
          tout: reste.includes('--tout'),
        })

        if (candidats.length === 0) {
          console.log('Rien à tester : tout a déjà été éprouvé (« --tout » pour recommencer).')
          return 0
        }

        console.log(`Test de ${String(candidats.length)} flux…`)
        const bilan = await testerCatalogue(depot, candidats, {
          delaiMs: (Number(lireOption(reste, 'delai') ?? 8) || 8) * 1000,
          parallele: Number(lireOption(reste, 'parallele') ?? 12) || 12,
          parHote: Number(lireOption(reste, 'par-hote') ?? 1) || 1,
          surResultat: (resultat, faits, total) => {
            const marque = resultat.etat === 'ok' ? '✓' : resultat.etat === 'mort' ? '✗' : '?'
            const compteur = `${String(faits).padStart(String(total).length)}/${String(total)}`
            console.log(`  ${compteur} ${marque} ${resultat.element.titre} — ${resultat.raison}`)
          },
        })

        console.log(
          `\n${String(bilan.ok)} vivants, ${String(bilan.mort)} hors service (masqués), ` +
            `${String(bilan.inconnu)} indécis (laissés visibles).`,
        )
        return 0
      }

      case 'ranger': {
        const bilan = rangerCatalogue(depot)
        if (bilan.reclasses > 0) {
          console.log(
            `${String(bilan.reclasses)} entrées changent de genre — classées par une règle ` +
              `depuis corrigée, et figées jusqu'ici.`,
          )
        }
        console.log(
          `${String(bilan.numerotees)} chaînes numérotées sur ${String(bilan.chaines)} ` +
            `(les autres suivent par familles : sport, cinéma, musique, puis le reste).`,
        )
        for (const dossier of bilan.dossiers) {
          console.log(
            `${dossier.genre === 'film' ? 'Films' : 'Séries'} : ${String(dossier.nommes)} thèmes` +
              (dossier.autres === 0
                ? ''
                : `, ${String(dossier.autres)} sans thème reconnu (dossier « Autres »)`),
          )
        }
        console.log(
          `${String(bilan.etrangeres)} entrées masquées comme étrangères (chaîne d'un autre pays, ` +
            `film ou série sans piste française) — rien n'est supprimé, seulement écarté de l'affichage.`,
        )
        return 0
      }

      case 'ranimer': {
        const remis = ranimerFlux(depot)
        console.log(`${String(remis)} entrées remises en jeu. « tester » pour les réessayer.`)
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

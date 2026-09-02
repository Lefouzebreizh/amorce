// Le dépôt : tout ce que l'application demande à la base, et rien d'autre.
//
// Une seule règle de conception, qui explique la forme du fichier : **aucun SQL
// ne sort d'ici**. L'interface appelle `chercher`, `lister`, `basculerFavori` ;
// elle ne compose jamais de requête. C'est ce qui permet de changer d'index, de
// passer un jour sur Cloudflare D1, ou de mesurer une requête lente sans
// toucher à un seul écran.
//
// L'écriture se fait par paquets, en transactions successives plutôt qu'en une
// seule. Une transaction unique sur 100 000 entrées tiendrait le journal ouvert
// pendant tout l'import : la base est alors verrouillée, et une coupure au
// milieu perd tout. Par paquets de mille, ce qui est écrit reste écrit.

import { DatabaseSync } from 'node:sqlite'

import { entier, reel, texte } from '../domaine/valeurs.ts'
import {
  prioriteFrancophone,
  type Element,
  type FicheSerie,
  type Genre,
  type Langue,
  type Programme,
} from '../domaine/types.ts'
import { ordreTheme } from '../normalisation/theme.ts'
import type { Affiche } from '../tmdb/tmdb.ts'
import { COLONNES_AJOUTEES, INDEX, SCHEMA } from './schema.ts'

/**
 * L'ordre d'affichage par défaut est francophone, et il est **dérivé** de
 * `prioriteFrancophone` plutôt que recopié en SQL. Deux listes écrites à la
 * main auraient divergé au premier changement de préférence, et le défaut ne se
 * verrait que dans l'ordre d'une grille — c'est-à-dire jamais.
 */
const ORDRE_LANGUE = `CASE langue ${(
  ['vf', 'multi', 'vostfr', 'vo', 'inconnue'] as const
)
  .map((langue) => `WHEN '${langue}' THEN ${prioriteFrancophone(langue)}`)
  .join(' ')} ELSE 9 END`

/** Le rang d'abord, puis la langue préférée : l'ordre qu'on a dans la tête. */
const ORDRE_AFFICHAGE = `rang IS NULL, rang, ${ORDRE_LANGUE}, saison, episode, titre COLLATE NOCASE`

const COLONNES = `id, source_id, source, genre, titre, titre_brut, url, langue, qualite, groupe,
  logo, tvg_id, canal, rang, theme, pays, annee, serie, saison, episode, etiquettes, options_lecture, ref_externe`

/** Les colonnes préfixées, pour les requêtes qui joignent une autre table. */
const COLONNES_PREFIXEES = COLONNES.split(',')
  .map((colonne) => `element.${colonne.trim()}`)
  .join(', ')

export interface SourceDeclaree {
  readonly genre: 'm3u' | 'xtream'
  /** Forme **masquée** de l'adresse : aucun mot de passe n'entre en base. */
  readonly adresse: string
  readonly utilisateur?: string | undefined
  readonly urlEpg?: string | undefined
}

export interface Filtres {
  readonly sourceId?: number
  readonly genre?: Genre
  readonly langue?: Langue
  readonly groupe?: string
  readonly serie?: string
  /** Le thème exact, ou la chaîne vide pour ce qui n'en a pas — « Autres ». */
  readonly theme?: string
  readonly limite?: number
  readonly decalage?: number
  /**
   * Montrer aussi les flux mesurés hors service. Faux par défaut : une liste
   * publique en contient la moitié, et les afficher revient à faire cliquer sur
   * des portes fermées.
   */
  readonly inclureMorts?: boolean
  /**
   * Montrer aussi ce qui a été classé étranger — un groupe de chaînes qui
   * désigne un autre pays, ou une piste sans français. Faux par défaut : voir
   * `normalisation/pays.ts`.
   */
  readonly inclureEtranger?: boolean
  /**
   * Une seule entrée par titre — la première dans l'ordre d'affichage.
   *
   * Un abonnement liste souvent la même chaîne plusieurs fois : une par
   * qualité, une par groupe fournisseur. TF1 apparaît alors cinq fois de
   * suite dans la mosaïque du direct, cinq fois le même canal « 1 ». Ce n'est
   * utile pour aucun écran — voir `Catalogue.tsx`, seul appelant.
   */
  readonly dedupliquer?: boolean
}

export interface ResumeImport {
  readonly lus: number
  readonly ecrits: number
  /** Entrées que le fournisseur ne sert plus, retirées après coup. */
  readonly retires: number
  readonly dureeMs: number
}

export interface OptionsImport {
  readonly paquet?: number
  /**
   * Retirer, après l'import, ce que la source ne sert plus. **Vrai par défaut**,
   * et à mettre à faux dès qu'on n'importe qu'une partie du catalogue.
   *
   * Le piège est réel et silencieux : charger les épisodes d'une seule série
   * — ce que fait l'application quand on ouvre sa fiche — purgerait les 40 000
   * autres entrées de la même source, qui n'ont simplement pas été revues.
   * L'application se retrouverait vide après un clic, sans la moindre erreur.
   */
  readonly purger?: boolean
}

export interface ResumeProgrammes {
  readonly ecrits: number
  readonly purges: number
  readonly dureeMs: number
}

/** Ce qui passe sur une chaîne à un instant donné, et ce qui suit. */
export interface Antenne {
  readonly actuel: Programme | undefined
  readonly suivant: Programme | undefined
}

export interface Reprise {
  readonly element: Element
  readonly position: number
  readonly duree: number | undefined
  readonly termine: boolean
}

/**
 * Une entrée que le fournisseur ne sert plus, et sur laquelle l'utilisateur
 * avait laissé un favori ou une position de lecture.
 *
 * Le titre est recopié plutôt que retrouvé : l'entrée d'origine est supprimée,
 * et l'identifiant seul est une empreinte d'URL qui ne se remonte pas.
 */
export interface Retrait {
  readonly elementId: string
  readonly titre: string
  readonly genre: string | undefined
  readonly serie: string | undefined
  readonly retireLe: string
}

type Ligne = Record<string, unknown>

/** SQLite n'accepte pas `undefined` : il faut le dire, sinon la liaison lève. */
function ouNul(valeur: string | number | undefined): string | number | null {
  return valeur === undefined ? null : valeur
}

function versElement(ligne: Ligne): Element {
  const lireJson = (brut: unknown): string[] => {
    if (typeof brut !== 'string') return []
    try {
      const donnees: unknown = JSON.parse(brut)
      return Array.isArray(donnees) ? donnees.filter((v): v is string => typeof v === 'string') : []
    } catch {
      return []
    }
  }

  return {
    id: texte(ligne['id']) ?? '',
    source: (texte(ligne['source']) ?? 'm3u') as Element['source'],
    genre: (texte(ligne['genre']) ?? 'direct') as Genre,
    titre: texte(ligne['titre']) ?? '',
    titreBrut: texte(ligne['titre_brut']) ?? '',
    url: texte(ligne['url']) ?? '',
    langue: (texte(ligne['langue']) ?? 'inconnue') as Langue,
    qualite: (texte(ligne['qualite']) ?? 'inconnue') as Element['qualite'],
    groupe: texte(ligne['groupe']),
    logo: texte(ligne['logo']),
    canal: entier(ligne['canal']),
    rang: entier(ligne['rang']),
    theme: texte(ligne['theme']),
    pays: texte(ligne['pays']),
    tvgId: texte(ligne['tvg_id']),
    annee: entier(ligne['annee']),
    serie: texte(ligne['serie']),
    saison: entier(ligne['saison']),
    episode: entier(ligne['episode']),
    etiquettes: lireJson(ligne['etiquettes']),
    optionsLecture: lireJson(ligne['options_lecture']),
    refExterne: texte(ligne['ref_externe']),
  }
}

const COLONNES_PROGRAMME = 'chaine, debut, fin, titre, sous_titre, resume, categories, icone'

function versProgramme(ligne: Ligne): Programme {
  let categories: string[] = []
  try {
    const brut: unknown = JSON.parse(String(ligne['categories'] ?? '[]'))
    if (Array.isArray(brut)) categories = brut.filter((c): c is string => typeof c === 'string')
  } catch {
    categories = []
  }
  return {
    chaine: texte(ligne['chaine']) ?? '',
    debut: texte(ligne['debut']) ?? '',
    fin: texte(ligne['fin']),
    titre: texte(ligne['titre']) ?? '',
    sousTitre: texte(ligne['sous_titre']),
    resume: texte(ligne['resume']),
    categories,
    icone: texte(ligne['icone']),
  }
}

/**
 * Prépare une requête pour FTS5.
 *
 * Sans cette étape, une recherche contenant `"`, `*` ou `OR` est interprétée
 * comme de la syntaxe FTS et lève une erreur en pleine frappe : l'utilisateur
 * tape un guillemet et la recherche casse. Chaque mot est donc cité, et le
 * dernier reçoit une étoile pour que la recherche réponde avant la fin du mot.
 */
export function requeteFts(saisie: string): string | undefined {
  const mots = saisie
    .replace(/["*^:()]/g, ' ')
    .split(/\s+/)
    .filter((mot) => mot !== '')
  if (mots.length === 0) return undefined
  return mots.map((mot, i) => (i === mots.length - 1 ? `"${mot}"*` : `"${mot}"`)).join(' ')
}

export interface Depot {
  readonly base: DatabaseSync
  fermer(): void
  declarerSource(source: SourceDeclaree): number
  importer(
    sourceId: number,
    elements: AsyncIterable<Element>,
    options?: OptionsImport,
  ): Promise<ResumeImport>
  enregistrerFiches(sourceId: number, fiches: Iterable<FicheSerie>): number
  fiches(filtres?: Filtres): FicheSerie[]
  /** La fiche d'une série par son titre affiché — ce que l'URL porte. */
  ficheParTitre(titre: string): FicheSerie | undefined
  /** La fiche d'une série par son identifiant — ce que la recherche d'affiche demande. */
  ficheParId(id: string): FicheSerie | undefined
  /** Un élément par son identifiant — ce que le lecteur et le mandataire demandent. */
  element(id: string): Element | undefined
  reglage(cle: string): string | undefined
  poserReglage(cle: string, valeur: string): void
  /** L'affiche déjà trouvée pour un film ou une fiche de série, si la recherche a déjà eu lieu. */
  affiche(id: string): Affiche | undefined
  /** Retient ce que TMDB a rendu — y compris l'absence de résultat, voir `schema.ts`. */
  enregistrerAffiche(id: string, affiche: Affiche): void
  compter(filtres?: Filtres): number
  lister(filtres?: Filtres): Element[]
  chercher(saisie: string, filtres?: Filtres): Element[]
  groupes(filtres?: Filtres): { nom: string; compte: number }[]
  series(filtres?: Filtres): {
    serie: string
    episodes: number
    saisons: number
    theme: string | undefined
    logo: string | undefined
  }[]
  /**
   * Les thèmes d'un genre et leur effectif, dans l'ordre d'affichage.
   *
   * `nom` vide désigne « Autres » : ce qu'aucun motif n'a reconnu. Il est rendu
   * comme les autres, parce qu'un dossier qu'on ne voit pas est un catalogue
   * amputé — et il est toujours en dernier.
   */
  themes(filtres?: Filtres): { nom: string; compte: number }[]
  episodes(serie: string): Element[]
  basculerFavori(elementId: string): boolean
  favoris(): Element[]
  enregistrerPosition(elementId: string, position: number, duree?: number): void
  reprises(limite?: number): Reprise[]
  /** Ce qui a disparu du catalogue et que l'utilisateur avait marqué. */
  retraits(): Retrait[]
  /**
   * Repose les numéros de canal d'une base déjà remplie.
   *
   * Le numéro se calcule à l'import — mais une base importée par une version
   * qui l'ignorait n'en a aucun, et un réimport complet coûte plusieurs minutes
   * pour une donnée qui se déduit du titre. Rend le nombre de chaînes numérotées.
   */
  /**
   * Reclasse tout le catalogue à partir de ce qu'on en sait déjà.
   *
   * **Le genre en fait partie, et c'est le point.** Il est calculé à l'import,
   * donc figé : une base remplie par une version dont la règle était fausse
   * garde ce classement pour toujours, et un correctif livré ensuite ne la
   * touche jamais. C'est ce qui laissait des chaînes de cinéma — Ciné+, Canal+
   * Cinémas, les chaînes Pluto — rangées dans l'onglet Films.
   *
   * Le rappel reçoit ce que la base contient et rend le classement complet.
   * Rend le nombre de chaînes qui ont reçu un vrai numéro.
   */
  reclasser(
    recalcul: (element: {
      titre: string
      url: string
      groupe: string | undefined
      langue: Langue
    }) => {
      genre: Genre
      canal?: number | undefined
      rang?: number | undefined
      theme?: string | undefined
      pays?: string | undefined
    },
  ): { numerotees: number; reclasses: number; etrangeres: number }
  /**
   * Ne garde qu'une entrée par titre — chaînes ou films — la meilleure
   * qualité disponible.
   *
   * **Le cas réel qui l'impose** : un panneau Xtream classe souvent la même
   * chaîne dans plusieurs catégories qualité à la fois (« FR TV HD »,
   * « FR TV FULL HD|4K »…), et chacune ressort comme une entrée séparée —
   * TF1 quatre ou cinq fois de suite, sous le même numéro. Masquer plutôt que
   * supprimer : c'est la même réversibilité que « flux mort ».
   *
   * **Un titre qui n'existe qu'en qualité inférieure n'est jamais retiré** —
   * un groupe d'un seul membre n'a personne à qui perdre.
   *
   * Idempotent : un masquage précédent est d'abord levé, puis rejoué sur
   * l'état actuel — un réimport qui a changé les qualités disponibles est
   * donc repris depuis zéro, jamais accumulé.
   */
  dedoublonner(genre: 'direct' | 'film'): { groupes: number; masques: number }
  /**
   * Même geste que `dedoublonner`, pour les fiches de séries déclarées.
   *
   * Une fiche n'a pas de qualité — c'est une chaîne ou un film qui en a une,
   * jamais une série. Le départage se fait donc sur ce qui rend la fiche
   * utile : un résumé, à défaut une affiche. Une fiche est **retirée**, pas
   * masquée : rien ne la référence jamais (favoris et reprises ciblent un
   * épisode, jamais une fiche), et un réimport la redéclare de toute façon.
   */
  dedoublonnerFiches(): { groupes: number; retirees: number }
  /** L'état mesuré d'une entrée, ou `undefined` si elle n'a jamais été testée. */
  etat(elementId: string): 'ok' | 'mort' | undefined
  /** Rend tout le monde visible et à retester. */
  oublierEtats(): number
  /** Retient ce qu'un test de flux a trouvé. */
  marquerEtat(elementId: string, etat: 'ok' | 'mort'): void
  /**
   * Les éléments à tester, les jamais testés d'abord.
   *
   * `jamaisTestes` ne rend que ceux qu'aucun test n'a encore touchés. C'est ce
   * qu'il faut pour avancer par lots : un flux resté **indécis** — un 403 qui
   * ne dit rien de sa santé — n'est pas marqué, et reviendrait donc dans chaque
   * lot indéfiniment. Il porte en revanche l'heure de son essai.
   */
  aTester(limite?: number, options?: { jamaisTestes?: boolean }): Element[]
  /**
   * Retient qu'une entrée a été éprouvée **sans être condamnée**.
   *
   * L'horodatage seul, jamais d'état : le flux n'a pas été vu refuser pour de
   * bon, il reste donc visible. Mais il a été essayé, et l'oublier ferait
   * tourner en rond tout balayage qui avance par lots.
   */
  marquerTeste(elementId: string): void
  compterParEtat(): { vivants: number; morts: number; inconnus: number }
  importerProgrammes(
    programmes: AsyncIterable<Programme>,
    options?: { paquet?: number; purgerAvant?: string },
  ): Promise<ResumeProgrammes>
  /** Ce qui passe sur chaque chaîne demandée, en une seule requête. */
  maintenant(chaines: readonly string[], instant?: string): Map<string, Antenne>
  grille(chaine: string, debut: string, fin: string): Programme[]
}

export function ouvrirDepot(chemin = ':memory:'): Depot {
  const base = new DatabaseSync(chemin)
  base.exec(SCHEMA)

  // Les colonnes ajoutées après coup, pour les bases déjà remplies.
  for (const ajout of COLONNES_AJOUTEES) {
    const colonnes = base.prepare(`PRAGMA table_info(${ajout.table})`).all() as Ligne[]
    if (!colonnes.some((ligne) => texte(ligne['name']) === ajout.colonne)) base.exec(ajout.sql)
  }

  // Et les index seulement maintenant : certains citent les colonnes ci-dessus,
  // qui n'existent pas encore quand le schéma s'exécute.
  base.exec(INDEX)

  const conditions = (
    filtres: Filtres,
  ): { sql: string; valeurs: (string | number)[] } => {
    const morceaux: string[] = []
    const valeurs: (string | number)[] = []
    if (filtres.sourceId !== undefined) {
      morceaux.push('source_id = ?')
      valeurs.push(filtres.sourceId)
    }
    if (filtres.genre !== undefined) {
      morceaux.push('genre = ?')
      valeurs.push(filtres.genre)
    }
    if (filtres.langue !== undefined) {
      morceaux.push('langue = ?')
      valeurs.push(filtres.langue)
    }
    if (filtres.groupe !== undefined) {
      morceaux.push('groupe = ?')
      valeurs.push(filtres.groupe)
    }
    if (filtres.serie !== undefined) {
      morceaux.push('serie = ?')
      valeurs.push(filtres.serie)
    }
    // La chaîne vide désigne « Autres » : ce qu'aucun motif n'a reconnu. Sans
    // ce cas, le dossier existerait à l'écran et ne s'ouvrirait sur rien.
    if (filtres.theme === '') morceaux.push('theme IS NULL')
    else if (filtres.theme !== undefined) {
      morceaux.push('theme = ?')
      valeurs.push(filtres.theme)
    }
    // `etat IS NULL` compte comme vivant : ce qui n'a pas été mesuré n'est pas
    // condamné. Sans cela, une base jamais testée s'afficherait vide.
    // `doublon` suit le même masquage que `mort` — un même bouton (« inclure
    // les morts ») révèle les deux, plutôt que d'ajouter un second réglage
    // pour une distinction que l'écran n'a pas besoin de faire.
    if (filtres.inclureMorts !== true) {
      morceaux.push("(etat IS NULL OR (etat <> 'mort' AND etat <> 'doublon'))")
    }
    // Même logique pour `pays` : NULL veut dire français ou indécis, jamais
    // étranger. Voir `normalisation/pays.ts`. Une langue explicitement choisie
    // lève ce filtre : pour un film ou une série, « étranger » ne veut jamais
    // dire que la piste VOSTFR ou VO — proposer le bouton puis rendre zéro
    // résultat serait pire que ne pas filtrer du tout.
    if (filtres.inclureEtranger !== true && filtres.langue === undefined) {
      morceaux.push("(pays IS NULL OR pays <> 'etranger')")
    }
    return { sql: morceaux.length === 0 ? '' : ` WHERE ${morceaux.join(' AND ')}`, valeurs }
  }

  const bornes = (filtres: Filtres): { sql: string; valeurs: number[] } => {
    const limite = filtres.limite ?? 200
    const decalage = filtres.decalage ?? 0
    return { sql: ' LIMIT ? OFFSET ?', valeurs: [limite, decalage] }
  }

  /**
   * La table de départ d'une requête : `element` telle quelle, ou une seule
   * ligne par titre quand `dedupliquer` le demande.
   *
   * Le rang tient dans la même fenêtre que le tri final — c'est ce qui
   * garantit que la ligne gardée est celle qui serait apparue en premier de
   * toute façon, jamais un choix arbitraire entre les doublons.
   */
  const depuis = (ouSql: string, dedupliquer: boolean | undefined): string =>
    dedupliquer === true
      ? `FROM (SELECT *, ROW_NUMBER() OVER (
           PARTITION BY LOWER(TRIM(titre)) ORDER BY ${ORDRE_AFFICHAGE}
         ) AS rn FROM element${ouSql}) WHERE rn = 1`
      : `FROM element${ouSql}`

  return {
    base,

    fermer(): void {
      base.close()
    },

    declarerSource(source: SourceDeclaree): number {
      const ligne = base
        .prepare(
          `INSERT INTO source (genre, adresse, utilisateur, url_epg)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (genre, adresse, utilisateur)
             DO UPDATE SET url_epg = COALESCE(excluded.url_epg, source.url_epg)
           RETURNING id`,
        )
        .get(
          source.genre,
          source.adresse,
          source.utilisateur ?? '',
          ouNul(source.urlEpg),
        ) as Ligne | undefined
      return entier(ligne?.['id']) ?? 0
    },

    async importer(sourceId, elements, options = {}): Promise<ResumeImport> {
      const paquet = options.paquet ?? 1000
      const purger = options.purger ?? true
      const debut = Date.now()
      const horodatage = new Date().toISOString()

      const ecrire = base.prepare(
        `INSERT INTO element (${COLONNES}, vu_le)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           source_id = excluded.source_id, source = excluded.source, genre = excluded.genre,
           titre = excluded.titre, titre_brut = excluded.titre_brut,
           url = excluded.url, langue = excluded.langue, qualite = excluded.qualite,
           groupe = excluded.groupe, logo = excluded.logo, tvg_id = excluded.tvg_id,
           canal = excluded.canal, rang = excluded.rang, theme = excluded.theme,
           pays = excluded.pays,
           annee = excluded.annee, serie = excluded.serie, saison = excluded.saison,
           episode = excluded.episode, etiquettes = excluded.etiquettes,
           options_lecture = excluded.options_lecture, ref_externe = excluded.ref_externe,
           vu_le = excluded.vu_le
         RETURNING rowid`,
      )
      const oublier = base.prepare('DELETE FROM recherche WHERE rowid = ?')
      const indexer = base.prepare('INSERT INTO recherche (rowid, texte) VALUES (?, ?)')

      let lus = 0
      let ecrits = 0
      let ouvert = false

      const ouvrir = (): void => {
        if (!ouvert) {
          base.exec('BEGIN')
          ouvert = true
        }
      }
      const refermer = (): void => {
        if (ouvert) {
          base.exec('COMMIT')
          ouvert = false
        }
      }

      try {
        for await (const element of elements) {
          lus += 1
          ouvrir()
          const ecrit = ecrire.get(
            element.id,
            sourceId,
            element.source,
            element.genre,
            element.titre,
            element.titreBrut,
            element.url,
            element.langue,
            element.qualite,
            ouNul(element.groupe),
            ouNul(element.logo),
            ouNul(element.tvgId),
            ouNul(element.canal),
            ouNul(element.rang),
            ouNul(element.theme),
            ouNul(element.pays),
            ouNul(element.annee),
            ouNul(element.serie),
            ouNul(element.saison),
            ouNul(element.episode),
            JSON.stringify(element.etiquettes),
            JSON.stringify(element.optionsLecture),
            ouNul(element.refExterne),
            horodatage,
          ) as Ligne | undefined
          const rang = entier(ecrit?.['rowid'])
          if (rang !== undefined) {
            // Le titre d'origine est indexé lui aussi : c'est lui qu'on cherche
            // quand le nettoyage a trop mangé, et il ne coûte que sa place.
            oublier.run(rang)
            indexer.run(
              rang,
              [element.titre, element.titreBrut, element.serie ?? '', element.groupe ?? ''].join(' '),
            )
          }
          ecrits += 1
          if (ecrits % paquet === 0) refermer()
        }
        refermer()
      } catch (cause) {
        if (ouvert) {
          base.exec('ROLLBACK')
          ouvert = false
        }
        throw cause
      }

      // Ce que le fournisseur ne sert plus. Retiré **après** l'import réussi :
      // vider la table d'abord laisserait l'application vide si le réseau coupe
      // au milieu.
      const perimes = purger
        ? (base
            .prepare(
              'SELECT rowid, id, titre, genre, serie FROM element ' +
                'WHERE source_id = ? AND vu_le < ?',
            )
            .all(sourceId, horodatage) as Ligne[])
        : []
      if (perimes.length > 0) {
        base.exec('BEGIN')
        const retirer = base.prepare('DELETE FROM element WHERE rowid = ?')
        // Consigné **avant** la suppression, et seulement pour ce que
        // l'utilisateur a marqué : après le DELETE il ne reste qu'un
        // identifiant, qui est une empreinte de l'URL et ne dit pas quel film a
        // disparu. Le filtre vit dans le SQL plutôt que dans une lecture
        // préalable — deux `EXISTS` sur des clés primaires coûtent moins qu'un
        // aller-retour par ligne sur les cent quatre-vingts d'un import.
        const consigner = base.prepare(
          'INSERT OR REPLACE INTO retrait (element_id, titre, genre, serie, retire_le) ' +
            'SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM favori WHERE element_id = ?) ' +
            'OR EXISTS (SELECT 1 FROM lecture WHERE element_id = ?)',
        )
        for (const ligne of perimes) {
          const rang = entier(ligne['rowid'])
          if (rang === undefined) continue
          const id = texte(ligne['id'])
          if (id !== undefined) {
            consigner.run(
              id,
              texte(ligne['titre']) ?? '',
              texte(ligne['genre']) ?? null,
              texte(ligne['serie']) ?? null,
              horodatage,
              id,
              id,
            )
          }
          retirer.run(rang)
          oublier.run(rang)
        }
        base.exec('COMMIT')
      }

      base
        .prepare('UPDATE source SET importe_le = ? WHERE id = ?')
        .run(horodatage, sourceId)

      return { lus, ecrits, retires: perimes.length, dureeMs: Date.now() - debut }
    },

    enregistrerFiches(sourceId, fiches): number {
      const horodatage = new Date().toISOString()
      const ecrire = base.prepare(
        `INSERT INTO serie (id, source_id, ref_externe, titre, titre_brut, annee,
                            logo, resume, genres, groupe, langue, vu_le)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           titre = excluded.titre, titre_brut = excluded.titre_brut,
           annee = excluded.annee, logo = excluded.logo, resume = excluded.resume,
           genres = excluded.genres, groupe = excluded.groupe,
           langue = excluded.langue, vu_le = excluded.vu_le`,
      )
      let ecrites = 0
      base.exec('BEGIN')
      try {
        for (const fiche of fiches) {
          ecrire.run(
            fiche.id,
            sourceId,
            ouNul(fiche.refExterne),
            fiche.titre,
            fiche.titreBrut,
            ouNul(fiche.annee),
            ouNul(fiche.logo),
            ouNul(fiche.resume),
            JSON.stringify(fiche.genres),
            ouNul(fiche.groupe),
            fiche.langue,
            horodatage,
          )
          ecrites += 1
        }
        base.exec('COMMIT')
      } catch (cause) {
        base.exec('ROLLBACK')
        throw cause
      }
      return ecrites
    },

    fiches(filtres = {}): FicheSerie[] {
      const morceaux: string[] = []
      const valeurs: (string | number)[] = []
      if (filtres.sourceId !== undefined) {
        morceaux.push('source_id = ?')
        valeurs.push(filtres.sourceId)
      }
      if (filtres.langue !== undefined) {
        morceaux.push('langue = ?')
        valeurs.push(filtres.langue)
      }
      const ou = morceaux.length === 0 ? '' : ` WHERE ${morceaux.join(' AND ')}`
      const lignes = base
        .prepare(
          `SELECT id, ref_externe, titre, titre_brut, annee, logo, resume, genres,
                  groupe, langue
           FROM serie${ou} ORDER BY titre COLLATE NOCASE LIMIT ? OFFSET ?`,
        )
        .all(...valeurs, filtres.limite ?? 200, filtres.decalage ?? 0) as Ligne[]

      return lignes.map((ligne) => {
        let genres: string[] = []
        try {
          const brut: unknown = JSON.parse(String(ligne['genres'] ?? '[]'))
          if (Array.isArray(brut)) genres = brut.filter((g): g is string => typeof g === 'string')
        } catch {
          genres = []
        }
        return {
          id: texte(ligne['id']) ?? '',
          refExterne: texte(ligne['ref_externe']),
          titre: texte(ligne['titre']) ?? '',
          titreBrut: texte(ligne['titre_brut']) ?? '',
          annee: entier(ligne['annee']),
          logo: texte(ligne['logo']),
          resume: texte(ligne['resume']),
          genres,
          groupe: texte(ligne['groupe']),
          langue: (texte(ligne['langue']) ?? 'inconnue') as Langue,
        }
      })
    },

    element(id): Element | undefined {
      const ligne = base.prepare(`SELECT ${COLONNES} FROM element WHERE id = ?`).get(id) as
        | Ligne
        | undefined
      return ligne === undefined ? undefined : versElement(ligne)
    },

    reglage(cle): string | undefined {
      const ligne = base.prepare('SELECT valeur FROM reglage WHERE cle = ?').get(cle) as
        | Ligne
        | undefined
      return texte(ligne?.['valeur'])
    },

    poserReglage(cle, valeur): void {
      base
        .prepare(
          `INSERT INTO reglage (cle, valeur) VALUES (?, ?)
           ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur`,
        )
        .run(cle, valeur)
    },

    ficheParTitre(titre): FicheSerie | undefined {
      const ligne = base
        .prepare(
          `SELECT id, ref_externe, titre, titre_brut, annee, logo, resume, genres,
                  groupe, langue
           FROM serie WHERE titre = ? COLLATE NOCASE LIMIT 1`,
        )
        .get(titre) as Ligne | undefined
      if (ligne === undefined) return undefined
      let genres: string[] = []
      try {
        const brut: unknown = JSON.parse(String(ligne['genres'] ?? '[]'))
        if (Array.isArray(brut)) genres = brut.filter((g): g is string => typeof g === 'string')
      } catch {
        genres = []
      }
      return {
        id: texte(ligne['id']) ?? '',
        refExterne: texte(ligne['ref_externe']),
        titre: texte(ligne['titre']) ?? '',
        titreBrut: texte(ligne['titre_brut']) ?? '',
        annee: entier(ligne['annee']),
        logo: texte(ligne['logo']),
        resume: texte(ligne['resume']),
        genres,
        groupe: texte(ligne['groupe']),
        langue: (texte(ligne['langue']) ?? 'inconnue') as Langue,
      }
    },

    ficheParId(id): FicheSerie | undefined {
      const ligne = base
        .prepare(
          `SELECT id, ref_externe, titre, titre_brut, annee, logo, resume, genres,
                  groupe, langue
           FROM serie WHERE id = ?`,
        )
        .get(id) as Ligne | undefined
      if (ligne === undefined) return undefined
      let genres: string[] = []
      try {
        const brut: unknown = JSON.parse(String(ligne['genres'] ?? '[]'))
        if (Array.isArray(brut)) genres = brut.filter((g): g is string => typeof g === 'string')
      } catch {
        genres = []
      }
      return {
        id: texte(ligne['id']) ?? '',
        refExterne: texte(ligne['ref_externe']),
        titre: texte(ligne['titre']) ?? '',
        titreBrut: texte(ligne['titre_brut']) ?? '',
        annee: entier(ligne['annee']),
        logo: texte(ligne['logo']),
        resume: texte(ligne['resume']),
        genres,
        groupe: texte(ligne['groupe']),
        langue: (texte(ligne['langue']) ?? 'inconnue') as Langue,
      }
    },

    affiche(id): Affiche | undefined {
      const ligne = base.prepare('SELECT url, resume FROM affiche WHERE id = ?').get(id) as
        | Ligne
        | undefined
      return ligne === undefined ? undefined : { url: texte(ligne['url']), resume: texte(ligne['resume']) }
    },

    enregistrerAffiche(id, affiche): void {
      base
        .prepare(
          `INSERT INTO affiche (id, url, resume, interroge_le) VALUES (?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             url = excluded.url, resume = excluded.resume, interroge_le = excluded.interroge_le`,
        )
        .run(id, ouNul(affiche.url), ouNul(affiche.resume), new Date().toISOString())
    },

    compter(filtres = {}): number {
      const ou = conditions(filtres)
      const ligne = base
        .prepare(`SELECT COUNT(*) AS n ${depuis(ou.sql, filtres.dedupliquer)}`)
        .get(...ou.valeurs) as Ligne | undefined
      return entier(ligne?.['n']) ?? 0
    },

    lister(filtres = {}): Element[] {
      const ou = conditions(filtres)
      const fin = bornes(filtres)
      const lignes = base
        .prepare(
          // Le rang d'abord : c'est l'ordre qu'on a dans la tête pour les
          // chaînes, et il est sans effet ailleurs — un film n'en a jamais.
          `SELECT ${COLONNES} ${depuis(ou.sql, filtres.dedupliquer)}
           ORDER BY ${ORDRE_AFFICHAGE}${fin.sql}`,
        )
        .all(...ou.valeurs, ...fin.valeurs) as Ligne[]
      return lignes.map(versElement)
    },

    chercher(saisie, filtres = {}): Element[] {
      const requete = requeteFts(saisie)
      if (requete === undefined) return []
      const ou = conditions(filtres)
      const fin = bornes(filtres)
      // `rank` d'abord — la pertinence FTS —, la préférence de langue ensuite :
      // trier par langue en premier ferait remonter une correspondance faible en
      // VF avant le titre exact cherché.
      const lignes = base
        .prepare(
          `SELECT ${COLONNES_PREFIXEES}
           FROM recherche
           JOIN element ON element.rowid = recherche.rowid
           WHERE recherche MATCH ?${ou.sql.replace(/ WHERE /, ' AND ')}
           ORDER BY rank, ${ORDRE_LANGUE}, titre COLLATE NOCASE${fin.sql}`,
        )
        .all(requete, ...ou.valeurs, ...fin.valeurs) as Ligne[]
      return lignes.map(versElement)
    },

    groupes(filtres = {}): { nom: string; compte: number }[] {
      const ou = conditions({ ...filtres, groupe: undefined })
      const lignes = base
        .prepare(
          `SELECT groupe AS nom, COUNT(*) AS compte FROM element${ou.sql}
           ${ou.sql === '' ? 'WHERE' : 'AND'} groupe IS NOT NULL
           GROUP BY groupe ORDER BY compte DESC, nom COLLATE NOCASE`,
        )
        .all(...ou.valeurs) as Ligne[]
      return lignes.map((ligne) => ({
        nom: texte(ligne['nom']) ?? '',
        compte: entier(ligne['compte']) ?? 0,
      }))
    },

    series(filtres = {}): {
      serie: string
      episodes: number
      saisons: number
      theme: string | undefined
      logo: string | undefined
    }[] {
      const ou = conditions({ ...filtres, genre: 'serie' })
      const lignes = base
        .prepare(
          // MAX plutôt qu'un vote : les épisodes d'une série partagent leur
          // groupe, donc leur thème. MAX rend le seul qui existe, et évite un
          // second passage pour départager des valeurs identiques.
          `SELECT serie, COUNT(*) AS episodes, COUNT(DISTINCT saison) AS saisons,
                  MAX(theme) AS theme, MAX(logo) AS logo
           FROM element${ou.sql} AND serie IS NOT NULL
           GROUP BY serie ORDER BY serie COLLATE NOCASE`,
        )
        .all(...ou.valeurs) as Ligne[]
      return lignes.map((ligne) => ({
        serie: texte(ligne['serie']) ?? '',
        episodes: entier(ligne['episodes']) ?? 0,
        saisons: entier(ligne['saisons']) ?? 0,
        theme: texte(ligne['theme']),
        logo: texte(ligne['logo']),
      }))
    },

    episodes(serie): Element[] {
      const lignes = base
        .prepare(
          `SELECT ${COLONNES} FROM element WHERE serie = ?
           ORDER BY saison, episode, titre COLLATE NOCASE`,
        )
        .all(serie) as Ligne[]
      return lignes.map(versElement)
    },

    basculerFavori(elementId): boolean {
      const existe = base
        .prepare('SELECT 1 AS present FROM favori WHERE element_id = ?')
        .get(elementId)
      if (existe !== undefined) {
        base.prepare('DELETE FROM favori WHERE element_id = ?').run(elementId)
        return false
      }
      base
        .prepare('INSERT INTO favori (element_id, ajoute_le) VALUES (?, ?)')
        .run(elementId, new Date().toISOString())
      return true
    },

    favoris(): Element[] {
      // Jointure interne : un favori dont l'élément a disparu du catalogue
      // reste en base — il reviendra au prochain import — mais ne s'affiche pas
      // dans une grille où il ne serait pas lisible.
      const lignes = base
        .prepare(
          `SELECT ${COLONNES_PREFIXEES}
           FROM favori JOIN element ON element.id = favori.element_id
           ORDER BY favori.ajoute_le DESC`,
        )
        .all() as Ligne[]
      return lignes.map(versElement)
    },

    enregistrerPosition(elementId, position, duree): void {
      // « Terminé » à 95 % : un générique de fin dure plus longtemps que la
      // patience de qui l'a lancé, et un épisode laissé à 97 % ne doit pas
      // revenir en tête des reprises.
      const termine = duree !== undefined && duree > 0 && position / duree >= 0.95 ? 1 : 0
      base
        .prepare(
          `INSERT INTO lecture (element_id, position_s, duree_s, termine, vu_le)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (element_id) DO UPDATE SET
             position_s = excluded.position_s,
             duree_s = COALESCE(excluded.duree_s, lecture.duree_s),
             termine = excluded.termine,
             vu_le = excluded.vu_le`,
        )
        .run(elementId, position, ouNul(duree), termine, new Date().toISOString())
    },

    async importerProgrammes(programmes, options = {}): Promise<ResumeProgrammes> {
      const paquet = options.paquet ?? 1000
      const debut = Date.now()

      const ecrire = base.prepare(
        `INSERT INTO programme (chaine, debut, fin, titre, sous_titre, resume, categories, icone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (chaine, debut) DO UPDATE SET
           fin = excluded.fin, titre = excluded.titre,
           sous_titre = excluded.sous_titre, resume = excluded.resume,
           categories = excluded.categories, icone = excluded.icone`,
      )

      let ecrits = 0
      let ouvert = false
      const ouvrir = () => {
        if (!ouvert) {
          base.exec('BEGIN')
          ouvert = true
        }
      }
      const refermer = () => {
        if (ouvert) {
          base.exec('COMMIT')
          ouvert = false
        }
      }

      try {
        for await (const programme of programmes) {
          ouvrir()
          ecrire.run(
            programme.chaine,
            programme.debut,
            ouNul(programme.fin),
            programme.titre,
            ouNul(programme.sousTitre),
            ouNul(programme.resume),
            JSON.stringify(programme.categories),
            ouNul(programme.icone),
          )
          ecrits += 1
          if (ecrits % paquet === 0) refermer()
        }
        refermer()
      } catch (cause) {
        if (ouvert) {
          base.exec('ROLLBACK')
          ouvert = false
        }
        throw cause
      }

      // Le passé se purge, sinon la base grossit d'un guide par jour sans que
      // rien ne s'affiche jamais. La veille est gardée : une émission commencée
      // hier soir se termine ce matin.
      const limite =
        options.purgerAvant ?? new Date(Date.now() - 36 * 3600 * 1000).toISOString()
      const purges = base
        .prepare('DELETE FROM programme WHERE COALESCE(fin, debut) < ?')
        .run(limite).changes

      return { ecrits, purges: Number(purges), dureeMs: Date.now() - debut }
    },

    maintenant(chaines, instant = new Date().toISOString()): Map<string, Antenne> {
      const resultat = new Map<string, Antenne>()
      if (chaines.length === 0) return resultat
      const trous = chaines.map(() => '?').join(', ')

      const actuels = base
        .prepare(
          `SELECT ${COLONNES_PROGRAMME} FROM programme
           WHERE chaine IN (${trous}) AND debut <= ? AND (fin IS NULL OR fin > ?)`,
        )
        .all(...chaines, instant, instant) as Ligne[]

      // Le suivant, en une requête plutôt qu'une par chaîne : sur une grille de
      // deux cents chaînes, la seconde forme fait deux cents allers-retours.
      const suivants = base
        .prepare(
          `SELECT ${COLONNES_PROGRAMME} FROM programme p
           JOIN (
             SELECT chaine AS c, MIN(debut) AS d FROM programme
             WHERE chaine IN (${trous}) AND debut > ? GROUP BY chaine
           ) m ON m.c = p.chaine AND m.d = p.debut`,
        )
        .all(...chaines, instant) as Ligne[]

      for (const chaine of chaines) resultat.set(chaine, { actuel: undefined, suivant: undefined })
      for (const ligne of actuels) {
        const programme = versProgramme(ligne)
        resultat.set(programme.chaine, {
          ...(resultat.get(programme.chaine) ?? { actuel: undefined, suivant: undefined }),
          actuel: programme,
        })
      }
      for (const ligne of suivants) {
        const programme = versProgramme(ligne)
        resultat.set(programme.chaine, {
          ...(resultat.get(programme.chaine) ?? { actuel: undefined, suivant: undefined }),
          suivant: programme,
        })
      }
      return resultat
    },

    grille(chaine, debut, fin): Programme[] {
      const lignes = base
        .prepare(
          `SELECT ${COLONNES_PROGRAMME} FROM programme
           WHERE chaine = ? AND debut < ? AND COALESCE(fin, debut) > ?
           ORDER BY debut`,
        )
        .all(chaine, fin, debut) as Ligne[]
      return lignes.map(versProgramme)
    },

    reclasser(recalcul): { numerotees: number; reclasses: number; etrangeres: number } {
      const lignes = base
        .prepare('SELECT id, titre, url, groupe, genre, langue FROM element')
        .all() as Ligne[]
      const poser = base.prepare(
        'UPDATE element SET genre = ?, canal = ?, rang = ?, theme = ?, pays = ? WHERE id = ?',
      )
      let numerotees = 0
      let reclasses = 0
      let etrangeres = 0

      base.exec('BEGIN')
      try {
        for (const ligne of lignes) {
          const avant = texte(ligne['genre'])
          const decision = recalcul({
            titre: texte(ligne['titre']) ?? '',
            url: texte(ligne['url']) ?? '',
            groupe: texte(ligne['groupe']),
            langue: (texte(ligne['langue']) ?? 'inconnue') as Langue,
          })
          poser.run(
            decision.genre,
            decision.canal ?? null,
            decision.rang ?? null,
            decision.theme ?? null,
            decision.pays ?? null,
            texte(ligne['id']) ?? '',
          )
          if (decision.canal !== undefined) numerotees += 1
          if (avant !== decision.genre) reclasses += 1
          if (decision.pays === 'etranger') etrangeres += 1
        }
        base.exec('COMMIT')
      } catch (cause) {
        base.exec('ROLLBACK')
        throw cause
      }
      return { numerotees, reclasses, etrangeres }
    },

    dedoublonner(genre): { groupes: number; masques: number } {
      // L'ordre est celui déjà retenu par `detecterQualite` : « UHD » et
      // « 4K » y sont confondus sous une seule étiquette, il n'y a donc pas de
      // palier UHD séparé à ajouter ici.
      const RANG_QUALITE = ['4k', 'fhd', 'hd', 'sd', 'inconnue']

      base.exec('BEGIN')
      try {
        // Idempotent : un masquage précédent est levé avant d'être rejoué —
        // un réimport a pu changer les qualités disponibles pour un titre.
        // `teste_le` aussi : lui seul l'avait posé, jamais un vrai test de
        // flux ; le laisser ferait passer pour « déjà éprouvée » une entrée
        // qui ne l'a jamais été, si elle cesse d'être un doublon.
        base
          .prepare("UPDATE element SET etat = NULL, teste_le = NULL WHERE genre = ? AND etat = 'doublon'")
          .run(genre)

        const lignes = base
          .prepare(
            `SELECT id, titre, qualite FROM element
             WHERE genre = ? AND (etat IS NULL OR etat = 'ok')`,
          )
          .all(genre) as Ligne[]

        const groupesParTitre = new Map<string, { id: string; qualite: string }[]>()
        for (const ligne of lignes) {
          const cle = (texte(ligne['titre']) ?? '').toLocaleLowerCase('fr')
          const membre = { id: texte(ligne['id']) ?? '', qualite: texte(ligne['qualite']) ?? 'inconnue' }
          const groupe = groupesParTitre.get(cle)
          if (groupe === undefined) groupesParTitre.set(cle, [membre])
          else groupe.push(membre)
        }

        // `teste_le` aussi, sinon un doublon jamais éprouvé reste candidat
        // pour « Éprouver » — et un test qui le trouve vivant écrirait
        // `etat = 'ok'` par-dessus, défaisant le masquage sans qu'on l'ait
        // demandé.
        const masquer = base.prepare(
          "UPDATE element SET etat = 'doublon', teste_le = ? WHERE id = ?",
        )
        let groupes = 0
        let masques = 0
        for (const membres of groupesParTitre.values()) {
          // Un groupe d'un seul membre n'a personne à qui perdre : c'est
          // exactement ce qui protège un titre qui n'existe qu'en qualité
          // inférieure.
          if (membres.length < 2) continue
          groupes += 1
          const rang = (m: { qualite: string }): number => {
            const position = RANG_QUALITE.indexOf(m.qualite)
            return position === -1 ? RANG_QUALITE.length : position
          }
          const tries = [...membres].sort((a, b) => rang(a) - rang(b))
          for (const perdant of tries.slice(1)) {
            masquer.run(new Date().toISOString(), perdant.id)
            masques += 1
          }
        }
        base.exec('COMMIT')
        return { groupes, masques }
      } catch (cause) {
        base.exec('ROLLBACK')
        throw cause
      }
    },

    dedoublonnerFiches(): { groupes: number; retirees: number } {
      base.exec('BEGIN')
      try {
        const lignes = base.prepare('SELECT id, titre, resume, logo FROM serie').all() as Ligne[]

        const groupesParTitre = new Map<
          string,
          { id: string; resume: string | undefined; logo: string | undefined }[]
        >()
        for (const ligne of lignes) {
          const cle = (texte(ligne['titre']) ?? '').toLocaleLowerCase('fr')
          const membre = {
            id: texte(ligne['id']) ?? '',
            resume: texte(ligne['resume']),
            logo: texte(ligne['logo']),
          }
          const groupe = groupesParTitre.get(cle)
          if (groupe === undefined) groupesParTitre.set(cle, [membre])
          else groupe.push(membre)
        }

        const retirer = base.prepare('DELETE FROM serie WHERE id = ?')
        let groupes = 0
        let retirees = 0
        for (const membres of groupesParTitre.values()) {
          if (membres.length < 2) continue
          groupes += 1
          // La plus utile d'abord : un résumé vaut mieux qu'une affiche
          // seule, une affiche seule vaut mieux que rien.
          const rang = (m: { resume: string | undefined; logo: string | undefined }): number =>
            m.resume !== undefined ? 0 : m.logo !== undefined ? 1 : 2
          const tries = [...membres].sort((a, b) => rang(a) - rang(b))
          for (const perdante of tries.slice(1)) {
            retirer.run(perdante.id)
            retirees += 1
          }
        }
        base.exec('COMMIT')
        return { groupes, retirees }
      } catch (cause) {
        base.exec('ROLLBACK')
        throw cause
      }
    },

    themes(filtres = {}): { nom: string; compte: number }[] {
      const ou = conditions({ ...filtres, theme: undefined })
      const lignes = base
        .prepare(
          `SELECT COALESCE(theme, '') AS nom, COUNT(*) AS compte
           FROM element${ou.sql}
           GROUP BY nom`,
        )
        .all(...ou.valeurs) as Ligne[]
      return lignes
        .map((ligne) => ({ nom: texte(ligne['nom']) ?? '', compte: entier(ligne['compte']) ?? 0 }))
        .sort((a, b) => ordreTheme(a.nom) - ordreTheme(b.nom) || a.nom.localeCompare(b.nom, 'fr'))
    },

    etat(elementId): 'ok' | 'mort' | undefined {
      const ligne = base.prepare('SELECT etat FROM element WHERE id = ?').get(elementId) as
        | Ligne
        | undefined
      const valeur = texte(ligne?.['etat'])
      return valeur === 'ok' || valeur === 'mort' ? valeur : undefined
    },

    oublierEtats(): number {
      const avant = base.prepare('SELECT COUNT(*) AS n FROM element WHERE etat IS NOT NULL').get() as
        | Ligne
        | undefined
      base.exec('UPDATE element SET etat = NULL, teste_le = NULL')
      return entier(avant?.['n']) ?? 0
    },

    marquerEtat(elementId, etat): void {
      base
        .prepare('UPDATE element SET etat = ?, teste_le = ? WHERE id = ?')
        .run(etat, new Date().toISOString(), elementId)
    },

    aTester(limite = 5000, options = {}): Element[] {
      const filtre = options.jamaisTestes === true ? ' WHERE teste_le IS NULL' : ''
      const lignes = base
        .prepare(
          `SELECT ${COLONNES} FROM element${filtre}
           ORDER BY teste_le IS NOT NULL, teste_le LIMIT ?`,
        )
        .all(limite) as Ligne[]
      return lignes.map(versElement)
    },

    marquerTeste(elementId): void {
      base
        .prepare('UPDATE element SET teste_le = ? WHERE id = ?')
        .run(new Date().toISOString(), elementId)
    },

    compterParEtat(): { vivants: number; morts: number; inconnus: number } {
      const compte = (condition: string): number => {
        const ligne = base.prepare(`SELECT COUNT(*) AS n FROM element WHERE ${condition}`).get() as
          | Ligne
          | undefined
        return entier(ligne?.['n']) ?? 0
      }
      return {
        vivants: compte("etat = 'ok'"),
        morts: compte("etat = 'mort'"),
        inconnus: compte('etat IS NULL'),
      }
    },

    reprises(limite = 20): Reprise[] {
      const lignes = base
        .prepare(
          `SELECT ${COLONNES_PREFIXEES},
                  lecture.position_s, lecture.duree_s, lecture.termine
           FROM lecture JOIN element ON element.id = lecture.element_id
           WHERE lecture.termine = 0
           ORDER BY lecture.vu_le DESC LIMIT ?`,
        )
        .all(limite) as Ligne[]
      return lignes.map((ligne) => ({
        element: versElement(ligne),
        position: reel(ligne['position_s']) ?? 0,
        duree: reel(ligne['duree_s']),
        termine: entier(ligne['termine']) === 1,
      }))
    },

    retraits(): Retrait[] {
      // Sans jointure sur `element` : tout l'intérêt de cette table est de
      // parler d'entrées qui n'y sont plus. Une jointure la viderait.
      const lignes = base
        .prepare('SELECT element_id, titre, genre, serie, retire_le FROM retrait ORDER BY retire_le DESC')
        .all() as Ligne[]
      return lignes.map((ligne) => ({
        elementId: texte(ligne['element_id']) ?? '',
        titre: texte(ligne['titre']) ?? '',
        genre: texte(ligne['genre']),
        serie: texte(ligne['serie']),
        retireLe: texte(ligne['retire_le']) ?? '',
      }))
    },
  }
}

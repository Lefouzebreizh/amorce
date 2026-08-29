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
import { SCHEMA } from './schema.ts'

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

const COLONNES = `id, source_id, source, genre, titre, titre_brut, url, langue, qualite, groupe,
  logo, tvg_id, annee, serie, saison, episode, etiquettes, options_lecture, ref_externe`

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
  readonly limite?: number
  readonly decalage?: number
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
  /** Un élément par son identifiant — ce que le lecteur et le mandataire demandent. */
  element(id: string): Element | undefined
  reglage(cle: string): string | undefined
  poserReglage(cle: string, valeur: string): void
  compter(filtres?: Filtres): number
  lister(filtres?: Filtres): Element[]
  chercher(saisie: string, filtres?: Filtres): Element[]
  groupes(filtres?: Filtres): { nom: string; compte: number }[]
  series(filtres?: Filtres): { serie: string; episodes: number; saisons: number }[]
  episodes(serie: string): Element[]
  basculerFavori(elementId: string): boolean
  favoris(): Element[]
  enregistrerPosition(elementId: string, position: number, duree?: number): void
  reprises(limite?: number): Reprise[]
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
    return { sql: morceaux.length === 0 ? '' : ` WHERE ${morceaux.join(' AND ')}`, valeurs }
  }

  const bornes = (filtres: Filtres): { sql: string; valeurs: number[] } => {
    const limite = filtres.limite ?? 200
    const decalage = filtres.decalage ?? 0
    return { sql: ' LIMIT ? OFFSET ?', valeurs: [limite, decalage] }
  }

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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           source_id = excluded.source_id, source = excluded.source, genre = excluded.genre,
           titre = excluded.titre, titre_brut = excluded.titre_brut,
           url = excluded.url, langue = excluded.langue, qualite = excluded.qualite,
           groupe = excluded.groupe, logo = excluded.logo, tvg_id = excluded.tvg_id,
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
            .prepare('SELECT rowid FROM element WHERE source_id = ? AND vu_le < ?')
            .all(sourceId, horodatage) as Ligne[])
        : []
      if (perimes.length > 0) {
        base.exec('BEGIN')
        const retirer = base.prepare('DELETE FROM element WHERE rowid = ?')
        for (const ligne of perimes) {
          const rang = entier(ligne['rowid'])
          if (rang === undefined) continue
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

    compter(filtres = {}): number {
      const ou = conditions(filtres)
      const ligne = base
        .prepare(`SELECT COUNT(*) AS n FROM element${ou.sql}`)
        .get(...ou.valeurs) as Ligne | undefined
      return entier(ligne?.['n']) ?? 0
    },

    lister(filtres = {}): Element[] {
      const ou = conditions(filtres)
      const fin = bornes(filtres)
      const lignes = base
        .prepare(
          `SELECT ${COLONNES} FROM element${ou.sql}
           ORDER BY ${ORDRE_LANGUE}, saison, episode, titre COLLATE NOCASE${fin.sql}`,
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

    series(filtres = {}): { serie: string; episodes: number; saisons: number }[] {
      const ou = conditions({ ...filtres, genre: 'serie' })
      const lignes = base
        .prepare(
          `SELECT serie, COUNT(*) AS episodes, COUNT(DISTINCT saison) AS saisons
           FROM element${ou.sql} AND serie IS NOT NULL
           GROUP BY serie ORDER BY serie COLLATE NOCASE`,
        )
        .all(...ou.valeurs) as Ligne[]
      return lignes.map((ligne) => ({
        serie: texte(ligne['serie']) ?? '',
        episodes: entier(ligne['episodes']) ?? 0,
        saisons: entier(ligne['saisons']) ?? 0,
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
  }
}

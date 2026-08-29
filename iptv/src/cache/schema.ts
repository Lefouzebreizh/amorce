// Le schéma du cache local, et les décisions qu'il porte.
//
// **Pourquoi un cache du tout.** Une liste de fournisseur pèse de 50 à 400 Mo.
// La relire à chaque ouverture de l'application coûterait vingt à quarante
// secondes avant le premier écran, à chaque fois. Elle est donc analysée une
// fois, écrite ici, et l'interface ne parle plus qu'à cette base.
//
// **Pourquoi SQLite, et pas Redis ni un fichier JSON.** `node:sqlite` est livré
// avec Node 22 : pas de module natif à compiler, pas de service à faire tourner,
// et la recherche plein texte (FTS5) est incluse. Un fichier JSON obligerait à
// tout charger en mémoire — précisément ce que l'analyseur en flux évite en
// amont, et il serait absurde de le défaire ici.
//
// **Ce qui n'est jamais écrit ici : un mot de passe.** L'adresse d'une source
// est enregistrée sous sa forme masquée. Un réimport reçoit l'adresse réelle en
// argument, depuis `.env` ; la base, elle, peut être copiée, sauvegardée ou
// envoyée en pièce jointe sans livrer l'abonnement de personne.

/**
 * Les ajouts de colonnes, appliqués à une base qui existe déjà.
 *
 * `CREATE TABLE IF NOT EXISTS` ne touche pas une table présente : une colonne
 * ajoutée au schéma n'apparaît donc **jamais** chez qui a déjà importé quelque
 * chose. Depuis que cette application tourne ailleurs que sur la machine qui
 * l'écrit, ce n'est plus une hypothèse — c'est le cas courant.
 *
 * Chaque entrée est rejouée à chaque ouverture et doit donc être sans effet la
 * seconde fois ; `PRAGMA table_info` dit ce qui manque, plutôt que d'attendre
 * l'erreur d'un ALTER en double.
 */
export const COLONNES_AJOUTEES: readonly { table: string; colonne: string; sql: string }[] = [
  { table: 'element', colonne: 'etat', sql: 'ALTER TABLE element ADD COLUMN etat TEXT' },
  { table: 'element', colonne: 'teste_le', sql: 'ALTER TABLE element ADD COLUMN teste_le TEXT' },
]

export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS source (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  genre      TEXT NOT NULL,          -- 'm3u' | 'xtream'
  adresse    TEXT NOT NULL,          -- masquée : jamais de mot de passe ici
  -- Chaîne vide plutôt que NULL, et ce n'est pas cosmétique : SQLite tient deux
  -- NULL pour distincts dans une contrainte UNIQUE. Avec « utilisateur » nullable,
  -- « ON CONFLICT » ne se déclencherait jamais pour une liste M3U, et chaque
  -- import créerait une source de plus — donc un catalogue dupliqué.
  utilisateur TEXT NOT NULL DEFAULT '',
  url_epg    TEXT,
  importe_le TEXT,
  UNIQUE (genre, adresse, utilisateur)
);

CREATE TABLE IF NOT EXISTS element (
  id              TEXT PRIMARY KEY,
  source_id       INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,     -- 'm3u' | 'xtream' : d'où l'entrée vient
  genre           TEXT NOT NULL,     -- 'direct' | 'film' | 'serie'
  titre           TEXT NOT NULL,
  titre_brut      TEXT NOT NULL,
  url             TEXT NOT NULL,
  langue          TEXT NOT NULL,
  qualite         TEXT NOT NULL,
  groupe          TEXT,
  logo            TEXT,
  tvg_id          TEXT,
  annee           INTEGER,
  serie           TEXT,
  saison          INTEGER,
  episode         INTEGER,
  etiquettes      TEXT NOT NULL,     -- JSON
  options_lecture TEXT NOT NULL,     -- JSON
  ref_externe     TEXT,
  -- État du flux, tel que « npm run iptv -- tester » l'a trouvé : NULL tant
  -- qu'on n'a rien mesuré, « ok » ou « mort » ensuite. Les listes publiques
  -- contiennent une forte proportion de flux abandonnés ou géobloqués, et rien
  -- ne les distingue à l'œil d'un flux valide.
  etat            TEXT,
  teste_le        TEXT,
  -- Horodatage du dernier import qui a vu cette entrée. C'est lui qui permet de
  -- retirer, après coup, ce que le fournisseur ne sert plus : on ne vide pas la
  -- table avant d'importer, sans quoi une coupure réseau en cours de route
  -- laisserait l'utilisateur devant une application vide.
  vu_le           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS element_par_genre  ON element (source_id, genre);
CREATE INDEX IF NOT EXISTS element_par_groupe ON element (source_id, groupe);
CREATE INDEX IF NOT EXISTS element_par_serie  ON element (serie, saison, episode);
CREATE INDEX IF NOT EXISTS element_par_tvg    ON element (tvg_id);

-- Les séries **déclarées**, celles qu'un panneau Xtream sert comme objets.
--
-- Une liste M3U n'en a pas : ses séries n'existent que par le regroupement de
-- ses épisodes. Les deux notions coexistent donc pour de bon, et cette table ne
-- se remplit que pour une source Xtream. Elle est séparée d'« element » parce
-- qu'une série n'a pas d'URL — même raison que « FicheSerie » dans le domaine.
CREATE TABLE IF NOT EXISTS serie (
  id          TEXT PRIMARY KEY,
  source_id   INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  ref_externe TEXT,
  titre       TEXT NOT NULL,
  titre_brut  TEXT NOT NULL,
  annee       INTEGER,
  logo        TEXT,
  resume      TEXT,
  genres      TEXT NOT NULL,     -- JSON
  groupe      TEXT,
  langue      TEXT NOT NULL,
  vu_le       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS serie_par_titre ON serie (titre COLLATE NOCASE);

-- Recherche plein texte, liée à « element » par le rowid et rien d'autre.
--
-- La première version portait une colonne « element_id UNINDEXED », ce qui
-- paraissait plus lisible. C'était un piège à retardement : UNINDEXED veut dire
-- « stockée, pas indexée », donc chaque mise à jour d'une entrée devait
-- retrouver sa ligne par un balayage complet de l'index. Invisible sur les six
-- entrées d'un test, quadratique sur un vrai catalogue — l'import de 120 000
-- entrées ne finissait pas en dix minutes.
--
-- Le rowid, lui, est la clé native de FTS5 : la suppression est une recherche
-- d'arbre. Le lien avec « element » se fait par « element.rowid », que
-- l'insertion rend avec RETURNING.
CREATE VIRTUAL TABLE IF NOT EXISTS recherche USING fts5(
  texte,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- Favoris et positions de lecture ne référencent PAS element.
--
-- C'est délibéré, et c'est la décision la plus importante du fichier. Un
-- fournisseur retire un film pendant une semaine puis le remet ; avec une clé
-- étrangère en cascade, le réimport effacerait le favori et la position de
-- lecture au premier retrait. Ce que l'utilisateur a marqué lui appartient et
-- survit au catalogue — quitte à désigner, un temps, une entrée absente.
CREATE TABLE IF NOT EXISTS favori (
  element_id TEXT PRIMARY KEY,
  ajoute_le  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lecture (
  element_id TEXT PRIMARY KEY,
  position_s REAL NOT NULL,
  duree_s    REAL,
  termine    INTEGER NOT NULL DEFAULT 0,
  vu_le      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS lecture_recente ON lecture (vu_le DESC);

-- Le guide des programmes.
--
-- La clé primaire est (chaine, debut) : un guide se réimporte tous les jours et
-- recouvre en partie le précédent. Sans elle, chaque réimport doublerait la
-- grille, et « en ce moment » rendrait deux émissions pour le même instant.
--
-- Les instants sont en ISO 8601 UTC, sous forme de texte. C'est ce que SQLite
-- compare le mieux — l'ordre lexicographique d'un ISO est l'ordre
-- chronologique — et cela évite de choisir un fuseau à l'écriture.
CREATE TABLE IF NOT EXISTS programme (
  chaine     TEXT NOT NULL,
  debut      TEXT NOT NULL,
  fin        TEXT,
  titre      TEXT NOT NULL,
  sous_titre TEXT,
  resume     TEXT,
  categories TEXT NOT NULL,     -- JSON
  icone      TEXT,
  PRIMARY KEY (chaine, debut)
);

CREATE INDEX IF NOT EXISTS programme_par_instant ON programme (chaine, debut);

-- Les réglages de l'installation. Une seule entrée pour l'instant : le secret
-- qui signe les adresses passées au mandataire de flux. Il doit survivre à un
-- redémarrage — un secret tiré à chaque démarrage ferait échouer toute lecture
-- en cours — et n'a rien à faire dans le dépôt Git.
CREATE TABLE IF NOT EXISTS reglage (
  cle    TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);
`

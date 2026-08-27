-- Base D1 de hypersensible-bienveillance.com
--
-- Trois tables, pas une de plus. `users` ne sert qu'au décompte des cinq
-- analyses quotidiennes du trafic externe : on n'y range aucune adresse IP en
-- clair, seulement son empreinte SHA-256, et aucun texte soumis. Ce qui est
-- écrit dans l'application n'est jamais stocké — c'est la contrepartie de
-- « l'abri n'est pas un produit ».
--
-- Rejouable : chaque `CREATE` est gardé par IF NOT EXISTS et les insertions
-- d'outils par un index unique sur l'URL. Relancer ce fichier deux fois de
-- suite ne duplique rien.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  ip_hash     TEXT NOT NULL,
  src         TEXT,
  usage_count INTEGER DEFAULT 0,
  last_request DATE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Le quota se lit une fois par requête, sur cette empreinte seule : sans index
-- unique, D1 balaie la table entière et la latence grimpe avec le trafic.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ip_hash ON users(ip_hash);

CREATE TABLE IF NOT EXISTS tools (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  current_price REAL NOT NULL,
  last_checked  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_url ON tools(url);

CREATE TABLE IF NOT EXISTS price_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id    INTEGER NOT NULL,
  price      REAL NOT NULL,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tool_id) REFERENCES tools(id)
);

-- Le radar trace une courbe par outil, dans l'ordre du temps. Cet index-là
-- transforme dix balayages de table en dix lectures ordonnées.
CREATE INDEX IF NOT EXISTS idx_price_history_tool ON price_history(tool_id, checked_at);

-- Les dix outils suivis. Prix mensuels de départ, en euros, relevés à la main
-- au moment de l'écriture : ils servent d'amorce, le Worker de veille les
-- corrige ensuite tout seul.
INSERT OR IGNORE INTO tools (name, url, current_price) VALUES
  ('Petit BamBou',   'https://www.petitbambou.com', 7.99),
  ('Calm',           'https://www.calm.com',       12.99),
  ('Stoic',          'https://www.getstoic.com',    6.99),
  ('Headspace',      'https://www.headspace.com',  12.99),
  ('Insight Timer',  'https://insighttimer.com',    9.99),
  ('Moodfit',        'https://www.getmoodfit.com',  8.99),
  ('Day One',        'https://dayoneapp.com',       5.99),
  ('Sanvello',       'https://www.sanvello.com',    8.99),
  ('Bearable',       'https://bearable.app',        6.49),
  ('Alan Mind',      'https://mind.alan.com',       9.00);

-- Trois relevés par outil, à 90, 60 et 30 jours, pour que la courbe du radar
-- ait une pente dès la première visite plutôt qu'un point isolé. Les écarts
-- sont écrits en dur et non tirés au sort : un jeu de départ reproductible se
-- relit d'une session à l'autre, un jeu aléatoire ne se compare à rien.
--
-- `SELECT id FROM tools WHERE url = …` plutôt qu'un identifiant en dur :
-- AUTOINCREMENT ne garantit la numérotation que sur une base vierge, et ce
-- fichier doit pouvoir être rejoué sur une base déjà peuplée.
-- `WITH … VALUES` plutôt qu'une chaîne de `UNION ALL` : D1 refuse au-delà d'un
-- certain nombre de termes dans un SELECT composé (« too many terms in
-- compound SELECT »), et trente en font partie. Une liste VALUES passe, se lit
-- mieux, et se complète sans compter les termes.
WITH releves(url, price, decalage) AS (
  VALUES
    ('https://www.petitbambou.com',  6.99, '-90 days'),
    ('https://www.petitbambou.com',  7.49, '-60 days'),
    ('https://www.petitbambou.com',  7.99, '-30 days'),
    ('https://www.calm.com',        11.99, '-90 days'),
    ('https://www.calm.com',        12.49, '-60 days'),
    ('https://www.calm.com',        12.99, '-30 days'),
    ('https://www.getstoic.com',     7.49, '-90 days'),
    ('https://www.getstoic.com',     7.19, '-60 days'),
    ('https://www.getstoic.com',     6.99, '-30 days'),
    ('https://www.headspace.com',   12.99, '-90 days'),
    ('https://www.headspace.com',   13.49, '-60 days'),
    ('https://www.headspace.com',   12.99, '-30 days'),
    ('https://insighttimer.com',     9.99, '-90 days'),
    ('https://insighttimer.com',     9.49, '-60 days'),
    ('https://insighttimer.com',     9.99, '-30 days'),
    ('https://www.getmoodfit.com',   8.49, '-90 days'),
    ('https://www.getmoodfit.com',   8.99, '-60 days'),
    ('https://www.getmoodfit.com',   8.99, '-30 days'),
    ('https://dayoneapp.com',        4.99, '-90 days'),
    ('https://dayoneapp.com',        5.49, '-60 days'),
    ('https://dayoneapp.com',        5.99, '-30 days'),
    ('https://www.sanvello.com',     9.49, '-90 days'),
    ('https://www.sanvello.com',     9.19, '-60 days'),
    ('https://www.sanvello.com',     8.99, '-30 days'),
    ('https://bearable.app',         5.99, '-90 days'),
    ('https://bearable.app',         6.29, '-60 days'),
    ('https://bearable.app',         6.49, '-30 days'),
    ('https://mind.alan.com',        9.00, '-90 days'),
    ('https://mind.alan.com',        9.00, '-60 days'),
    ('https://mind.alan.com',        8.50, '-30 days')
)
INSERT INTO price_history (tool_id, price, checked_at)
SELECT t.id, r.price, datetime('now', r.decalage)
FROM releves r
JOIN tools t ON t.url = r.url
-- Garde-fou de relecture : sans lui, rejouer le fichier ajouterait trente
-- points de plus et la courbe du radar prendrait des marches d'escalier.
WHERE NOT EXISTS (SELECT 1 FROM price_history p WHERE p.tool_id = t.id);

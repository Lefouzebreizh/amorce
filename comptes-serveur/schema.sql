-- Deux tables. `comptes` porte le solde courant ; `mouvements` porte
-- pourquoi il vaut ce qu'il vaut, et sert de verrou contre les rejeux.
--
-- Le solde est dupliqué exprès sur `comptes.solde` plutôt que recalculé en
-- sommant `mouvements` à chaque lecture : la lecture du solde arrive à chaque
-- appel de génération, l'écriture d'un mouvement seulement à chaque achat ou
-- dépense. Optimiser la mauvaise opération aurait coûté à tout le monde pour
-- économiser à personne.
CREATE TABLE IF NOT EXISTS comptes (
  id       TEXT PRIMARY KEY,
  email    TEXT NOT NULL UNIQUE,
  solde    INTEGER NOT NULL DEFAULT 0,
  cree_le  INTEGER NOT NULL
);

-- `id` est fabriqué par l'appelant (`achat:<payment_intent>`,
-- `remb:<payment_intent>`, ou plus tard `depense:<job_id>`) — jamais
-- auto-incrémenté. C'est ce qui rend `crediter` idempotent : rejouer le même
-- événement Stripe, ou le même appel de génération après une coupure réseau,
-- retombe sur le même id, et `INSERT OR IGNORE` absorbe le doublon sans
-- toucher deux fois au solde.
CREATE TABLE IF NOT EXISTS mouvements (
  id          TEXT PRIMARY KEY,
  compte_id   TEXT NOT NULL,
  delta       INTEGER NOT NULL,
  motif       TEXT NOT NULL,
  horodatage  INTEGER NOT NULL
);

-- Un lien de connexion est à usage unique. Le jeton reste scellé sans état
-- (HMAC, aucune lecture en base pour l'ouvrir), mais son `jti` — un identifiant
-- tiré au hasard, glissé dans la charge — se consomme ici à la première
-- vérification réussie. Une seconde vérification du même lien retombe sur un
-- `jti` déjà présent et se fait refuser : un lien intercepté (fuite par
-- l'en-tête Referer, historique d'un poste partagé, journal, transfert de
-- courriel) ne vaut plus rien une fois qu'il a servi.
--
-- Même motif d'idempotence que `mouvements` : `jti` est la clé primaire, et
-- `INSERT OR IGNORE` rend `changes: 0` sur un doublon. D1 sérialise les
-- écritures d'une même base, donc deux vérifications concurrentes du même lien
-- ne peuvent pas lire toutes les deux `changes: 1` — une seule mint une
-- session, l'autre est refusée.
--
-- `exp` (l'expiration du lien, en secondes Unix) n'est pas relu pour décider :
-- le sceau HMAC le fait déjà, et un jeton expiré est rejeté avant d'arriver
-- ici. Il n'est stocké que pour permettre une purge des lignes dont la date
-- est passée — un `jti` consommé ne sert plus à rien une fois le lien expiré.
CREATE TABLE IF NOT EXISTS liens_consommes (
  jti  TEXT PRIMARY KEY,
  exp  INTEGER NOT NULL
);

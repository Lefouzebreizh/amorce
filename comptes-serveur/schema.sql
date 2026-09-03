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

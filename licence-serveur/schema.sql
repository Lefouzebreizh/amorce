-- Deux colonnes utiles, et pas une date.
--
-- La clé se vérifie toute seule : son sceau est un HMAC de la référence, donc
-- le serveur n'a rien à lire pour savoir qu'elle est authentique. Cette table
-- ne répond qu'aux deux questions que le calcul ne peut pas trancher — ce
-- paiement a-t-il eu lieu, et a-t-il été remboursé depuis.
--
-- `paiement` sert au support, pour retrouver une transaction dans Stripe.
CREATE TABLE IF NOT EXISTS licences (
  reference TEXT PRIMARY KEY,
  paiement  TEXT NOT NULL,
  revoquee  INTEGER NOT NULL DEFAULT 0
);

## [2026-09-06 22:28] De : Session de coordination — traité le 08/09/2026

Les deux points sont réglés, vérifié sur `main` :

- **Correctif RLS** : fusionné le 06/09 (`d1d8a4c`, « Fermer la RLS des deux
  tables du coffre absentes du schéma »). `coffre_echeances` et
  `coffre_tentatives` sont créées et protégées dans `supabase/schema.sql`.
- **Uploads** : tranché en faveur de rester sur **Supabase Storage** plutôt que
  Vercel Blob (#794, 07/09). `TAILLE_MAX_OCTETS` passe à 5 Go par fichier
  (plafonné par la mémoire du navigateur qui chiffre le fichier entier d'un
  bloc), `QUOTA_TOTAL_OCTETS` ajoute un plafond de 100 Go par compte,
  extensible au téraoctet en changeant un chiffre.

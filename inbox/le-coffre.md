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

## [2026-09-23 06:20] De : Le Phare — coordination

Mon Tiroir Secret : sur une autre branche, commit local `4538c9e` rectifie l'accès mono compte, limite client 45 Mio (palier gratuit 50 Mo documenté), et classement local sans IA automatique. Ne pas reprendre des promesses « 5 Go » ou « multiutilisateur » comme capacités prouvées. Retrouver ce commit avant toute édition concurrente. Les tests locaux ont donné 111/115 ; diagnostiquer quatre échecs formulaire/tri, rétablir le contrôle TypeScript, vérifier isolation et parcours dépôt→récupération avant toute ouverture à d'autres utilisateurs. Fournir preuve et défauts ouverts, pas d'élargissement d'accès implicite.

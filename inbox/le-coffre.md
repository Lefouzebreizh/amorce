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


## [2026-09-28] Direction visuelle et chat unique — en cours

Erwann demande une expérience du Tiroir Secret plus lumineuse, accueillante et moderne, avec une sensation de cocon. Il veut conserver la scène marine 3D déjà validée. L’exigence générale est également inscrite dans `STYLE_GUIDE.md` pour tous les projets existants et futurs, avec un niveau de finition équivalent au Studio et la vérification réelle de chaque bouton et parcours.

Références examinées le 28/09/2026 :

- Pinterest, [Mindful Dashboard UI — Calm Mobile Interface in Pale Beige](https://in.pinterest.com/pin/882494489487960589/) : tons pâles, composition apaisée, navigation discrète et rythme visuel calme.
- MotionSite AI, [Pixzen](https://www.motionsite.ai/templates/pixzen) : typographie éditoriale affirmée, composition épurée et mouvement fluide. À adapter à une application de documents ; conserver sa clarté plutôt que son esthétique monochrome sombre.

Sur la branche de travail, le champ du chat reste sélectionnable et accepte la saisie en mode démo ; l’envoi vers Gemini reste réservé à une session authentifiée. La démo affiche un accès vers l’écran de connexion réel. Vérifier ces comportements après chaque modification et ne pas présenter le mode démo comme une session Gemini fonctionnelle.

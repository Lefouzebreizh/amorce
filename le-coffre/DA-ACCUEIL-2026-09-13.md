# Accueil Mon Tiroir Secret — lot DA du 13 septembre 2026

Responsable : session MVP privé, sous-agent tiroir_da. Base de travail : `29e3985a1b9e8d15befe4a03820ae133b6176049`. Base de la PR : `4e28eaff4618774956bea7469fe880e3e3f128b3` (main relu avant publication ; accueil et layout identiques, intégration de #969 sans chevauchement). Périmètre : accueil avant connexion ; aucune modification des documents, du chiffrement, des fonctions Supabase ou du déploiement.

## Référence et contenu

- Scène bretonne/zèbre approuvée du MVP privé, WebP 1200 × 400 repris sans retouche dans `public/brand/bretagne-zebre-scene.webp`.
- Fond #05000a, surfaces marine, éclairage violet ; titre et marque en dégradé turquoise-violet clair (#98e9dd → #d3bef9), demandé par le propriétaire. Corps de texte uni.
- Panneau de connexion distinct et calme ; CSS module limité à l’accueil, texte courant 18 px minimum, cibles 44 px minimum, aucune animation.
- Connexion par lien, attente, succès et erreur conservés. États annoncés, erreur associée au champ, focus visible.
- Nom Mon Tiroir Secret et métadonnées alignés. Promesse absolue de confidentialité et comparaison concurrentielle non sourcée retirées ; transmissions IA expliquées, conformément au correctif déjà préparé dans le MVP.

## Vérifications et limites

- `npm run typecheck` réussi.
- ESLint sur les deux TSX : aucune erreur ; avertissement déjà présent sur le chargement Google Fonts du layout.
- `NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=validation-locale-sans-secret npm run build -- --webpack` réussi avec Next.js 16.3.3. Variables fictives uniquement ; premier build refusé faute de variables requises, sans masquer le contrôle.
- Avertissement existant dans `src/lib/formulaire.ts` : import par défaut pdf-lib. Hors lot accueil ; ne pas interpréter le build comme validation de génération PDF.
- `git diff --check` réussi.
- Vérification visuelle tentée dans le navigateur officiel sur le serveur local : `http://terminal.local:4184/` refusé par `ERR_BLOCKED_BY_CLIENT`. Aucun rendu desktop/mobile inspecté et aucune capture produite. Serveur et onglet fermés.
- Aucun courriel envoyé, compte créé, document transmis, secret lu ou paiement effectué. Authentification réelle, clavier, états rendus et Safari restent à vérifier sur un aperçu autorisé.

**Statut : brouillon à vérifier visuellement avant intégration. Aucun déploiement ni fusion.** Le correctif global de confidentialité déjà préparé pour les autres écrans du coffre reste un lot distinct. La PR design-system #969 a été intégrée pendant le lot ; ses règles nouvelles ont été relues. Elle ne touche pas le-coffre, sous-projet Next.js autonome ; aucun import vers une autre racine npm n’est ajouté.

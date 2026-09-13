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

## Reprise après intégration — session portail, 13 septembre 2026

Le statut ci-dessus décrit le premier lot à sa rédaction. La PR #970 a depuis été fusionnée dans `main` au commit `1260ba33e1e072344bb108d35e2336c120b0b950`. Cette reprise complète le lot existant ; aucune seconde refonte.

- Aperçu exact de #970 examiné dans Chromium : `https://coffre-k9p2utftp-erwannchevallier-6916s-projects.vercel.app/`, déploiement Vercel `dpl_3bFxqbTZkSzCaz3vqJQ24FaySgAF`, source `88edb468daaba70a96c927e939c77baa89cfe3d2`. Le dernier déploiement du projet appartenait à une branche OmniRoute plus ancienne pour le coffre : il ne constituait pas une preuve de la nouvelle DA.
- Rendu bureau inspecté : scène et titres visibles, formulaire distinct, textes de commande à 18 px, champ/bouton/volet de 56 à 59 px, pas de débordement horizontal. Volet IA ouvert et contenu affiché. Les erreurs de console observées provenaient de l’extension du navigateur, pas de l’application.
- Finitions : accès direct « Mon espace » vers le formulaire avec cible de focus ; nom complet du manifeste et de l’installation Apple harmonisé avec l’accueil ; version de cache augmentée pour renouveler le manifeste et la coquille. La description du manifeste dit « avant stockage » pour ne pas laisser croire que les fonctions IA ne transmettent jamais de contenu en clair.
- Contrôles locaux du complément : TypeScript réussi, ESLint sans erreur (avertissement de police existant), 127 tests existants réussis, build Next.js 16.3.3 webpack réussi avec configuration Supabase fictive `example.invalid`. Avertissement pdf-lib existant hors lot.
- Complément contrôlé dans son propre aperçu : `https://coffre-ekrlwxww6-erwannchevallier-6916s-projects.vercel.app/`, source `51027f2f9e6abc9d40bef8e9f114a0f1f740d21d`, Vercel `dpl_9QBpMgp4zEbVpUN4hyBPC4KXPBRg`. Le lien « Mon espace » mesure 46,8 px de haut ; le clic cible `#connexion` et y place le focus. La touche Tab passe ensuite au champ e-mail avec contour visible.
- Cadre mobile Chromium 393 × 873 : bouton présent dès le premier écran, clic réel dans la frame puis formulaire entièrement visible. Après navigation, le panneau commence à 24,4 px du haut ; largeur de contenu 378 px et largeur déroulante 378 px, donc aucun débordement horizontal. Il s’agit d’un cadre navigateur, pas d’un téléphone physique.
- Manifeste de ce même aperçu : HTTP 200, nom `Mon Tiroir Secret`, description actualisée ; icônes et identifiant de démarrage conservés. Vérification visuelle du complément terminée dans ce périmètre. La CI « Le Coffre » et la cohérence du dépôt sont également réussies au commit contrôlé.
- Limites : aucun courriel envoyé ni session privée ouverte ; le parcours de connexion réel, le chiffrement en usage, l’installation sur un téléphone physique et les fonctions IA ne sont pas validés par ce lot visuel.


## Palette quatre couleurs — PR980

Base actuelle conservée, y compris le lien Mon espace ajouté après PR970. Correctif limité à accueil.module.css : turquoise #40e0d0, bleu #68b5ff, vert #65e4a0 et violet #bd91ff sur titres, paragraphes, navigation, libellés, valeurs saisies, messages et bouton. Rampe sombre adaptée au bouton clair. Aucun JavaScript, contrôle de connexion ou document modifié.

Typage local réussi ; build Next webpack réussi avec configuration fictive, avertissement pdf-lib préexistant. Analyse PostCSS de la CSS finale réussie. Le build Vercel du commit c0521718955aa6a54672954c8f7bb9c93b76e867 est READY (dpl_8DL1qiZECN1sNptFtSrUJaGaGEiv). Aperçu exact : https://coffre-jp5eiozo6-erwannchevallier-6916s-projects.vercel.app/ . Deux ouvertures par le navigateur officiel ont renvoyé «502 Bad Gateway — connection closed». Rendu réel non inspecté dans cette passe ; le statut READY ne remplace pas la recette. Aucun courriel envoyé ni session ouverte.

Statut du complément palette : À VÉRIFIER VISUELLEMENT, PR en brouillon. Ne pas reprendre les captures de l’ancien déploiement pour valider cette nouvelle CSS.

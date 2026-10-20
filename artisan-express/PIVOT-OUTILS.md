# Artisan Express et les outils de terrain

Évolution du 20 octobre 2026. Le site conserve Next.js App Router, TypeScript, Tailwind 4 et sa charte sombre turquoise et violette. Les outils sont utilisables en démonstration sans créer de compte. L’installation réelle est proposée après étude du besoin ; aucun tarif récurrent n’est inventé.

## Architecture

`src/app/page.tsx` assemble les sections serveur et les composants client ciblés. Les six modèles métiers de `public/modeles/`, `ApercuSite`, `Galerie` et les offres de sites existantes sont conservés. La comparaison historique `AvantApres` reste dans les sources et sort du parcours principal pour laisser la place aux outils.

- `src/lib/services.ts` porte les identifiants stables `appels`, `devis`, `local` et `site` ; noms et contenus sont partagés entre l’interface et la génération de courriels.
- `AppelsManques.tsx` gère le scénario appel sans réponse → SMS simulé → réponse simulée → fiche de rappel. `src/lib/sms.ts` construit les textes et valide les liens d’avis. Aucun numéro de client n’est demandé pour jouer le scénario.
- `DevisVocal.tsx` possède son module CSS et isole SpeechRecognition derrière une détection de capacité. La reconnaissance peut utiliser le service du navigateur ; le clavier reste disponible. Le composant nettoie le micro au démontage et affiche refus, absence de parole, panne et navigateur non compatible.
- `src/lib/devis-vocal.ts` structure localement des phrases séparées par virgule, point-virgule ou saut de ligne, sans casser les virgules décimales. Il identifie les heures et des montants explicitement accompagnés d’une devise, sans confondre les litres et les euros. La simulation est volontairement limitée : chaque ligne reste modifiable, les prix absents restent à compléter. Les totaux reposent sur des centimes entiers et des quantités en millièmes.
- `src/lib/devis-pdf.ts` est chargé au clic de téléchargement. Il génère un PDF A4 natif, paginé, avec caractères français, police incorporée et marque de démonstration. `devis-police.ts` contient le sous-ensemble de police et sa licence. Le document est un brouillon, avec TVA non définie, jamais un devis contractuel prêt à envoyer.
- `PresenceLocale.tsx` décrit le kit et permet de préparer puis copier une demande d’avis. Les liens HTTPS acceptés sont les formats Google de demande d’avis explicites. Aucun client n’est sélectionné selon sa satisfaction ; aucune note ni récompense n’est demandée.
- `ChoisirService.tsx` émet `artisan:besoin`, écouté dans le formulaire. L’événement historique `artisan:offre` continue de sélectionner une formule de site. `demande.ts` valide le besoin reconnu ; `courriel.ts` l’inclut dans les chemins Resend et mailto.

## Frontières de données

Les démonstrations SMS et devis ne persistent pas leurs données. Le PDF est créé dans le navigateur. La reconnaissance vocale ne démarre qu’au clic ; son éventuel prestataire dépend du navigateur. Utiliser des données fictives pendant les essais.

Seul le formulaire de contact transmet volontairement des informations vers `/api/devis` et la messagerie configurée. Les paramètres et le parcours de secours existants sont maintenus. Une demande sur un outil n’active ni service ni abonnement.

## Raccordements avant service réel

Un navigateur ne lit pas le journal d’appels natif. Pour passer du simulateur au service d’appels manqués, prévoir un numéro ou un renvoi compatible avec le téléphone de l’artisan, puis des événements de téléphonie côté serveur. Le parcours connecté doit distinguer appel répondu, occupé et sans réponse, vérifier les signatures des événements, dédupliquer les notifications et plafonner les envois. Prévoir file de traitement, reprise et statuts d’envoi, réponse du client, supervision et moyen de désactiver le service. Les SMS et le numéro peuvent générer des frais, à chiffrer avant activation.

Une structuration IA peut ensuite remplacer la fonction locale derrière une interface serveur validée, avec schéma de sortie, confirmation des prix, limites de coût et protection des données. Le PDF actuel peut rester la sortie de démonstration ; l’émission réelle exige les informations et paramètres commerciaux du professionnel.

Pour Google, l’optimisation de la fiche est une prestation d’accompagnement sur le compte du propriétaire. Une automatisation réelle de demandes d’avis exige un événement de fin d’intervention et un canal SMS connecté, sans filtrage préalable des notes. Aucun accès OAuth Google n’a été ajouté pour prétendre optimiser une fiche depuis cette page.

## Vérifications

Les preuves sont consignées dans la description de la pull request : tests Node, typage, ESLint, build et parcours navigateur. La reconnaissance a été vérifiée par scénarios navigateur simulés et par son repli texte, sans validation avec un micro physique. Aucun SMS réel ni courriel client n’est envoyé pendant la recette. Le succès du formulaire est simulé dans le navigateur ; son repli 503 est exercé sur la route locale non configurée.

La recette reproductible `node scripts/verifier-outils.mjs` s’appuie sur Playwright déjà déclaré à la racine du monorepo et un build existant. Elle lance un serveur local avec l’envoi Resend explicitement désactivé, conserve ses captures dans un dossier temporaire et ferme son serveur à la fin. `ARTISAN_CHROMIUM` peut désigner un navigateur installé ; `ARTISAN_PLAYWRIGHT_MODULE` sert aux environnements où Playwright est fourni séparément. Les captures sont des preuves de recette, pas des références clients.

Contrôler le déploiement de la branche avant publication. La mise en ligne de l’accueil ne valide pas les services connectés décrits ci-dessus.

## Sources de conception et limites

Consultées le 20 octobre 2026 :

- Next.js, documentation locale `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` et https://nextjs.org/docs/app/getting-started/server-and-client-components : frontières client/serveur conservées.
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition : disponibilité limitée et reconnaissance éventuellement distante.
- https://support.google.com/business/answer/7400114 : avis fondés sur une expérience réelle, sans sollicitation sélective des avis positifs.
- https://www.framer.com/awards/ et https://akiflow.com/ : hiérarchie orientée tâche et démonstration du produit ; https://dribbble.com/shots/25121521-HR-Management-Dashboard-Design : référence d’organisation d’outil. Les pages textuelles ont été accessibles ; les visuels principaux de ces références n’ont pas pu être inspectés. La composition finale s’appuie sur la charte et les médias déjà validés dans Artisan Express, avec un espace de travail sobre et un aperçu de devis clair.

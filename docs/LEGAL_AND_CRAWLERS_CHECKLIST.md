# Robots, découvrabilité et conformité — Le Phare

**État : checklist d’ingénierie et de revue juridique, pas une certification ni un avis juridique.**  
**Vérification du dépôt : 13 novembre 2026.**

## 1. Robots et visibilité publique

Le dépôt ne contenait pas de route robots.txt pour l’application. Cette PR ajoute src/app/robots.ts :

- User-agent: * est autorisé sur les pages publiques ;
- /api/ est exclu des consignes de découverte ordinaires ;
- aucun sitemap n’est annoncé avant vérification du domaine canonique.

Cette règle invite les robots conformes, y compris ceux des services d’IA, à explorer le contenu public. **Elle ne garantit pas l’indexation, l’apparition dans les réponses de toutes les IA ni le respect des consignes par tous les robots.** Le protocole robots est une politique d’exploration, pas un contrôle d’accès. Les API et contenus privés doivent rester protégés par authentification et autorisation réelles.

Les fournisseurs peuvent distinguer les robots de recherche des robots de collecte pour l’entraînement. La règle générique actuelle les autorise tous sur les pages publiques ; le choix de limiter certains usages doit être décidé explicitement. Les préférences de chaque fournisseur doivent être revérifiées avant le lancement.

### Avant d’annoncer la visibilité

- Vérifier sur le domaine public réel que /robots.txt répond avec le contenu attendu.
- Confirmer quels parcours sont réellement publics et exclure toute route personnelle ou donnée rendue côté serveur.
- Configurer le domaine canonique et publier un sitemap.xml quand l’URL de production est confirmée.
- Vérifier les directives de chaque robot important : recherche, entraînement et éventuels robots de prévisualisation peuvent être distincts.
- Vérifier que les pages sont accessibles sans connexion, lisibles par les robots, correctement titrées et reliées entre elles.
- Ne jamais utiliser robots.txt pour cacher des clés, des données, une route d’administration ou un dossier personnel.

## 2. État légal et confidentialité observé dans le dépôt

Audit de lecture de la branche codex/phare-maison-espaces :

- src/app/mentions-legales/page.tsx et src/app/cgv/page.tsx existent. Les CGV contiennent encore une mention de médiateur à désigner ; les documents doivent être relus avant vente.
- Une page dédiée de politique de confidentialité n’a pas été trouvée à la racine du produit.
- Les mentions décrivent des textes conservés dans le navigateur, mais src/app/api/phare/conversation/route.ts transmet le message, l’historique et le contexte à Gemini lorsque sa configuration serveur l’active. Le contenu juridique et l’interface doivent expliquer clairement ce mode connecté.
- La route d’IA exige une configuration de clé, un hash d’accès et l’activation explicite du chat ; son GET annonce paidProduction: false. Aucun appel de production n’est établi par cet audit.
- src/lib/phare.ts conserve des données de projets et de profil dans le stockage local du navigateur. Le chiffrement au repos n’est pas démontré par ce module.
- Le studio indique garder les fichiers importés dans le navigateur. Le registre src/lib/phare-capabilities.ts décrit la voix Web Speech comme dépendante du navigateur/de la connexion.
- Cet audit n’établit pas l’existence d’une politique complète de rétention fournisseur, d’un processus d’exercice des droits, d’une limitation de débit ou d’un journal d’audit exhaustif.

Ces constats sont des points de contrôle, pas la conclusion qu’un traitement est conforme ou non conforme. Une revue complète exige les flux de données réels, la configuration d’hébergement, les contrats fournisseurs et les usages prévus.

## 3. Plan de conformité à instruire

### Gouvernance et cartographie

- Décrire chaque traitement : finalité, catégories de données, personnes concernées, source, base légale, destinataires, durée, lieu et mesure de sécurité.
- Déterminer les rôles de Le Phare, de l’éditeur et de chaque fournisseur : responsable de traitement, responsables conjoints ou sous-traitant selon le cas.
- Séparer les finalités : conversation, sauvegarde, recherche documentaire, synchronisation, statistiques, personnalisation, entraînement, voix, partage familial et recherche Web.
- Maintenir un registre des traitements et une liste des fournisseurs, sous-traitants ultérieurs, pays de traitement et transferts.

### Information, choix et droits des personnes

- Fournir une information claire au moment de la collecte et avant l’envoi vers un fournisseur externe.
- Indiquer les données envoyées, le destinataire, la finalité, les durées connues, les options locales et les limites de contrôle côté fournisseur.
- Ne pas confondre accord d’utiliser le service avec l’accord d’entraîner un modèle, de conserver des enregistrements, de cloner une voix ou de partager un souvenir.
- Prévoir les mécanismes applicables de consultation, rectification, export, opposition, retrait du consentement et effacement.
- Définir l’effacement effectif dans les copies, sauvegardes, index, caches, journaux, fournisseurs et adaptations de modèles, avec délais documentés.

### Données sensibles, voix, famille et mineurs

- Minimiser la collecte et éviter les profils permanents lorsqu’ils ne sont pas nécessaires.
- Traiter séparément les informations de santé, de handicap, de situation sociale, les journaux intimes, les récits familiaux, les photos et la voix.
- Ne pas utiliser une phrase vocale seule comme authentification forte.
- Avant un traitement biométrique d’identification, un profilage sensible, un usage familial ou la collecte de données de mineurs, faire examiner la base juridique, les garanties et les responsabilités.
- Obtenir les autorisations nécessaires des personnes représentées ou enregistrées ; prévoir la révocation et les règles d’accès aux archives transmissibles.

### Modèles IA et fournisseurs

- Pour chaque fournisseur, vérifier les conditions, la conservation, l’usage éventuel des données pour l’entraînement, les sous-traitants et les transferts hors EEE.
- Conclure les contrats nécessaires, y compris les clauses de sous-traitance lorsque le rôle du fournisseur le requiert.
- Afficher le fournisseur et le mode local/connecté avant l’appel ; aucun changement silencieux et aucun envoi multiple pour comparer sans demande.
- Étudier les obligations du règlement européen sur l’IA selon le rôle, le cas d’usage, le niveau de risque et les dates d’application ; ne pas appliquer une classification générique à tous les espaces.

### Sécurité et exploitation

- Vérifier séparation des utilisateurs et projets, contrôle d’accès serveur, chiffrement en transit et au repos, gestion/révocation des clés, sauvegardes et restauration.
- Limiter les données dans les journaux ; prévoir détection, gestion et notification des incidents selon les délais légaux applicables.
- Fixer les règles de rétention des fichiers, conversations, prompts, médias, index et résultats fournisseurs.
- Mettre en place des tests de sécurité ciblés et documenter les limites ; un prompt ou un fichier robots.txt n’est pas une barrière de sécurité.
- Faire relire les CGV, mentions, politique de confidentialité, médiation de la consommation et promesses commerciales avant toute vente.

### Propriété intellectuelle et contenus

- Vérifier les licences des modèles, SoundFonts, boucles, médias préinstallés, dépendances et données d’entraînement.
- Distinguer les œuvres de l’utilisateur, les contenus importés, les propositions IA et les rendus générés ; préserver les originaux et la provenance.
- Vérifier les droits d’utilisation et de diffusion des voix, images, textes, musiques et éléments fournis par des tiers.
- Ne pas promettre qu’un NDA, un prompt caché ou un dépôt de code garantit à lui seul une protection juridique complète.

## 4. Jalons à fermer avant ouverture publique

1. Confirmer le domaine public exact et les contenus à indexer.
2. Vérifier /robots.txt en production et préparer le sitemap canonique.
3. Écrire une politique de confidentialité cohérente avec le mode navigateur et les transferts cloud possibles.
4. Réviser les mentions légales et CGV, notamment le médiateur et les obligations de vente.
5. Cartographier les traitements, fournisseurs, sous-traitants, rétentions, transferts et droits des personnes.
6. Faire le dépistage AIPD et une revue de classification règlement IA selon les usages réellement retenus.
7. Vérifier les contrôles techniques et documenter les limites ; obtenir une revue juridique/DPO avant toute affirmation « conforme partout ».

## Sources officielles à revalider au lancement

- [RGPD — Règlement (UE) 2016/679, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra)
- [CNIL — recommandations sur le RGPD au développement des systèmes d’IA](https://www.cnil.fr/fr/developpement-des-systemes-dia-les-recommandations-de-la-cnil-pour-respecter-le-rgpd)
- [CNIL — outil d’analyse d’impact (AIPD)](https://www.cnil.fr/fr/definition/analyse-dimpact-aipd)
- [CNIL — identifier son rôle dans un traitement](https://www.cnil.fr/fr/rgpd-comment-bien-identifier-son-role)
- [Règlement européen sur l’intelligence artificielle — Règlement (UE) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- [IETF — RFC 9309, Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)
- [OpenAI — bots et robots d’exploration](https://developers.openai.com/api/docs/bots/)
- [Google — robots d’exploration et jeton Google-Extended](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers)

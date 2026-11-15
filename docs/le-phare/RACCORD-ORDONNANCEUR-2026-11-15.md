# Raccord local à l’ordonnanceur — première tranche synthétique

## Source de référence retrouvée

Le noyau existant est `scripts/phare-pipeline-local/ordonnanceur.py` dans la copie de travail inspectée. Sa version de 145 lignes est épinglée par SHA-256 :

`70ee094adaa5a32701741ee71842cb9c391609da3b4b3b485076457db418aaa6`

Le pipeline fixe voisin `pipeline_fixtures.py` a pour empreinte :

`7376645bdd1fda3b11ce5615449c55615812ed83f6340d79cc39c7c9f5c5a96b`

Ces sources ont été lues ; elles ne sont pas recopiées dans ce lot. Le prototype antérieur sans délai ne suffit pas. Le noyau récent expose `enregistrer(nom, coroutine)`, `soumettre(projet, nom, payload, lourd=False, delai_secondes=None)`, `attendre()`, `liste()`, `contraintes(id)`, `annuler(id)` et `signaler_interrompues(confirmer_arret=True)`. Il délègue les travaux à des handlers asynchrones enregistrés explicitement. Le délai reste coopératif.

## Raccord réellement exercé

`src/lib/phare-task-handoff.ts` recompile une recette avec les permissions et ressources courantes, puis applique `assertPlanExecutable`. Il convertit une seule étape `fixtures.verify`, `read_task`, coût nul et moteur déterministe qualifié en arguments compatibles avec `soumettre`. Aucun contenu original, chemin système ou instruction de commande ne provient de la recette.

`scripts/phare-task-handoff/bridge.py` reçoit cette soumission et un contexte local propriétaire/projet distinct. Il charge exclusivement les octets de l’ordonnanceur dont l’empreinte correspond, enregistre un handler fixe, appelle réellement `soumettre`, attend le travail, relit `liste()` puis contrôle le résultat contre les références et empreintes relues. Aucun second ordonnanceur ni exécuteur de commandes n’est ajouté.

La tranche accepte uniquement un dossier plat de petites fixtures déclarées synthétiques par `PHARE_HANDOFF_FIXTURES.json` : 32 fichiers au plus, 1 Mio chacun, 2 Mio déclarés au total. Les références sont reliées aux noms/tailles/empreintes dans ce manifeste détenu par l’application. Aucun fichier non déclaré n’est lu ; le contenu d’une source non sélectionnée n’est pas consulté. Les chemins traversants, liens et fichiers non réguliers détectés sont refusés. La déclaration synthétique ne détecte pas les données personnelles.

Les plans multiétapes, modèles locaux ou distants, téléchargements, réseau, paiements, suppression et écritures de projet sont refusés. Le résultat réel de cette tranche est un audit déterministe de références ; il ne produit ni atelier rédigé, ni contenu créatif, ni classification IA.

## Propriétaire, idempotence et état

Le registre SQLite est dédié au raccord, lié au propriétaire/projet et à la version du noyau. Un registre étranger existant est refusé avant ouverture modifiante. Un verrou exclusif et une clé unique persistante empêchent une seconde soumission coopérative du même travail ; la même clé avec un autre contenu est refusée. Une tâche réussie n’est réutilisée qu’après nouvelle vérification des sources et du résultat enregistré.

Une tentative incertaine n’est pas relancée et un verrou restant bloque le travail. Cette tranche ne fournit aucune reprise automatique, aucun effacement de verrou ni action de récupération. Les règles de récupération explicite du pipeline existant ne sont pas réutilisées aveuglément sur ce registre différent.

Les états relus sont `en_attente`, `en_cours`, `terminee`, `erreur`, `annulee`, `interrompue`. Un état `terminee` seul devient `needs_verification`. Seul le reçu du pont local de confiance, après ses contrôles physiques, permet la concordance `completed` dans `readVerifiedHandoff`. Cette vérification de reçu n’est ni une signature ni une authentification d’un fichier fourni par un utilisateur : aucune API ou interface ne doit accepter un reçu arbitraire comme preuve de réalisation.

Le contexte propriétaire fourni au pont est un prérequis détenu par l’application ; le pont n’authentifie pas une identité distante. Les contrôles de stabilité et chemins ne constituent pas une garantie absolue contre un acteur local hostile modifiant simultanément le disque. Le registre contient des métadonnées privées et doit rester local.

Les fixtures, le registre et le noyau doivent se trouver sur un disque local. Les préfixes UNC sont refusés, mais un lecteur monté ou synchronisé n’est pas identifié automatiquement. `networkUsed:false` décrit l’absence d’appel réseau explicite du pont et du handler ; ce champ ne prouve pas l’isolement réseau du système de fichiers ou du PC entier.

## Vérifier sans modifier le PC ni un service

Fournir une copie privée byte-identique de l’ordonnanceur sous `PHARE_SCHEDULER_REFERENCE`, hors du dépôt. L’intégration refuse toute autre empreinte. Le test TypeScript crée un dossier temporaire synthétique, prépare la recette, appelle le pont Python à chemin fixe et vérifie le résultat et la deuxième soumission dédupliquée :

```sh
PHARE_SCHEDULER_REFERENCE=/chemin/prive/ordonnanceur.py node --experimental-strip-types --test src/lib/phare-task-handoff.test.ts
PHARE_SCHEDULER_REFERENCE=/chemin/prive/ordonnanceur.py python3 -m unittest discover -s scripts/phare-task-handoff -p test_bridge.py -v
```

`PHARE_TEST_PYTHON` permet de préciser l’interpréteur du test TypeScript. Sans référence explicitement fournie, les tests d’intégration sont marqués ignorés ; cela ne constitue pas une validation du raccord. Aucun test ne lit de document personnel, ne démarre de service ou ne change l’installation Windows.

La première vérification de ce lot a été exécutée sous Linux cloud avec la copie byte-identique privée : six tests TypeScript, dont soumission/attente/relecture réelles et deuxième soumission dédupliquée, et neuf tests Python réussis, sans test ignoré. Cette preuve n’est pas un essai Windows de ce nouveau pont ; l’exécution Windows antérieure du pipeline voisin ne lui est pas attribuée. Le raccord n’est accessible par aucun bouton du produit.

## Ce qui reste à intégrer

Ce lot reste isolé : pas de bouton, transport applicatif, authentification native, corpus personnel ou modèle activé. Les paramètres JSON d’un pack n’accordent aucun droit. Pour élargir les capacités, réutiliser l’ordonnanceur et ajouter des handlers relus, leurs ressources et leurs preuves, un contrôle des dépendances et une politique persistante de récupération. Ne pas annoncer ces futures capacités comme disponibles à partir de l’audit synthétique.

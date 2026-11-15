# Contrôle français reproductible — 15 novembre 2026

## Statut réel

Ce lot prépare un banc exécutable. Aucun moteur réel n’a été appelé, entraîné, téléchargé ou démarré pour le produire. La démonstration contient des sorties fabriquées pour éprouver le scorer ; elle ne qualifie aucun modèle. Le contrôle ne modifie ni l’interface ni le poste utilisateur.

L’essai antérieur de douze réponses et quatre conditions n’avait pas établi de gain de l’adaptateur 45. Ses sorties ne sont ni reprises comme mesures de ce nouveau corpus ni transformées en validation. Le moteur PC n’écoute pas au dernier relevé communiqué et la mémoire libre observée était faible : cela reste un relevé daté, pas un état vérifié par ce lot. Un essai réel exige un inventaire actualisé et un moteur déjà installé et disponible.

## Réutilisation et périmètre

L’inventaire des scripts du dépôt n’a trouvé aucun évaluateur textuel français générique. Les bancs de `chat-traducteur/`, `look_and_find/` et `scripts/verify.mjs` mesurent d’autres objets : audio, vision et montage. Ils n’ont pas été recopiés. Ce banc suit les conventions de scripts Python standard-library et de résultats JSON ; aucune dépendance n’est ajoutée.

Deux leçons existantes ont guidé les contrôles :

- `second-brain/lecons/2026-09-04-un-corpus-fabrique-ne-contient-que-ce-quon-savait-demander.md` : des données synthétiques ne prouvent pas la qualité sur les usages réels.
- `second-brain/lecons/2026-09-05-un-outil-de-mesure-vieillit-quand-le-corpus-change-de-nature.md` : l’outil doit mesurer le même chemin que celui employé par le produit. Le présent appel direct à Ollama ne constitue pas encore une recette du chat du Phare.

## Corpus et critères

`scripts/phare-evaluation-fr/corpus.json` contient quinze exercices français synthétiques inédits, trois par catégorie : compréhension, citation de source fournie, pluriels et consignes, abstention, résistance à des instructions injectées dans une source. Tous les personnages, lieux implicites et documents sont fictifs. Les attendus sont publics et précis : le corpus sert au développement et aux régressions, sans prétention de test aveugle ou de représentativité.

Le moteur reçoit la question et les sources, jamais la clé `expected`. Il doit rendre un objet JSON avec `answer`, `abstain` et `citations`. Chaque citation contient `source_id` et `quote`. Le scorer contrôle la réponse attendue, l’abstention, les citations demandées et leur présence effective dans les sources.

La même normalisation s’applique à tous les textes comparés : Unicode NFC, apostrophes typographiques normalisées et espaces repliées. Accents, casse, ponctuation et terminaisons sont conservés : `chevals` ne devient pas `chevaux`, `a` ne devient pas `à`. La comparaison exacte est volontaire pour ces exercices bornés ; elle n’est pas un juge universel de rédaction ou de poésie.

Les états restent distincts :

| État | Signification |
|---|---|
| `pass` | Tous les critères automatiques du cas sont satisfaits |
| `fail` | Sortie structurée, au moins un critère non satisfait |
| `missing` | Aucune sortie pour le cas |
| `execution_error` | Le moteur ou son transport a renvoyé une erreur |
| `invalid_response` | Réponse absente, non JSON ou hors schéma |
| `invalid_record` | Enregistrement de mesure invalide, par exemple durée négative |

La synthèse conserve le dénominateur de quinze cas, y compris les absences et erreurs. Les identifiants inconnus ne gonflent pas le score ; les identifiants dupliqués, les clés JSON dupliquées et le mauvais hash de corpus sont refusés. La lecture des fichiers est bornée avant décodage. Une durée inconnue reste `null`, jamais zéro. `production_model_ready` reste toujours `false` : même 15/15 à ce contrôle public ne suffit pas à qualifier un moteur pour tous les usages du Phare.

## Utilisation hors réseau

Depuis la racine du dépôt :

```bash
python3 scripts/phare-evaluation-fr/evaluation_fr.py validate-corpus
python3 -m unittest discover -s scripts/phare-evaluation-fr -p 'test_*.py'
python3 scripts/phare-evaluation-fr/evaluation_fr.py demo --out scripts/phare-evaluation-fr/demo-fixtures
```

La démonstration est volontairement mixte : trois réussites fabriquées, une fausse citation, une erreur d’exécution fictive, une réponse illisible, un enregistrement invalide et huit cas manquants. Elle doit annoncer `fixture_demo`, 3/15 et aucune qualification de moteur. Aucun temps de génération n’est inventé.

Pour re-noter un fichier déjà présent, sans appel moteur :

```bash
python3 scripts/phare-evaluation-fr/evaluation_fr.py score --responses scripts/phare-evaluation-fr/demo-fixtures/responses.json --out scripts/phare-evaluation-fr/demo-fixtures-rescore
```

Chaque dossier de résultat contient `responses.json`, `report.json` et `report.md`. Un dossier existant non vide est refusé avant toute inférence : choisir un nouveau nom pour chaque essai et conserver l’historique. Chaque écriture refuse aussi d’écraser un fichier existant. Les répertoires de démonstration fournis dans le dépôt sont donc à consulter ; pour rejouer les commandes, choisir un nouveau répertoire vide, par exemple `demo-fixtures-essai-2`.

L’exécution sans argument affiche seulement l’aide. Un code de sortie zéro veut dire que le calcul du rapport a réussi ; il ne veut pas dire que le moteur est qualifié.

## Adaptateur réel préparé, non exécuté

Protocole repris de la documentation officielle Ollama consultée le 15 novembre 2026 : `POST /api/generate`, `stream=false`, `format=json`. Le banc demande `keep_alive=0` pour ne pas maintenir le modèle chargé après la requête. Les paramètres sont fixes et enregistrés : température 0, seed 42, contexte 2048, maximum 384 tokens de sortie. Cela améliore la comparabilité, sans garantir une identité bit à bit entre versions et matériels.

Source primaire : <https://docs.ollama.com/api/generate>.

L’appel réel exige une sous-commande dédiée, une adresse IP numérique de boucle locale avec port, deux options explicites et les métadonnées du modèle/runtime/matériel. Les domaines et adresses LAN sont refusés, de même que les identifiants URL, chemins, redirections et noms de modèles contenant un marqueur cloud. Aucun proxy d’environnement n’est utilisé. Le banc ne lance ni `/api/pull`, ni installation, ni service, ni entraînement. Dès la première erreur de transport ou de protocole, il arrête la série : pas de nouvelle requête ni de répétition après un timeout pouvant laisser un calcul en cours. Les cas restants sont affichés comme manquants. Un nom de modèle rapporté différent du nom demandé est une erreur, pas une réussite attribuée au modèle demandé ; fournir un identifiant explicite incluant son tag pour éviter toute ambiguïté d’alias.

Exemple de commande à exécuter seulement quand le moteur est prêt et son usage local autorisé ; remplacer tous les identifiants et le fichier matériel par un relevé réel :

```bash
python3 scripts/phare-evaluation-fr/evaluation_fr.py run-ollama \
  --endpoint http://127.0.0.1:11434 --allow-loopback --local-model-only \
  --model MODELE_LOCAL_DEJA_INSTALLE --model-revision REVISION_OU_DIGEST_EXACT \
  --runtime-version VERSION_OLLAMA --hardware-json RELEVE_MATERIEL.json \
  --label COMPARAISON_BASE_LOCALE --out RESULTATS_PRIVES
```

`--local-model-only` atteste que l’opérateur a vérifié les poids et le runtime locaux. Une requête vers une adresse locale ne prouve pas à elle seule qu’un serveur ne relaie jamais vers un service distant. Le banc ne contrôle pas les connexions sortantes du serveur ; il ne faut donc pas utiliser un alias cloud ni présenter cette attestation comme une preuve réseau. Il ne contient pas de clés fournisseur et ne lit pas les fichiers de configuration personnels.

Métadonnées conservées : hash canonique du corpus, hash du prompt système, version de normalisation, modèle demandé et rapporté, révision déclarée, version runtime déclarée, matériel déclaré avec valeurs inconnues explicites, paramètres, début/fin UTC, durée monotone par cas et compteurs Ollama disponibles. Le contenu de réflexion du modèle n’est pas enregistré. Les sorties réelles restent dans un dossier privé choisi par l’opérateur et ne doivent pas être publiées avec des données ou chemins personnels.

## Comparer base et adaptateur

Conserver exactement le même corpus, prompt système, normalisation, paramètres et protocole. Relever les versions et le matériel pour chaque condition. Garder les erreurs et les cas manquants. Ne pas changer les attendus après avoir lu la réponse d’un candidat. Présenter les résultats par cas et catégorie avant toute synthèse ; un gain global peut masquer une régression sur citations ou abstention.

Ce banc public doit être complété par des cas réels consentis, une épreuve tenue à l’écart de l’entraînement et une recette du parcours effectivement servi par Le Phare. Le passage par le chat, la persistance des projets et les droits d’accès ne sont pas couverts ici. Aucune supériorité de modèle ou d’adaptateur n’est conclue par ce lot.

## Vérifications de ce lot

Vingt-deux tests standard-library réussis : normalisation, citations inventées, pluriels, injection, cas manquants, erreurs, doublons JSON et identifiants, hash de corpus, durées inconnues ou invalides, métadonnées, adresses autorisées, absence d’appel réseau par défaut, opt-in obligatoire, marqueur cloud refusé, redirections refusées, proxy désactivé, contrat HTTP avec transport simulé, arrêt après un timeout, modèle retourné incohérent et conservation des résultats existants avant inférence.

La démonstration hors réseau a été exécutée et son rapport rouvert : `fixture_demo`, 3/15, huit cas manquants et `production_model_ready=false`. Le recalcul du même fichier a produit un rapport identique. Les tests du transport utilisent un objet simulé, ne contactent aucun serveur et ne sont pas publiés comme résultats réels d’un modèle. Aucun test navigateur, aucune inférence réelle et aucun entraînement dans ce lot.

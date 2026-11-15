# Parcours portables et choix de moteur

Ce lot ajoute une préparation de parcours réutilisables au contrat d'orchestration existant. Il n'ajoute ni interface, ni moteur d'exécution, ni stockage ou service réseau.

## Frontières

- `src/lib/phare-recipes.ts` importe et exporte une méthode déclarative, lie les seules références choisies par l'application et prépare un plan.
- `src/lib/phare-engine-registry.ts` sélectionne un moteur selon capacité, langue, qualification et ressources connues. La taille du modèle ne constitue pas un score de qualité.
- `src/lib/phare-orchestration.ts` reste propriétaire des contrats de permissions, tâches, plans et transitions.
- L'ordonnanceur existant reste responsable de l'exécution, de la persistance, des reprises et des résultats. Le résultat de compilation est toujours `prepared_only`.

L'import n'active rien et n'accorde aucun droit. Les paramètres ne contiennent que des références de sources, sans document, conversation ou profil intégrés dans le paquet. Le texte libre de l'auteur et des instructions exige une relecture avant partage : ce format ne garantit pas l'anonymisation ni l'absence d'instructions malveillantes.

## Raccord à l'application

1. Fournir le catalogue de capacités autorisées de la version courante ; ne pas utiliser l'import pour élargir ce catalogue.
2. Qualifier les moteurs et leurs besoins pour la configuration, le contexte et la tâche réellement testés. Aucune installation ou disponibilité n'est déduite de la RAM.
3. Réutiliser la mémoire et `assistantContext` existants pour choisir la matière et les références, sans créer une seconde mémoire.
4. Préparer le parcours avec `preflightRecipe`. Une étape sans moteur compatible bloque le parcours complet. Le mode essai demeure explicitement non qualifié.
5. Compiler avec `compileRecipePlan` et les définitions d'agents, permissions et assignations détenues par l'application. Les références privées restent dans cette préparation et ne sont pas exportées dans la recette.
6. Avant exécution, vérifier à nouveau ressources disponibles, périmètres, autorisations et coût avec le contrat existant. Transmettre au worker existant, sans nouvelle boucle d'exécution concurrente.
7. Conserver la version du parcours et la provenance du moteur dans le résultat. Ne pas réécrire les provenances historiques.

Les modules ne modifient pas les formats Workspace ou sauvegardes existants. Ils ne fournissent pas la génération locale multimédia, la synchronisation ni une qualification du produit complet.

## Vérification ciblée

```sh
node --experimental-strip-types --test src/lib/phare-engine-registry.test.ts src/lib/phare-recipes.test.ts
python -m unittest discover -s scripts -p test_phare_backup_source.py
```

Les moteurs utilisés par les tests sont des manifestes fictifs. Le même paquet peut préparer un plan avec deux adaptateurs différents ; cela ne constitue pas une comparaison de deux modèles réels. Les tests couvrent les dépendances, la capacité manquante, la RAM/VRAM inconnue, le mode local, les champs exécutables, les sources hors périmètre et les droits de compilation.

## Sauvegarde des sources

`scripts/phare-backup-source.py` propose des archives ZIP datées avec manifeste, vérification SHA-256 et restauration dans un dossier neuf. Les versions antérieures sont conservées. Les identifiants, bases et builds sont exclus par noms ; les secrets présents sous un nom ordinaire ne sont pas détectés. L'archive est en clair et doit rester privée.

Ce script sauvegarde les sources choisies, jamais automatiquement les projets ou conversations dans les navigateurs. Il ne fournit pas d'authentification/signature, de chiffrement, de service distant ou d'automatisation par défaut. Une copie stable par fichier ne constitue pas un instantané transactionnel de toute l'arborescence.

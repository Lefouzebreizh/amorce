# Raccorder le radar aux démos Artisan Express

`scripts/importer-radar.py` lit la base SQLite produite par `audit-radar` (PR #981) et appelle `scripts/preparer-prospects.mjs` (PR #984). Il n'importe ni le score des audits IA ni leurs messages commerciaux. Dépendances : Python 3 et Node 24 ; aucun paquet supplémentaire.

```sh
python3 titan-builder/scripts/importer-radar.py \
  --db /chemin/prive/radar.sqlite3 \
  --catalogue /chemin/prive/catalogue-artisans.json \
  --sortie /chemin/prive/nouveau-lot
```

Le catalogue suit le format de `PREPARER-PROSPECTS.md`, avec un champ `radar_url` pour chaque prospect. Cette URL doit désigner exactement sa ligne dans `leads`. Une URL ne peut désigner deux profils différents ; pour un annuaire multi-entreprises, utiliser des fiches individuelles. Les différences de casse ou d'encodage dans l'URL ne sont pas rapprochées automatiquement.

Le raccordement produit :

- `qualification.json` : nouvelles lignes à documenter, profils absents du radar et exclusions ;
- `entree-titan.json` : entrée traçable du générateur ;
- `demos/file.json` et dossiers nominatifs : au maximum cinq messages, avec démos lorsque les données requises sont présentes.

Les résultats de recherche sans profil vérifié restent à documenter. Un titre de moteur de recherche n'est pas transformé en raison sociale ; aucun téléphone, prestation ou besoin commercial n'est déduit automatiquement. Une présence en base ne démontre ni une activité actuelle ni un intérêt d'achat.

La base est ouverte en lecture seule, dans une transaction cohérente. Les suppressions par domaine, URL ou courriel (y compris celui du catalogue enrichi) et les statuts `suppressed`, `rejected`, `contacted`, `replied`, `paid`, `lost` bloquent la préparation. Les exclusions déclarées dans le catalogue restent appliquées par TITAN. Après une réponse ou opposition, mettre à jour l'historique avant un nouveau lot. Une opposition reçue après cette lecture impose de revérifier avant l'envoi manuel.

Le même lot de sortie ne peut pas être écrasé. Le raccordement ne marque personne comme approuvé ou contacté, ne publie aucune démo et n'envoie aucun message. Conserver catalogue, base et sorties hors Git.

## Découverte en amont

L'API Brave et la commande `add` du radar existant peuvent alimenter sa base. Pour Artisan Express, utiliser une base et une configuration distinctes, des requêtes de métiers et villes, puis la découverte seule (`brave_discover`) : le parcours `run` applique encore le score des audits IA. Ce raccordement n'appelle pas Brave, ne crée aucune clé ni souscription et ne planifie aucune recherche. Le rafraîchissement distant reste à installer dans un environnement autorisé avec sa source de recherche disponible.

## Vérification du 13 septembre 2026

Quatre tests couvrent le résultat sans profil, le maintien en validation, une opposition sur le courriel enrichi, un statut de réponse et le refus d'attribution ambiguë. Le parcours réel a été exécuté avec une base locale créée par `radar.connect` et alimentée par `radar.upsert_lead`, sur les cinq fiches déjà documentées : quatre démos et un dossier incomplet. Il s'agit d'une preuve du raccordement, pas d'une nouvelle collecte ni d'un déploiement sur le VPS. Aucun rendu visuel supplémentaire n'est validé par ces tests.

```sh
python3 titan-builder/scripts/test_importer_radar.py
node --test titan-builder/scripts/preparer-prospects.test.mjs
```

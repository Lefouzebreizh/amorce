# Préparer une petite file Artisan Express

Le script `scripts/preparer-prospects.mjs` transforme une présélection documentée en dossiers locaux : démo HTML autonome, message personnalisé et `file.json`. Il appelle le générateur existant `generer.mjs`, sans reproduire son rendu. Aucun envoi, publication, accès réseau ou paiement.

Depuis `titan-builder`, avec Node 24 :

```sh
node scripts/preparer-prospects.mjs /chemin/prive/entree.json /chemin/prive/nouveau-lot
node --test scripts/preparer-prospects.test.mjs
```

Le dossier de sortie doit être neuf, pour conserver les corrections humaines. Les données réelles et sorties restent hors Git. Exemple de schéma (entreprise fictive, à remplacer par des faits sourcés) :

```json
{
  "signature": "Erwann — Artisan Express",
  "limit": 5,
  "exclusions": ["Nom déjà contacté", {"email": "opposition@example.com"}],
  "prospects": [{
    "id": "atelier-exemple",
    "name": "Atelier exemple",
    "city": "Rennes",
    "observation": "Votre fiche publique présente la menuiserie.",
    "sources": ["https://example.com/fiche"],
    "phone": "",
    "phone_source": "",
    "services": "Menuiserie",
    "metier": "menuisier",
    "sent": false,
    "opposition": false
  }]
}
```

L'export JSON du dossier « Artisan-Express-prospects.html » fournit les cinq premières fiches : le placer sous `prospects`, ajouter `signature` et la liste `exclusions`, puis renseigner les prestations et la source du téléphone. Les couples `[libellé, URL]` sont acceptés dans `sources`. Une URL est une référence déclarée, pas une vérification de son contenu par ce script.

Les exclusions rapprochent nom, identifiant, téléphone ou courriel normalisés. Une opposition, un envoi antérieur ou `inactive: true` bloque aussi les doublons présents dans le lot. Les téléphones français sont rapprochés entre les formes `0`, `+33`, `0033` et `+33 (0)`. Les exclusions se propagent aussi aux alias liés par téléphone, courriel, nom ou identifiant, quel que soit leur ordre dans le lot. Toute source manquante empêche la sélection. Téléphone public sourcé et prestations sont requis pour générer une démo ; sinon le message propose de préparer un aperçu, sans prétendre qu'il existe déjà.

Tous les résultats restent `a_valider` ou `a_completer`, jamais approuvés automatiquement. Le plafond est cinq dossiers par exécution, pas une limite quotidienne globale. Réinjecter l'historique des envois et oppositions dans chaque entrée ; le script ne consulte pas la messagerie. Vérifier activité, contact actuel, canal, opposition et démo avant tout envoi manuel.

La PR #981 concerne `audit-radar`, destiné à la reprise d'applications IA. Son score technique n'est pas transposé aux artisans. Ce lot automatise la préparation d'une sélection fournie ; la découverte continue et la connexion directe à sa base ne sont pas implémentées. Aucun service planifié n'est installé. Le fonctionnement du générateur est testé, sans nouvelle validation visuelle de ses modèles.

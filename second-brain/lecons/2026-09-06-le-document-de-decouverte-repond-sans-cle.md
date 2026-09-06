# Le document de découverte d'une API Google répond sans clé, et il tranche

*06/09/2026 — trouvé en cherchant la cause d'un 400 qu'aucun appareil ne pouvait
rapporter.*

## Ce qui a été mesuré

`https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta`
répond **200**, 374 Ko, **sans clé d'API**, depuis une session distante — là où
`ai.google.dev` et la documentation sont refusés par le mandataire. La révision
servie datait de la veille.

Il porte le schéma complet de l'API : pour chaque type, les champs acceptés,
leurs types, et les énumérations. Deux minutes ont suffi à établir que
`responseSchema`, `responseMimeType`, `temperature` et `inlineData` étaient tous
valides, et que le type `Schema` acceptait bien `description`, `properties`,
`items`, `required` et l'énumération `OBJECT` / `STRING` / `ARRAY`.

**C'est ce qui a débloqué le diagnostic.** Un 400 refusé à chaque essai, sur un
appareil qu'on ne pouvait pas faire parler, et aucune recherche web concluante —
les causes documentées de 400 sur Gemini sont nombreuses et contradictoires.
Le document de découverte a supprimé d'un coup toute une famille d'hypothèses :
le refus ne portait pas sur un **nom de champ**, donc il portait sur une
**valeur**. Restait une seule valeur que l'application fabriquait sans la
vérifier — la photo — et le défaut y était.

## Ce que ça vaut au-delà de Gemini

**Toutes les API Google publient ce document**, à la même adresse et sans
authentification :

```
https://<service>.googleapis.com/$discovery/rest?version=<version>
```

Quand un service refuse une requête sans dire pourquoi et que sa documentation
est hors d'atteinte, c'est la source à interroger avant de chercher sur le web :
elle est faite par le service lui-même, elle est datée, et elle répond sur les
champs plutôt que sur des symptômes rapportés par d'autres.

## La limite, et elle compte

Le document dit ce qui est **accepté comme forme**. Il ne dit rien des
**valeurs** : ni les bornes d'un `temperature`, ni les types MIME qu'un
`inlineData` tolère, ni ce qu'un modèle donné refuse en particulier. Il élimine
des hypothèses, il n'en confirme aucune.

C'est exactement ce qu'on lui demandait ici, et c'est pourquoi il a servi : le
diagnostic restait à faire, mais sur un champ de recherche réduit d'un ordre de
grandeur.

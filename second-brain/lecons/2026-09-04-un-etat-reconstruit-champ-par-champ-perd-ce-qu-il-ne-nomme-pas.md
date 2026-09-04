# Un état reconstruit champ par champ perd ce qu'il ne nomme pas — 04/09/2026

## Ce qui a été mesuré

`le-coffre/src/lib/coffre.ts` réécrit l'index entier du coffre à chaque
opération. Quatre des cinq fonctions qui le réécrivent le **reconstruisaient**
au lieu de l'étaler :

```ts
const nouvel_index: IndexCoffre = { objets: { ...index.objets, [nom]: objet } };
```

`IndexCoffre` porte trois champs — `objets`, `rendezVous`, `identite`. Cette
ligne n'en nomme qu'un. Les deux autres partaient à chaque écriture :

| geste | ce qui disparaissait |
| --- | --- |
| déposer un fichier | tous les rendez-vous, **et** l'identité |
| supprimer un fichier | tous les rendez-vous, **et** l'identité |
| ajouter un rendez-vous | l'identité |
| supprimer un rendez-vous | l'identité |

La cinquième, `enregistrerIdentite`, écrivait `{ ...index, identite }` et était
juste. C'est la seule qui avait besoin de conserver quelque chose d'écrit par
une autre — les quatre autres n'avaient jamais eu l'occasion de se tromper
seules.

L'enchaînement qui coûte le plus cher tient en deux gestes ordinaires : on
saisit son identité, puis on dépose un document. L'identité est perdue, donc
`deposerFichier` ne compose plus aucune lettre de résiliation — la
fonctionnalité disparaît sans qu'un seul message d'erreur ne sorte, et la
condition qui l'éteint (`index.identite` absent) est exactement celle qui est
écrite pour le cas légitime « l'utilisateur n'a pas renseigné son adresse ».

## Pourquoi rien ne le signalait

TypeScript est d'accord : `rendezVous` et `identite` sont **optionnels** dans
le type, donc un objet qui ne les porte pas est un `IndexCoffre` valide. Le
typage vérifiait la forme, et la perte est une question de contenu.

Les valeurs de retour, elles, étaient cohérentes avec ce qui avait été écrit :
la fonction rend le même index amputé qu'elle vient d'envoyer. Un test qui
comparerait le retour à ce qu'on attend d'une session en cours ne verrait rien
non plus.

Ce qui l'a trouvé est un test qui **relit ce qui a réellement été chiffré et
envoyé**, pas la valeur de retour :

```ts
const upsert = factice.premier('upsert');
JSON.parse(await dechiffrerTexte(cle, bufFromB64(upsert[0].contenu)));
```

## Ce qu'on en retient

**Un état partagé se conserve par étalement, jamais par énumération.** Écrire
`{ ...index, objets }` coûte trois caractères de plus que `{ objets }` et ne
peut pas perdre un champ ajouté demain. La forme énumérée est correcte le jour
où on l'écrit et fausse au premier champ suivant — et elle est fausse en
silence, ce qui la rend pire qu'une erreur.

C'est la même famille que ce que `CLAUDE.md` dit des tables qui énumèrent —
projets, chemins, suites de tests : *ce qui énumère est faux le lendemain, et
faux en silence*. La leçon ici est qu'elle ne vaut pas que pour la
configuration : elle vaut pour n'importe quel objet qu'on reconstruit au lieu
de le copier.

**Et le corollaire pour les tests** : sur un module qui envoie de l'état
ailleurs — base, seau, API —, ce qui se vérifie est **ce qui part**, pas ce qui
est rendu. Les deux se ressemblent tant que le défaut est dans l'écriture,
c'est-à-dire précisément dans le cas qu'on cherche.

## Où c'est corrigé

Les quatre lignes dans `le-coffre/src/lib/coffre.ts`, et les tests qui les
tiennent dans `le-coffre/src/lib/__tests__/coffre.test.ts` — cinq cas nommés
« conserve les rendez-vous et l'identité » et « conservent l'identité, dont
dépendent les lettres à venir ».

# Normaliser un texte sans normaliser le motif qu'on y cherche

**11/09/2026, mesuré sur la couche 1 de `psy-ia/`** — la détection de crise
qui décide d'afficher, ou non, le numéro national de prévention du suicide.

Pour tolérer les fautes de frappe (« mourrrir »), la normalisation replie
toute suite de lettres identiques sur une seule : `/(.)\1+/g → '$1'`. Elle
fait donc aussi, sans le dire :

| écrit par la personne | ce que la détection voit |
| --- | --- |
| « je veux mourrrrir » | « je veux mourir » ✅ ce qu'on voulait |
| « ça ne s'arrangera jamais » | « ca ne s **arangera** jamais » ⚠ un seul `r` |

Le motif, lui, était écrit à la main en expression régulière avec les deux
`r` — `/\bca\s+(ne\s+)?s\s+arrangera\s+jamais\b/`. Il ne pouvait donc
**jamais** matcher. Un test rouge sur seize, sur une règle qui paraissait
saine, et sur exactement la famille de signaux qu'on ne peut pas se permettre
de rater.

## La règle générale

**Quand un texte est normalisé avant d'être comparé, le motif cherché doit
passer par la même fonction de normalisation.** Jamais être écrit à la main
dans la forme normalisée — une forme normalisée écrite à la main est un
doublon silencieux de la fonction, qui se désaccorde au premier changement de
celle-ci.

La parade tient en une fonction, et elle a un effet de bord précieux : les
motifs peuvent alors s'écrire en **français ordinaire**.

```ts
function compiler(phrases: string[]): Motif[] {
  return phrases.map((phrase) => ({
    phrase,
    regex: new RegExp(`\\b${normaliser(phrase).replace(/ /g, '\\s+')}\\b`),
  }));
}
```

Après normalisation il ne reste que lettres, chiffres et espaces : aucun
métacaractère ne survit, la construction est donc sûre sans échappement.

## Ce que ça débloque au-delà du défaut

Sur ce projet-là, la couche 4 exige qu'un **professionnel de santé mentale**
relise et enrichisse la liste. Une liste d'expressions régulières est
illisible pour lui ; une liste de phrases françaises se relit et se complète
sans savoir lire du code. Le correctif d'un défaut technique a donc réglé une
contrainte produit qu'on aurait payée plus tard, et plus cher.

## Le cousin, mesuré le même jour

Une regex d'accents écrite avec les **caractères combinants littéraux**
(`[U+0300-U+036F]` tapés tels quels) est invisible à la relecture et piège
l'outillage : un remplacement Python avec `'̀'` en chaîne non *raw*
remplace le caractère **par lui-même**, annonce « 1 occurrence remplacée », et
ne change rien. Écrire `/\p{M}/gu` à la place : lisible, standard, et aucun
caractère exotique dans la source.

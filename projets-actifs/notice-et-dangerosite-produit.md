# Notice, dangerosité et ingrédients d'un produit

> **Hypothèses posées** : extension de la fiche produit existante de Look & Find,
> pas d'application séparée. Source de données ouverte et gratuite plutôt que
> service payant — la question du repli photo reste ouverte en bas.

## Pitch

Sur la fiche produit déjà rendue par Look & Find, ajouter ce qu'on cherche
vraiment quand on hésite en rayon : la liste d'ingrédients, les allergènes, les
pictogrammes de danger et la notice. **Lu au code-barres, pas deviné.**

## Objectif mesurable

**Sur 20 produits courants pris au hasard dans un placard, rendre la liste
d'ingrédients exacte pour au moins 17**, et afficher « non trouvé » pour les
trois autres — jamais une liste approximative.

## Score de faisabilité — 8/10

| Critère | Note | Justification |
| --- | --- | --- |
| Temps / Effort | 8/10 | Le parcours de scan existe. Ajouter la lecture d'un code-barres et un appel à une base ouverte : un week-end pour une première version. |
| Complexité technique | 8/10 | Lecture de code-barres : paquet Flutter mûr et documenté. Base ouverte : API publique, sans clé. Rien à inventer. |
| Coût / Rentabilité | 8/10 | OpenFoodFacts et OpenBeautyFacts sont gratuits et sans quota commercial. Aucun appel de modèle sur ce chemin — donc moins cher que le scan actuel. |
| Alignement | 9/10 | C'est un champ de plus sur une fiche produit déjà affichée. Voir `/identification-produit` pour la frontière invite / DTO, qui ne se désynchronise jamais. |

**Verdict :** aucun critère ne coince. La décision qui fait toute la valeur est
en dessous, et elle est contre-intuitive.

## La décision qui décide de tout : le code-barres, pas la photo

L'intuition est de photographier la liste d'ingrédients et de la faire lire. Ne
pas le faire :

- caractères de 1 mm, emballage courbe, reflets, plis — c'est le pire cas de
  lecture optique qui soit ;
- un modèle qui hésite **invente une ligne plausible** plutôt que d'avouer ;
- et surtout : **un allergène manqué n'est pas un défaut cosmétique.** Quelqu'un
  d'allergique à l'arachide a le droit d'exiger mieux qu'une estimation.

Le code-barres, lui, donne la référence exacte du produit. La base rend la liste
telle que le fabricant l'a déclarée. C'est **plus fiable et plus simple** — le
cas rare où les deux vont ensemble.

La photo reste le repli quand le code-barres manque ou que le produit est
absent de la base. Elle est alors annoncée comme telle, jamais présentée avec la
même assurance.

## Plan d'action (MVP)

| Étape | Livrable | Délai |
| --- | --- | --- |
| **1 — Le chemin le plus court** | Lire un code-barres, interroger OpenFoodFacts, afficher la liste brute. Sans mise en forme, sans dangerosité. Sur cinq produits réels. | **< 48 h** |
| **2 — Ce qu'on cherche vraiment** | Allergènes mis en évidence, pictogrammes de danger, Nutri-Score s'il existe, et un « non trouvé » franc. Extension à OpenBeautyFacts pour les cosmétiques. | 1 à 2 semaines |
| **3 — Le repli photo** | Lecture de l'étiquette quand le code-barres échoue, **signalée comme incertaine** et jamais fusionnée en silence avec les données de la base. | après |

## Outils nécessaires

- Un paquet Flutter de lecture de code-barres — à ajouter, gratuit.
- OpenFoodFacts / OpenBeautyFacts — gratuits, sans clé.
- Gemini : **déjà branché**, et volontairement hors du chemin principal.

## Ce qui ne se fait pas depuis une session distante

`world.openfoodfacts.org` est **refusé par le mandataire** (403 au tunnel
CONNECT), vérifié le 31 août 2026. Conséquence : ni l'appel, ni le relevé de la
forme réelle des réponses ne peuvent se faire ici.

Écrire la couche de lecture de mémoire serait pire que ne rien écrire : on
inventerait des noms de champs plausibles, et le défaut n'apparaîtrait qu'au
premier essai sur un vrai téléphone. C'est précisément ce que
`/api-tierce-verifiee` interdit.

**Ce qui débloque, et coûte deux minutes :** ouvrir depuis un navigateur non
filtré, coller la réponse dans la session, et l'enregistrer comme fixture.

```
https://world.openfoodfacts.org/api/v2/product/3017620422003.json
```

Avec deux ou trois réponses réelles — un produit riche, un produit pauvre, un
code inconnu — toute la couche de lecture s'écrit et se teste ici, hors réseau.
Il ne restera d'invérifié que l'appel lui-même, et c'est la seule part que le
téléphone tranche.

## Ce qui la ferait tomber

1. **Une donnée fausse présentée comme sûre.** C'est le seul risque grave. La
   parade est d'afficher toujours la **source** et la date : « déclaré par le
   fabricant, OpenFoodFacts, mis à jour en 2025 ». Une information sourcée qu'on
   peut vérifier vaut mieux qu'une information juste qu'on doit croire.
2. **La couverture de la base.** Excellente en alimentaire français, plus mince
   en cosmétique, faible en droguerie. « Non trouvé » doit être un résultat
   normal et lisible, pas un échec.
3. **Le mot « dangerosité ».** Juger un produit dangereux engage. Se contenter
   de **restituer** ce qui est déclaré — pictogrammes réglementaires,
   allergènes, mentions officielles — et laisser la personne juger.

## Questions ouvertes

1. **Alimentaire d'abord, ou cosmétique ?** La base alimentaire est bien plus
   complète ; la demande est souvent plus forte côté cosmétique.
2. **Que fait-on d'un produit absent de la base ?** Proposer de l'y ajouter
   transforme l'utilisateur en contributeur — et c'est ce qui fait vivre ces
   bases.

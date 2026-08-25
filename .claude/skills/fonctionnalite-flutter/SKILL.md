---
name: fonctionnalite-flutter
description: Recette pour ajouter ou modifier une fonctionnalité de l'application Flutter Look & Find — où placer chaque fichier selon la Clean Architecture du dépôt, quels tests écrire, et les pièges de Riverpod 3 et des tests de widget qui ont déjà coûté un débogage chacun. À utiliser dès qu'on touche à look_and_find/lib/.
---

# Ajouter une fonctionnalité à Look & Find

Lire d'abord `look_and_find/CLAUDE.md` : les invariants y sont, et cette
recette ne les répète pas. Ce document dit **où poser les fichiers** et **dans
quel ordre travailler**.

## Où va quoi

Une fonctionnalité = `data/`, `domain/`, `presentation/`, sous
`look_and_find/lib/features/<nom>/`.

| Ce que tu ajoutes | Où |
| --- | --- |
| Une notion métier (entité, valeur) | `<feature>/domain/entities/` |
| Une règle de décision | `<feature>/domain/usecases/` |
| Un contrat vers l'extérieur | `<feature>/domain/repositories/` |
| Sa mise en œuvre (réseau, Hive) | `<feature>/data/repositories/` |
| Une lecture de JSON | `<feature>/data/models/` (DTO) |
| Un provider Riverpod | `<feature>/presentation/providers/` |
| Un écran, un widget | `<feature>/presentation/{pages,widgets}/` |

**La direction des dépendances ne se discute pas** : `product_detail` est
propriétaire de la notion de produit et n'importe personne. Si ta nouvelle
notion est utilisée par deux fonctionnalités, elle va dans le `domain` de celle
qui la produit — pas dans `core/`, dont le contenu est figé à
`constants/ network/ theme/ utils/`.

## L'ordre qui évite de revenir en arrière

1. **L'entité et la règle d'abord**, dans `domain/`, sans Flutter ni Dio. Elles
   se testent immédiatement.
2. **Le test de la règle**, avant l'interface. C'est là que se trouvent les
   décisions ; l'écran ne fait que les montrer.
3. **La persistance** si besoin : ajouter le champ au DTO **dans les deux
   sens**, et écrire le test de relecture d'un enregistrement produit par la
   version précédente — un favori enregistré hier doit se relire aujourd'hui.
4. **Le provider**, puis l'écran.
5. **Le test d'interface** sur ce que la fonctionnalité promet, pas sur des
   pixels.

## Les quatre pièges qui coûtent une heure

- **`ref` après un `await`.** Le provider peut avoir été libéré. Convention du
  dépôt : tout ce qui vient de `ref` est lu **avant le premier `await`**.
  Modèles : `ScanController.identify`, `ScanJournal.record`.
- **`ref` dans un cycle de vie.** Un `ref.read` dans `ref.onDispose` lève.
  Capturer la dépendance pendant la construction.
- **Écriture Hive dans un test de widget.** L'horloge y est simulée : une
  écriture attendue hors de `tester.runAsync` ne se termine **jamais**, et le
  test se fige plusieurs minutes sans message avant « did not complete ».
- **`Material` avec `shape` **et** `borderRadius`.** L'analyse statique laisse
  passer, l'application plante au premier rendu. Pour un liseré conditionnel,
  n'utiliser que `shape`, avec `BorderSide.none` par défaut.

## Interface

- Couleurs : jetons de `AppColors`, jamais d'hexadécimal en dur. **Deux
  accents, deux rôles** — `action` pour ce qu'il y a à faire, `gain` pour
  l'argent économisé, et rien d'autre.
- Surfaces empilées (`ink` < `slab` < `raised`) plutôt que contours. Une
  bordure désigne : la meilleure offre, l'objet en alerte. Partout ailleurs,
  elle brouille.
- Cible tactile minimale : `AppTheme.minTouchTarget` (48 dp).
- Tout texte affiché passe par `AppStrings`, en français.

## Terminer

`/verifier`, puis relire son propre diff contre `look_and_find/CLAUDE.md` — ou
lancer l'agent `revue-invariants`, qui fait exactement ça. Committer les
`.g.dart` régénérés avec le reste.

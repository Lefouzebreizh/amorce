# Audit de sécurité — TITAN Builder

**Date** : 02/09/2026 · **Périmètre** : `titan-builder/` (2 262 lignes)
**Posture** : lecture seule. Aucun fichier de code modifié.

**Aucun constat.** Le rapport en portait un ; il était faux, et sa correction
est gardée plus bas plutôt qu'effacée — c'est elle qui a le plus à apprendre.
Le point le plus sensible du projet — le prix — a été vérifié et il tient.

## ✅ La promesse du prix est vraie, vérifiée

`CLAUDE.md` affirme que « le prix est recalculé côté serveur, jamais lu depuis
le navigateur ». C'est exact :

```ts
// src/lib/courriel.ts:37 et :76, src/lib/dossier.ts:49
prixTotal(commande.options)
```

`prixTotal()` est appelé **côté serveur**, à partir des options retenues, dans
les deux sorties — le courriel et le dossier écrit. Aucun total envoyé par le
client n'est lu. `PRIX_BASE = 300` vit dans `src/lib/commande.ts:102`, et la
route d'API importe la validation du même module.

Un client qui trafiquerait un total dans sa requête n'obtiendrait donc rien : la
valeur est recalculée des deux côtés de la sortie.

## ✅ Le nom de fichier est déjà sûr — un constat de ce rapport était faux

**Corrigé le 02/09/2026.** La première version de ce rapport signalait que
`nomSur()` laissait passer `..`. **C'était faux**, et la façon dont l'erreur est
née mérite d'être écrite, parce qu'elle est exactement le défaut que ce dépôt
traque.

La fonction fait **deux** choses (`src/lib/dossier.ts:24-27`) :

```ts
const base = path.basename(brut).replace(/[^\w.\- ]+/g, '_').slice(-80);
return base === '' || base === '.' || base === '..'
  ? `photo-${rang}.bin`
  : `${String(rang).padStart(2, '0')}-${base}`;
```

L'audit n'avait recopié que la **première ligne** dans son banc d'essai, puis
mesuré sa propre réécriture au lieu du vrai code. La seconde ligne écarte
précisément `.` et `..`, et préfixe tout le reste par son rang.

Éprouvé sur la fonction réelle, cette fois :

| nom reçu | résultat | chemin joint |
| --- | --- | --- |
| `photo.jpg` | `01-photo.jpg` | `/dossier/cmd/01-photo.jpg` |
| `../../../etc/passwd` | `01-passwd` | `/dossier/cmd/01-passwd` |
| `..` | `photo-1.bin` | `/dossier/cmd/photo-1.bin` |
| `....//..` | `photo-1.bin` | `/dossier/cmd/photo-1.bin` |
| *(vide)* | `photo-1.bin` | `/dossier/cmd/photo-1.bin` |

**Aucune sortie du dossier n'est possible.** Rien à corriger.

La leçon, elle, vaut au-delà de ce projet : *une mesure disait rouge et le
fichier était juste* — parce que ce qui avait été mesuré n'était pas ce qui
tourne. Le §8 le dit dans l'autre sens, et c'est le même défaut.

## Non couvert

L'envoi de courriel et ses en-têtes · la route en conditions réelles · les
dépendances face à une base de vulnérabilités.

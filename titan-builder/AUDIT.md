# Audit de sécurité — TITAN Builder

**Date** : 02/09/2026 · **Périmètre** : `titan-builder/` (2 262 lignes)
**Posture** : lecture seule. Aucun fichier de code modifié.

Un seul constat, mineur. Le point le plus sensible du projet — le prix — a été
vérifié et il tient.

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

## 🟡 MINEUR — le nettoyeur de nom de fichier laisse passer `..`

**Où** — `src/lib/dossier.ts:24-25`.

```ts
const base = path.basename(brut).replace(/[^\w.\- ]+/g, '_').slice(-80);
```

`path.basename` retire bien les dossiers, et le remplacement neutralise tout ce
qui n'est pas alphanumérique. **Mais le point est dans la classe autorisée**, et
`..` en ressort intact :

| nom reçu | après nettoyage | chemin joint |
| --- | --- | --- |
| `photo.jpg` | `photo.jpg` | `/dossier/cmd/photo.jpg` |
| `../../../etc/passwd` | `passwd` | `/dossier/cmd/passwd` ✓ |
| **`..`** | **`..`** | **`/dossier`** ⚠ |
| **`....//..`** | **`..`** | **`/dossier`** ⚠ |

**Pourquoi c'est mineur et pas plus** — la cible devient un **dossier**, et
`writeFile` sur un dossier échoue (`EISDIR`). Je n'ai donc pas d'écriture
arbitraire à montrer, et je ne prétends pas en avoir une. Le trou est dans le
nettoyeur, pas dans ses conséquences observées.

**Piste de correction** — Refuser explicitement `.` et `..` après nettoyage, ou
n'accepter qu'un nom construit par le serveur (le rang est déjà passé en
paramètre) en ne gardant du nom d'origine que l'extension.

## Non couvert

L'envoi de courriel et ses en-têtes · la route en conditions réelles · les
dépendances face à une base de vulnérabilités.

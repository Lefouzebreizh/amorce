# Les thèmes réels du dépôt — relevé et mesuré

Relevé le 02/09/2026, **depuis les fichiers**, jamais de mémoire. Complète le
§2 bis de `CLAUDE.md`, qui donne les règles ; ici ce sont les valeurs et les
six décisions qui restent à prendre.

Toutes les mesures sont des rapports de contraste WCAG. Le seuil de la maison
est **7:1** pour un accent, **4,5:1** pour un texte d'aide — pas 4,5 et 3, parce
que ces interfaces s'utilisent dehors, sur un téléphone, à une main (§2).

---

## 1. La bonne nouvelle : la structure est déjà unanime

Quatre projets sombres, **quatre vocabulaires différents pour les mêmes rôles** :

| Rôle | Amorce | Annuaria | TITAN Builder | IPTV |
| --- | --- | --- | --- | --- |
| fond de page | `ink` | `nuit` | `fond` | `fond` |
| plan 2 | `slab` | `panneau` | `fond-doux` | `surface` |
| plan 3 | `panel` | `relief` | `verre` | `surface-haute` |
| plan 4 | `raised` | — | — | — |
| bordure | `edge` | `bord` | `bord` | `bord` |
| texte | `mist` | `brume` | *(absent)* | `texte` |
| texte d'aide | `muted` | `sourdine` | `sourdine` | `doux` |
| accent | `accent` | `teinte-1` / `teinte-2` | `neon` | `accent` |

**Personne n'a inventé une autre façon de faire.** Le désaccord n'est pas sur la
méthode, il est sur les mots. C'est ce qui rend la décision 1 ci-dessous facile.

Et l'écart entre plans voisins tient partout, ce qui confirme la valeur écrite
au §2 bis :

| | écarts mesurés | moyenne |
| --- | --- | --- |
| Amorce | 1,06 · 1,07 · 1,10 · 1,10 | **1,08** |
| Annuaria | 1,07 · 1,06 · 1,22 | 1,12 |
| TITAN Builder | 1,04 · 1,05 · 1,27 | 1,12 |
| IPTV | 1,09 · 1,13 · 1,22 | 1,15 |

---

## 2. Les valeurs, projet par projet

### Sombres

| | fond | plans intermédiaires | bordure | texte | aide | accent |
| --- | --- | --- | --- | --- | --- | --- |
| **Amorce** | `#08060f` | `#110e1e` `#191529` `#221d35` | `#2a2440` | `#f2effc` | `#aaa4c6` | `#25e3c4` |
| **Annuaria** | `#07070f` | `#101021` `#16162c` | `#262647` | `#c9c9e6` | `#8a8ab0` | — |
| **TITAN Builder** | `#05050b` | `#0b0b16` `#12121f` | `#262640` | — | `#9a9ac0` | `#7c3aed` |
| **IPTV** | `#0b0d10` | `#14181d` `#1d232b` | `#2a323c` | `#e9eef4` | `#97a3b2` | `#4aa8ff` |

Amorce porte en plus : `accent-deep #0a7d6b`, `warn #ffb340`, `danger #ff5c8a`,
`select #9d7bff`, et quatre jetons de jauge (`gauge-low` → `gauge-peak`).

TITAN porte aussi `neon-clair #a78bfa`, `cyan #22d3ee`, `succes #34d399`.

### Clairs, et c'est assumé (§2 bis)

| | fond | texte | accent |
| --- | --- | --- | --- |
| **Artisan Express** | `#eef4fc` | `#101f2e` | `#004aad` (+ `chantier #c74e00`) |
| **agence** | `oklch(0.99 0.003 258)` | `oklch(0.21 0.02 265)` | `oklch(0.52 0.2 267)` |
| **look_and_find** | `#FFF3E2` | `#241505` | `#FF8A2B` |

`hypersensible-bienveillance` ne déclare aucun jeton de couleur dans ses
sources — son thème vit ailleurs, à vérifier avant d'affirmer quoi que ce soit
sur lui.

---

## 3. Ce qui ne tient pas, mesuré

| Projet | Ce qui est mesuré | Verdict |
| --- | --- | --- |
| **TITAN Builder** | accent `#7c3aed` sur son `bord` : **2,6:1** | **illisible** |
| **IPTV** | accent `#4aa8ff` sur son `bord` : **5,1:1** | sous le seuil de 7 |
| **Annuaria** | aide `#8a8ab0` sur son `bord` : **4,4:1** | sous 4,5, de peu |
| **Annuaria** | bouton affilié, texte blanc : **1,5 à 3,7:1** | **corrigé le 02/09** — dix des onze étaient sous 3:1 |

Les jetons `titan-*` d'Amorce ressemblent à un cinquième défaut ; ils n'en sont
pas un — voir D6.

Amorce est le seul dont tout tient : texte 17,8:1 sur le fond, 13,0:1 sur le
plan le plus haut, aide à 6,2:1, accent à 9,0:1.

---

## 4. Les six décisions qui restent, avec une recommandation chacune

Ce sont elles, la « question de couleur qui revient sans arrêt ». Chacune se
tranche une fois et ne revient plus.

### D1 — Un vocabulaire, ou quatre ?

**Recommandation : un seul, celui d'Amorce** (`ink` `slab` `panel` `raised`
`edge` · `mist` `muted` · `accent`). C'est le plus complet — cinq plans quand
les autres en ont quatre, et le seul à nommer `warn` et `danger`.

Ce que ça coûte : un renommage mécanique dans trois projets. Ce que ça rend :
une brique d'interface se déplace enfin d'un projet à l'autre.

### D2 — Un fond commun, ou une teinte par produit ?

**Recommandation : garder la teinte par produit.** Trois familles existent déjà
et chacune a sa raison — violet chez Amorce et Annuaria, violet plus froid chez
TITAN, bleu-gris chez IPTV parce qu'on y juge des flux vidéo. Ce qui se partage
est la **structure** et l'écart de 1,07, pas la valeur.

C'est déjà ce que dit le §2 bis ; cette ligne existe pour que la question cesse
de se reposer.

### D3 — L'accent de TITAN Builder

À 2,6:1, il ne se lit pas. Le projet porte déjà deux valeurs qui tiennent.

**Recommandation : `#22d3ee`** (8,1:1), déjà présent sous le nom `cyan`.
`#a78bfa` ne monte qu'à 5,4:1 et resterait sous le seuil.

### D4 — L'accent d'IPTV

À 5,1:1, il passe pour du texte mais pas pour le seuil que la maison s'impose.

**Recommandation : `#8ccaff`** (7,4:1), plutôt que changer de teinte —
l'identité bleue d'IPTV est juste pour un lecteur vidéo.

Mesuré sur la montée, parce que l'intuition se trompe ici : `#6fb8ff` ne donne
que 6,2:1 et `#7ec2ff` 6,8:1 — tous deux **sous le seuil**, alors qu'ils
paraissent déjà bien plus clairs que l'actuel. Il faut aller jusqu'à `#8ccaff`.

### D5 — Le bouton affilié d'Annuaria — **tranché et fait le 02/09/2026**

**La première version de cette décision partait d'un constat faux.** Elle disait
qu'Annuaria n'avait aucun accent, et proposait d'en inventer un. Le `grep`
portait sur `--color-accent` ; le projet nomme les siens `--teinte-1` et
`--teinte-2`, posés **par niche** depuis `niche.theme` et choisis dans une
palette de quinze paires (`nouvelle-niche.js`). Chaque site avait donc déjà sa
couleur, et le bouton affilié sa classe `.bouton-accent`.

Le vrai défaut était ailleurs, et il était pire : ce bouton portait
`color: #fff` sur des teintes saturées et **claires**.

| niche | texte blanc, pire des deux teintes |
| --- | --- |
| `education`, `btp` | **1,5:1** |
| `sante`, `comptabilite` | 1,9:1 |
| `ecomm`, `immobilier` | 2,1 – 2,3:1 |
| `rh`, `restauration`, `juridique` | 2,5 – 2,7:1 |
| `architecture` | 3,0:1 |
| `generaliste` | 3,7:1 |

**Dix des onze sous 3:1**, sur le seul élément qui rapporte de ces pages, lues
dehors sur un téléphone — la condition exacte du §2.

**Ce qui a été fait** : le texte du bouton passe à `var(--color-nuit)`. Les
teintes de chaque niche sont **conservées** — c'est le blanc posé dessus qui
était le défaut, pas la couleur. Les onze remontent alors entre **4,7 et
10,5:1**.

Une seule ne passait pas : `architecture`, dont la primaire `#6366f1` rendait
4,49:1, sous le seuil de 4,5 d'un cheveu. Elle est montée à `#6a6df3`, soit
4,87:1, même teinte.

### D6 — Les trois jetons `titan-*` dans Amorce

`titan-neon`, `titan-ember`, `titan-night` vivent dans le `globals.css`
d'Amorce, ce qui ressemble à une fuite d'un projet vers l'autre.

**Ce n'en est pas une, vérifié : 45 usages**, tous dans `src/app/montage-titan/`
— une page à sous-marque assumée, avec ses propres composants.

**Recommandation : ne rien changer**, et cette ligne existe pour que la prochaine
session qui les voit ne les prenne pas pour des restes à nettoyer. Le seul point
à surveiller : ces trois-là ne suivent pas le vocabulaire de D1, et c'est normal
— une sous-marque a le droit d'avoir ses propres noms tant qu'ils sont préfixés.

---

## 5. Ce qui n'a pas été mesuré

- **`hypersensible-bienveillance`** : aucun jeton trouvé dans ses sources. Son
  thème n'a donc pas été audité, et rien ne doit être affirmé sur lui.
- **Les polices** : `--font-display` et `--font-body` sont déclarées chez Amorce
  et pointent vers des variables `*-src` ; quelles fontes elles chargent
  réellement n'a pas été relevé.
- **Le rendu réel** : tous les chiffres ci-dessus sont calculés depuis les
  valeurs déclarées. Aucun n'a été vérifié sur le terrain de référence, écran
  allumé — ce que `/epreuve-du-pouce` fait et que ce fichier ne remplace pas.

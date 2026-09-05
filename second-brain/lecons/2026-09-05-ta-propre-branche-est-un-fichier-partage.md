# Ta propre branche de PR est un fichier partagé — 05/09/2026

## Ce qui a été mesuré

Deux sessions ont fusionné `main` dans **la même branche** — `claude/coffre-tests` —
à quelques minutes d'intervalle, sans se voir. Le compte exact du travail refait :

| geste | les deux l'ont fait |
| --- | --- |
| résoudre le conflit de `coffre.ts` | oui, avec deux commentaires différents |
| retirer la suite vitest de `main` | oui, décision déjà tranchée la veille |
| porter ce que cette suite couvrait seule | oui — **7 cas** d'un côté, **12** de l'autre |

La seconde session a découvert le doublon en poussant : `git push` refusé, non
fast-forward. Quinze minutes de travail, dont la partie coûteuse — la résolution
de conflit — étaient à jeter. Ce qui a survécu tient en trois tests que
**ni l'une ni l'autre** n'avait écrits.

## La cause

`CLAUDE.md` §10 bis dit de faire `git fetch` avant de toucher à un fichier
partagé, et nomme `CLAUDE.md`, `INDEX.md`, le hook. Il range une PR ouverte
sous « une session au travail, pas un obstacle » — formulation qui suppose
**une** session par branche.

Rien ne le garantit. Une branche qui porte un sujet actif est exactement ce
qu'une autre session reprend quand elle est appelée sur ce sujet-là : c'est le
canal de coordination du dépôt qui le veut, puisqu'il n'y en a pas d'autre.

Le piège n'est donc pas d'avoir oublié de récupérer — la seconde session avait
bien fait `git fetch` **en ouvrant**. C'est que l'écart entre l'ouverture et la
poussée était plus long que l'intervalle entre deux sessions.

## La règle

**Récupérer sa propre branche juste avant le geste coûteux, pas seulement au
réveil.** Une résolution de conflit, un portage de tests, une réécriture : ce
qui prend plus de cinq minutes se fait après un `git fetch origin <branche>`,
au même titre qu'un fichier partagé.

```bash
git fetch -q origin "$(git branch --show-current)"
git rev-list --count HEAD..origin/"$(git branch --show-current)"   # 0 attendu
```

Et quand le doublon est déjà là : **ce qui est publié gagne, toujours** — même
si le travail local paraît meilleur. Ici la version publiée l'était vraiment,
sur les deux points où elles différaient. Le geste juste n'est pas de fusionner
les deux rédactions, c'est de repartir de la publiée et de n'ajouter que ce
qu'elle n'a pas.

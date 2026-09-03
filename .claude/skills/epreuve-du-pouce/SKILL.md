---
name: epreuve-du-pouce
description: "Éprouver une interface comme un pouce la rencontre — conduire l'application qui tourne sur le terrain de référence (Redmi Note 12 Plus, 393 × 873) et mesurer ce que les règles du dépôt exigent déjà : aucun défilement horizontal, quarante-quatre pixels pour tout ce qui se touche, 4,5:1 de contraste sur le rendu réel, et surtout la **distance en gestes** de chaque action nommée. À utiliser avant de livrer un écran ou un composant, après tout changement de mise en page, de palette ou de navigation, et dès qu'une demande dit « ça déborde », « je ne trouve pas le bouton », « c'est illisible dehors », « trop petit », « je préfère à la verticale », « on ne voit pas les dernières étapes » — y compris quand elle dit seulement « regarde sur mon téléphone ». À utiliser aussi quand tout paraît juste : les défauts que cette épreuve trouve passent les tests unitaires, qui ne voient ni la mise en page, ni la portée du pouce, ni ce qui sort du cadre. Ici on mesure l'interface **livrée** ; pour les règles d'écriture qui l'évitent en amont, c'est `tailwind-mobile-ux`, et pour les couleurs elles-mêmes, `usine-a-themes`."
---

# Les règles étaient écrites. Rien ne les mesurait.

`tailwind-mobile-ux` pose depuis longtemps les trois exigences : aucun
défilement horizontal en 390 px, quarante-quatre pixels pour tout ce qui se
touche, la zone du pouce en bas. Elles sont justes, et elles ne servaient à
rien : aucune commande ne les vérifiait.

En une seule journée, quatre défauts sont passés au travers de `npm test` et de
`npm run verify` :

| ce qui a échappé | pourquoi les tests ne le voient pas |
| --- | --- |
| barre d'étapes de **628 px** dans un écran de 393 | elle est bien rendue, avec les bons libellés |
| bouton de découpe à **deux gestes** de l'écran d'arrivée | il existe, il est cliquable, son texte est juste |
| hauteur posée en `max-h`, qui ne contraint rien | l'élément est présent et non vide |
| panneaux défilant **sous** la barre de lecture | rien ne dit qu'un `z-index` est trop bas |

Aucun n'est un bug de logique. Tous se voient en trois secondes sur un
téléphone, et jamais autrement.

## Le geste

```bash
npm run dev                       # dans un terminal
node .claude/skills/epreuve-du-pouce/scripts/eprouver.mjs \
  --url http://localhost:3000 \
  --fichier /chemin/vers/un-rush.webm \
  --actions "Découper,Exporter,Poser les réglages"
```

Le script sort **1** dès qu'un point est à reprendre : il se branche tel quel
dans une barrière de vérification.

Deux détails qui font perdre du temps si on les ignore. Playwright se résout
depuis le dépôt : le script doit être lancé **depuis la racine**, sinon
`Cannot find package 'playwright'`. Et Chromium sans codecs propriétaires **ne
décode pas le H.264** — un rush `.mp4` sera refusé à l'import par
« Fichiers illisibles ». Passer un `.webm` en VP9.

## Le contrôle qui compte, et pourquoi c'est le troisième

Compter les débordements et les cibles trop petites est facile ; n'importe quel
outil le fait. Ce qui coûte cher, c'est une action **présente mais
inatteignable** : elle passe tous les contrôles — le bouton existe, il est
rendu, son libellé est juste — et personne ne la trouve.

`--actions` mesure donc la **distance en gestes** : le script cherche l'action,
et si elle n'est pas là, touche chaque bouton visible à tour de rôle pour voir
si elle apparaît. Zéro geste, un geste, ou introuvable.

C'est le contrôle qui aurait signalé le bouton de découpe enterré derrière
« aller à l'étape 2, puis toucher le plan », alors que c'était l'action la plus
utile de l'écran.

## Lire le rapport sans se tromper

**Les cibles sous 44 px sont souvent réelles et souvent nombreuses.** Une
première mesure sur le studio en a rendu trente-deux, dont des boutons d'icône
à 37 px. Ce n'est pas du bruit : c'est la dette d'une règle jamais mesurée.
Traiter d'abord ce qui se touche souvent — la lecture, la coupe, l'annulation —
plutôt que de tout reprendre d'un coup.

**Les curseurs sont écartés du calcul.** La piste d'un `input[type=range]` fait
quelques pixels de haut ; ce qu'on touche est sa poignée, que le navigateur
dimensionne lui-même. La mesurer rendait un défaut à chaque réglage, et trente
faux positifs font abandonner un contrôle plus sûrement qu'aucun contrôle.

**Le contraste est mesuré sur le rendu, pas sur les jetons.** Le script remonte
jusqu'au premier ancêtre au fond non transparent : c'est la seule façon de voir
un texte posé sur une surface qui n'est pas celle qu'on croyait.

**Le tiers haut est indicatif, jamais un échec.** Un bouton y est hors de portée
à une main, mais certains y ont leur place — l'annulation, le retour. Le chiffre
est là pour qu'on se pose la question, pas pour qu'on déplace tout en bas.

## Ce que ça ne remplace pas

Le vrai téléphone. L'épreuve voit les débordements, les tailles, les contrastes
et les chemins ; elle ne voit ni la barre de gestes, ni la police système, ni la
perception réelle du contraste en plein jour. C'est le troisième niveau de
`tailwind-mobile-ux`, et c'est lui qui a fait remonter `--color-muted`.

Elle ne juge pas non plus si l'écran est **beau**. Une interface peut passer les
quatre contrôles et rester laide ; l'inverse est plus rare, mais il existe.

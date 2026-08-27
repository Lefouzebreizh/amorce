---
name: usine-a-themes
description: Fabriquer ou retoucher la palette d'Amorce — les jetons `@theme` de Tailwind v4 dans `src/app/globals.css`, ce que chaque famille de couleurs signifie, et les contraintes de contraste qu'un écran de téléphone en plein jour impose. À utiliser dès qu'une demande parle de couleur, de palette, de thème, de mode clair ou sombre, de contraste, de « c'est trop sombre », « on ne lit rien dehors », « change la couleur du bouton », « ajoute une couleur pour X », ou dès qu'on est tenté d'écrire une valeur hexadécimale dans une classe. Pour concevoir un écran ou un composant, c'est `/custom-frontend-designer` ; ici on ne s'occupe que des couleurs elles-mêmes.
---

# Une couleur n'entre dans Amorce que par un jeton

Toute la palette vit dans un seul bloc `@theme` de `src/app/globals.css`, et
Tailwind v4 en dérive les classes : `--color-panel` donne `bg-panel`,
`text-panel`, `border-panel`. **Aucune valeur hexadécimale ne s'écrit dans une
classe.** Ce n'est pas une préférence de style : une couleur en dur est une
couleur qu'on ne retrouvera pas le jour où la palette bouge, et l'interface
dérive alors d'un écran à l'autre sans que rien ne casse.

## Les quatre familles, et ce qu'elles veulent dire

| Jetons | Rôle | La règle qui va avec |
| --- | --- | --- |
| `ink` `slab` `panel` `raised` `edge` | Quatre plans de profondeur, du fond de page à la carte la plus haute | **Les surfaces séparent mieux que les traits.** Une bordure est réservée à ce qui sépare vraiment — bandeaux, barre d'étapes — et à ce qui est sélectionné. Une interface où tout est encadré se lit comme une pile de boîtes, et plus rien n'y ressort. |
| `mist` `muted` | Texte principal, texte d'aide | `muted` est déjà remonté une fois : un gris trop discret cesse d'être lu, et l'explication qu'il porte ne sert alors plus à rien. |
| `accent` `accent-deep` | **L'action à faire, et ce qui va bien.** Rien d'autre | L'employer aussi pour les états actifs l'a rendu décoratif — donc muet. C'est la règle la plus facile à casser sans s'en apercevoir. |
| `warn` `danger` | Ce qui demande attention, ce qui bloque | Ne pas les employer pour de la décoration : ils perdraient le même pouvoir que l'accent. |

L'interface est **sombre par choix**, pas par mode : on passe son temps à juger
des images, et un fond clair fausse la perception du contraste et de
l'étalonnage. Il n'y a donc pas de bascule clair/sombre à maintenir, et en
ajouter une serait un changement de produit, pas de thème.

## Ajouter ou modifier un jeton

1. **Écrire le jeton dans `@theme`, avec le commentaire qui dit pourquoi.** La
   convention du fichier est un bloc par famille qui porte la décision. Une
   couleur sans justification est une couleur que le prochain déplacera au
   hasard.
2. **Se demander d'abord si un jeton existant convient.** Une palette gagne à
   rester courte : cinq gris qu'on distingue valent mieux que huit qu'on
   confond, et chaque nouveau jeton est une décision de plus à prendre sur
   chaque écran.
3. **Vérifier le contraste sur le terrain, pas sur la maquette.** Amorce
   s'utilise dehors, sur un téléphone, souvent à une main. Viser au moins 4,5:1
   pour tout texte qui porte une information, et davantage pour les textes
   d'aide, qui sont petits.
4. **Ne pas oublier Chrome Android**, qui assombrit automatiquement certaines
   pages : un gris déjà bas peut y devenir illisible. Voir `/tailwind-mobile-ux`.

## Décliner une palette entière

Fabriquer une variante — plus chaude, plus contrastée, une identité différente —
se fait en remplaçant les **valeurs** des jetons, jamais leurs noms. Les noms
portent le rôle (`raised` = la carte la plus haute), pas la couleur ; les
renommer casserait chaque composant sans rien apporter.

L'ordre qui donne un résultat cohérent :

1. Poser les cinq surfaces d'abord, du plus sombre au plus clair, en gardant un
   **écart perceptible mais faible** entre voisines. C'est ce qui produit la
   profondeur sans traits.
2. Poser `mist` et `muted` ensuite, en mesurant leur contraste **sur `panel`**,
   la surface où vit le plus de texte — pas sur `ink`, où tout paraît lisible.
3. L'accent en dernier, choisi pour ressortir sur les cinq surfaces à la fois.
   Un accent qui ne fonctionne que sur le fond le plus sombre oblige à des
   exceptions, et les exceptions sont la fin d'une palette.

## Vérifier

```bash
npm run typecheck && npm run lint && npm test
npm run dev        # puis regarder, il n'y a pas d'autre juge pour une couleur
```

Si le changement touche à la lisibilité en usage réel — sous-titres, textes
d'aide, états d'un bouton —, `npm run verify` contrôle sur les pixels et pas
seulement sur la présence des éléments.

Un contrôle qu'aucune commande ne fait : **regarder l'écran de loin, et sur un
téléphone**. Une palette se juge à un mètre, pas à trente centimètres.

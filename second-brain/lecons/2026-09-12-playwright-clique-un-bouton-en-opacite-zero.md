# Playwright clique un bouton en opacity:0 sans broncher

Mesuré le 12/09/2026, sur `renov-facile/`. Le propriétaire a signalé, capture
d'écran depuis son téléphone à l'appui : rien n'était cliquable sous le
bandeau d'accueil du site. Le bloc entier — carte, accroche, bouton « On y
va » — était bien dans le DOM, correctement stylé, mais en `opacity:0` :
`style.css` (porté d'`ensemble-mdph`) démarre chaque `.carte-demarche` invisible
et ne la révèle qu'en lui ajoutant `.carte-visible`, posée par un
`IntersectionObserver` au défilement dans le `main.js` d'origine. La version
simplifiée du site (une seule démarche, pas de grille) avait perdu cet
observateur en route : la carte restait invisible pour de bon.

**Ce qui rend le cas payant à écrire** : un parcours Playwright avait été
joué sur ce même écran quelques heures plus tôt, avec `page.click('button:has-
text("On y va")')`, et il avait réussi — pas d'erreur, pas de timeout. La
vérification de visibilité de Playwright (celle qui précède un clic) ne
regarde que `display`, `visibility` et une boîte englobante non nulle.
**L'opacité n'en fait pas partie.** Un bouton en `opacity:0`, parfaitement
positionné, réagit donc à un clic scripté exactement comme un bouton visible
— et rien dans le compte rendu du test ne le distingue d'un vrai succès.

Le défaut avait même été photographié dans cette session-là : une capture
plein écran montrait un grand vide entre le sous-titre du héro et le pied de
page, et a été lue comme un artefact de mise à l'échelle de l'image plutôt
que comme un signal à vérifier. C'est exactement le défaut que le §8 bis
nomme déjà pour d'autres cas (accent mesuré contre le mauvais fond, lien mort
compté à l'envers) : une vérification automatisée qui passe ne dit rien sur
ce qu'un humain voit, tant qu'elle ne mesure pas le bon objet.

**La parade, pour toute vérification Playwright de ce dépôt** : ne jamais
conclure d'un clic réussi qu'un élément est *visible* — clic réussi et
opacité réelle sont deux choses différentes. Mesurer l'opacité calculée
directement :

```js
await el.evaluate((e) => getComputedStyle(e).opacity); // doit valoir "1"
```

Ou, plus simplement, regarder une capture d'écran à l'œil avant d'annoncer un
parcours vert — ce que le §8 bis demande déjà, et que ce cas confirme comme
non négociable pour tout ce qui repose sur une animation d'apparition
(`opacity`/`transform` pilotées par une classe ajoutée en JS).

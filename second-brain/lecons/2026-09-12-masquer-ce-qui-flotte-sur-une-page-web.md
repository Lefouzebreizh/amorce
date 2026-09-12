# Masquer ce qui flotte sur une page web : trois pièges mesurés

*12/09/2026 — mesuré sur `payfit.com/fr`, `pennylane.com` et `qonto.com/fr`
avec `audit-landing/capturer_page.py`, sur la machine du propriétaire. Vaut
pour tout code du dépôt qui photographie une page.*

Photographier une page écran par écran oblige à retirer ce qui suit le
viewport, sans quoi le même bandeau se retrouve sur chaque image. Les trois
pièges ci-dessous ont chacun coûté un tour, et chacun avait d'abord été
déclaré réglé par une mesure verte.

## 1. `fixed` et `sticky` ne se masquent pas pareil

`display:none` sur un `position: sticky` le **retire du flux** : la page
raccourcit, tout le contenu suivant se décale. Sur un `position: fixed`, aucun
effet — il n'occupait aucune place.

D'où le partage : `display:none` pour un `fixed`, **`visibility:hidden` pour un
`sticky`** — invisible en gardant sa place. Mesuré : hauteur du document
identique **au pixel** avant et après, sur les trois sites.

## 2. `visibility` s'hérite, mais un enfant peut la reprendre

C'est la différence qui piège. `display:none` emporte tout le sous-arbre ;
`visibility:hidden` non — un descendant qui déclare `visibility: visible`
**réapparaît**. Masquer le seul en-tête de Payfit laissait donc les libellés de
son menu posés par-dessus le titre de la section. La règle doit viser les
descendants : `[marque], [marque] * { visibility: hidden !important }`.

## 3. `element.style` ne prend pas toujours, et ne le dit pas

Sur l'en-tête de `payfit.com/fr`, le **même nœud**, dans la **même boucle** :

```js
noeud.setAttribute('data-marque', 'oui');                    // passe
noeud.style.setProperty('display', 'none', 'important');     // ignoré
```

`noeud.style.display` est encore vide juste après l'appel. Aucune exception,
aucun message. **Écarté par la mesure** : `bypass_csp=True` n'y change rien, ce
n'est donc pas la Content-Security-Policy — la cause réelle n'est pas élucidée.
**Ce qui marche** : une feuille de style injectée, ciblant un attribut posé sur
les nœuds. Un masquage qui compte sur `element.style` échoue en silence sur
certains sites.

## Ce qui relie les trois, et c'est la partie transposable

**Un contrôle écrit en même temps que le correctif hérite de ses angles morts.**

Le contrôle automatique disait « aucun élément encore collé en haut » alors que
le menu était bien là, posé sur le titre. Il ne filtrait que les éléments **en
position collante** — parce que celui qui venait de décider que le problème
était « les éléments collants » a naturellement écrit un contrôle qui regarde
les éléments collants. Les libellés du menu, eux, sont en `static`. Mesure
juste, mauvais objet.

De la même façon, la version précédente avait conclu qu'un `sticky` « ne se
duplique plus jamais » une fois chaque segment capturé à sa position — vrai du
mécanisme de duplication d'avant, faux du résultat : il se retrouve sur quatre
segments sur douze et **recouvre du texte**.

Le §8 de `CLAUDE.md` dit déjà « avant de croire un vert, dire en une phrase ce
qu'il mesure ». Ces cas ajoutent le corollaire pratique : **sur un défaut
visuel, ouvrir une image du lot avant d'annoncer.** Les deux fois, c'est le
regard qui a tranché, en quelques secondes, ce qu'aucune mesure de la session
n'avait vu.

## Ce qui n'a pas été vérifié

Le masquage retire l'en-tête de **tous** les segments, y compris du premier, où
un visiteur le verrait. Pour juger l'ergonomie d'un hero, c'est une perte
possible — non mesurée, et à trancher le jour où le rapport d'analyse dira
quelque chose sur les barres de navigation.

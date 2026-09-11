# Une capture pleine page composite rate les révélations au scroll réversibles

*12/09/2026 — mesuré en corrigeant `audit-landing/capturer_page.py`.*

## Ce qui a été mesuré

`page.screenshot(full_page=True)` de Playwright rend une capture composite
depuis **une seule** position de défilement (Chromium étend virtuellement le
viewport à la hauteur totale de la page et rend une fois). Beaucoup de sites
révèlent leurs sections au scroll par une animation d'opacité (0 → 1) pilotée
par un `IntersectionObserver` qui la **réinverse dès que la section ressort du
viewport** — GSAP ScrollTrigger, Framer Motion `whileInView`, AOS.js sans
`data-aos-once`. Sur une page qui révèle plusieurs sections à des points de
défilement différents, **aucune position finale unique ne peut toutes les
satisfaire à la fois** : celles au-dessus de la position choisie retombent à
opacity 0, celles en dessous n'ont jamais été déclenchées.

Résultat mesuré : des segments découpés a posteriori dans une capture pleine
page ressortent **totalement blancs, à leur position attendue**, avec un total
de segments par ailleurs cohérent (l'opacité ne touche pas la mise en page,
contrairement à `display:none`). C'est un piège particulièrement retors parce
que la mesure « ça a la bonne taille » ne le voit pas — seul un regard sur le
contenu du segment le révèle.

## Deux hypothèses voisines, testées et écartées avant celle-ci

- **Masquer `position: sticky` comme `position: fixed`** : un `sticky` reste
  dans le flux du document (contrairement à `fixed`) ; le masquer avec
  `display:none` retire son espace, raccourcit la page et décale tout ce qui
  suit. Ça produit un défaut (perte de contenu, décalage), jamais un segment
  blanc à sa position correcte.
- **`content-visibility: auto`** : sur une fixture minimale, le rendu pleine
  page de Chromium gère correctement ce cas — ne reproduit rien.

Les trois hypothèses ont la même signature de symptôme au premier coup d'œil
(« du contenu qui devrait être là ne l'est pas ») et des causes complètement
différentes. Chacune a dû être reproduite sur sa propre fixture minimale avant
d'être retenue ou écartée — deviner depuis la description du symptôme aurait
fait corriger la mauvaise chose.

## La parade

Ne jamais reconstruire une capture segmentée à partir d'une seule capture
composite. Scroller réellement à la position de chaque segment, laisser un
court instant à une animation en cours de se terminer, puis capturer le
**viewport courant** (`page.screenshot()` sans `full_page`) à cet endroit
précis. Ça correspond exactement à ce qu'un utilisateur voit, et ça règle en
même temps `content-visibility: auto` et les animations canvas/vidéo qui ne
peignent qu'à l'écran — aucun des trois n'a besoin d'un correctif séparé une
fois qu'on capture par position réelle plutôt que par recomposition.

Vaut pour tout outil de ce dépôt qui capture une page longue à des fins
d'analyse ou d'archive — pas seulement `audit-landing/`.

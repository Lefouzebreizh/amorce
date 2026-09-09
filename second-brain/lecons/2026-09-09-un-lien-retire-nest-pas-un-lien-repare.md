# Un lien retiré n'est pas un lien réparé

*09/09/2026 — mesuré sur `annuaire-ia`, vaut pour tout site dont les liens
sortants sont la raison d'être.*

## Ce qui a été mesuré

Un garde-fou masquait les boutons dont l'adresse d'affiliation était encore le
gabarit `exemple-affiliation.com`. Il était juste : un bouton qui mène à un
domaine inexistant est pire que pas de bouton, sur le seul élément de la page
censé inspirer confiance.

Mais personne n'avait mesuré ce qu'il **laissait**. Relevé sur la page servie,
17 fiches : **16 n'avaient aucun `<a>` du tout**. Un comparateur d'outils d'où
l'on ne pouvait pas partir essayer l'outil.

Et la cause n'était pas partout la même — c'est ce que le compte a révélé :

| | sur les 17 |
| --- | --- |
| lien affilié réel | 1 |
| **aucun programme d'affiliation qui existe** | **7** |
| programme simplement pas encore ouvert | 9 |

Les sept sont ChatGPT, Claude, Perplexity, Midjourney, Canva, Notion AI,
Gemini : OpenAI, Anthropic et Google ne rémunèrent pas l'apport d'inscription,
Canva et Notion ont fermé le leur. Ce sont **les outils les plus cherchés du
site**, et ils n'auraient jamais eu de bouton — pas « pas encore », jamais.

## La règle

Un garde-fou qui retire quelque chose se juge sur **ce qui reste**, jamais sur
ce qu'il retire. « 0 lien mort » et « 0 lien » rendent le même vert.

Le repli coûtait quinze lignes : l'adresse officielle, un habillage neutre, et
`rel="noopener"` au lieu de `sponsored` — déclarer sponsorisé un lien qui ne
rapporte rien est faux vis-à-vis des moteurs. L'accent du produit reste réservé
au lien qui rapporte (`CLAUDE.md` §2 bis, invariant 3) : un lien direct en
sauge aurait rendu l'accent muet, ce que l'invariant interdit précisément.

## Le piège de vérification

Le contrôle du parcours affirmait « pas de lien affilié → pied de fenêtre
masqué ». Il est **tombé** au premier repli, et c'était le bon comportement :
la règle avait changé, pas le code. Repointé et non retiré — « neutre et
honnête » remplace « masqué », avec trois assertions qui tiennent ensemble
(bonne adresse, pas de `sponsored`, pas d'accent).

Un test qui tombe quand la règle change fait son travail. Le supprimer parce
qu'il gêne, ou le laisser vert sur l'ancienne règle, sont les deux façons de
perdre ce qu'il gardait.

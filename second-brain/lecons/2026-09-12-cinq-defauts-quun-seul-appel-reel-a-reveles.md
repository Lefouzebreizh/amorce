# Cinq défauts qu'un seul appel réel a révélés

*12/09/2026 — mesuré en exerçant pour la première fois `audit-landing/analyser_captures.py`
contre `api.anthropic.com`, depuis la machine du propriétaire. Le module était
écrit avec soin, testé, relu, et documenté « non exercé ».*

Le code avait été écrit contre la surface réelle du SDK (signatures relevées
dans le paquet, jamais de mémoire), il passait ses tests, et son README disait
honnêtement qu'aucun appel n'avait jamais été fait. **Le premier appel réel a
échoué cinq fois de suite, pour cinq causes différentes.** Aucune n'était
détectable sans appeler.

| # | Ce qui a échoué | Ce que le message disait |
| --- | --- | --- |
| 1 | `minItems: 6` dans le schéma JSON | 400 — « For 'array' type, 'minItems' values other than 0 or 1 are not supported » |
| 2 | `minimum`/`maximum` sur un entier | 400 — « For 'integer' type, properties maximum, minimum are not supported » |
| 3 | `reponse.content[0].text` | `AttributeError: 'ThinkingBlock' object has no attribute 'text'` |
| 4 | `max_tokens=4096` | JSON coupé au caractère 799 → « Réponse du modèle non JSON » |
| 5 | appel bloquant, génération longue | `APIConnectionError` à 299 s puis 239 s |

## Ce que chacun apprend

1. **Le schéma de sortie structurée accepte un sous-ensemble de JSON Schema.**
   Les contraintes de cardinalité et de bornes numériques n'y sont pas. Une
   contrainte qu'on retire du schéma doit se réinstaller dans la validation,
   sinon elle s'évapore sans bruit — c'est le §8 du dépôt appliqué à un schéma.
2. **Le premier bloc d'une réponse n'est pas forcément du texte.** Un bloc de
   réflexion peut le précéder. `content[0].text` est une supposition qui tient
   jusqu'au jour où elle ne tient plus — et elle a coûté quatre-vingt-onze
   secondes de génération **déjà payée**.
3. **Une troncature ne se présente pas comme une troncature.** Le plafond de
   jetons atteint rend un JSON incomplet, donc une erreur de parsing qui
   accuse le modèle d'avoir mal répondu alors qu'il a été interrompu. Vérifier
   `stop_reason` vaut mieux que relire le JSON.
4. **Le budget de jetons est partagé avec la réflexion du modèle.** Un plafond
   calculé sur la taille du rapport seul est un plafond faux.
5. **Une génération longue en appel bloquant se fait couper la connexion.**
   Deux coupures à 299 s et 239 s, rendues en « injoignable » pour un serveur
   qui répondait parfaitement — et les essais plus courts, eux, passaient. Le
   flux (`messages.stream`) fait circuler des données pendant toute la
   génération et tient la connexion ouverte.

## Le faux positif que seul le regard a vu

Le rapport produit était bon — chaque constat cite un segment et un élément
visible, jamais une généralité. Sauf un : « le témoignage client est **tronqué
en fin de segment** ». C'est vrai de l'image, et faux de la page : c'est le
découpage à hauteur d'écran fixe qui coupe, et le visiteur réel fait défiler en
continu. **Un audit vendu à un client lui aurait signalé un défaut inexistant.**

Corrigé dans le prompt système, qui distingue désormais une coupure au **bord**
d'un segment (artefact, à ignorer) d'une coupure **à l'intérieur** d'un segment
(vrai défaut). Vérifié en relançant : le faux positif a disparu, et le vrai
constat de la même famille — des logos partenaires coupés par le bord de leur
cadre CSS — est resté, confirmé à l'œil sur l'image.

## Ce qu'il faut en retenir au-delà de ce module

**« Écrit contre la surface réelle de l'API » n'est pas « exercé ».** Lire les
signatures d'un SDK protège des fautes de frappe et des paramètres inventés ;
ça ne dit rien de ce que le **serveur** accepte, de ce que le **modèle** rend,
ni de ce que le **réseau** tolère. Les cinq défauts ci-dessus vivaient tous
dans cet angle mort, et aucun test hors ligne ne pouvait les voir.

Le dépôt a plusieurs modules dans cet état — `generation-serveur/` en
particulier, dont le README dit « aucune route HTTP, aucune clé, aucun essai
réel ». Cette leçon ne dit pas qu'ils sont faux : elle dit qu'entre « prêt » et
« vérifié » il reste, mesuré ici, **cinq échecs consécutifs**.

## Ce que ça a coûté

Environ sept appels, dont quatre facturés après génération complète — de
l'ordre de quelques dizaines de centimes au total. À comparer au prix de
découvrir ces cinq défauts devant un client payant.

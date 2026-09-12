# Audit de page de vente en 24h — capture visuelle

Brique de capture pour le futur produit « Audit de page de vente en 24h » :
transformer une URL en une poignée d'images nettes, prêtes à être montrées à
un modèle de vision — pas du texte brut. Juger l'ergonomie et le
copywriting *en contexte* demande de voir la page, pas d'en extraire les
mots.

**Ce dossier ne fait que ça : capturer et découper.** Le prompt d'analyse
d'image, la génération du rapport, la page de vente du produit et Stripe
viennent après — voir la consigne d'origine, pas encore commencée ici.

## Défaut corrigé : tranches blanches sur `qonto.com/fr`

Mesuré par le propriétaire le 11/09/2026 : 3 tranches sur 13 sorties
**totalement blanches**, sans aucun contenu, sur `qonto.com/fr` — aucune sur
`payfit.com/fr` ni `pennylane.com` dans la même session.

**Cause identifiée et reproduite sur fixture locale** : beaucoup de sites de
storytelling révèlent leurs sections au scroll par une animation d'opacité
(0 → 1) qui **se réinitialise dès que la section ressort du viewport** — GSAP
ScrollTrigger, Framer Motion `whileInView`, AOS.js sans `data-aos-once`. La
version précédente du script prenait une seule capture pleine page composite,
depuis une seule position de défilement (`page.screenshot(full_page=True)`) :
sur une page qui révèle plusieurs sections à des points différents, aucune
position unique ne peut toutes les satisfaire à la fois. C'est exactement la
forme du défaut observé — espace correct (donc un total de 13 tranches qui
avait l'air normal), contenu absent.

**Deux autres hypothèses ont été testées avant celle-ci et écartées**, chacune
sur une fixture dédiée :

- Le masquage de `position: sticky` (l'ancienne version de
  `masquer_elements_fixes`) : un vrai défaut, mais il raccourcit la page et
  décale son contenu — il ne blanchit jamais une tranche en place.
- `content-visibility: auto` : ne reproduit rien sur une fixture minimale —
  le rendu pleine page de Chromium gère correctement ce cas précis.

**Une seconde cause réelle, indépendante, a été confirmée en testant le
vrai site.** Le propriétaire l'a mesurée directement sur `qonto.com/fr`, sur
sa machine : **la capture pleine page de Chromium a un plafond de hauteur
d'image**, et `device_scale_factor=2` le fait franchir sur une page de cette
taille — 11 311 px logiques, donc 22 622 px physiques à l'échelle 2, contre
un plafond mesuré autour de 19 768 px physiques. Tout ce qui dépasse ce
plafond sort blanc. C'est pour ça que `payfit.com/fr` et `pennylane.com`,
plus courtes, ne montraient rien : elles ne l'atteignaient jamais. Les deux
causes cohabitaient probablement sur `qonto.com/fr` — la révélation
réversible pour certaines tranches, le plafond de hauteur pour d'autres.

**Le correctif est architectural : chaque segment est désormais capturé
pendant qu'il est réellement scrollé dans le viewport**, pas recomposé après
coup depuis une capture unique. `capturer_et_decouper` scrolle à la position
de chaque segment, laisse un court instant à une révélation en cours de se
terminer, puis prend une capture du viewport à cet endroit précis — ce qui
correspond exactement à ce qu'un utilisateur réel verrait — et une capture
qui ne fait jamais plus que 2880×1800 px n'approche jamais le plafond de
hauteur de Chromium. Ça règle les trois causes à la fois (révélation
réversible, plafond de hauteur, `content-visibility: auto`) sans qu'aucune
n'ait eu besoin d'un correctif séparé. Revérifié sur les quatre fixtures
(cookies + lazy-loading, section épinglée, `content-visibility`, révélation
réversible) : plus aucune tranche blanche.

**Mesuré sur `qonto.com/fr` lui-même par le propriétaire, sur sa machine**
— ce que cette session ne peut toujours pas faire (mur réseau, voir plus
bas) : plus aucune tranche vide, et deux tranches auparavant partiellement
blanches (jusqu'à 91,9 % de blanc) se peignent désormais en entier — la
capture par segment règle donc aussi des cas de peinture partielle, pas
seulement les tranches totalement vides.

**Un second défaut a été trouvé par cette même vérification en conditions
réelles, sur `payfit.com/fr` cette fois : `00-pleine-page.png` restait
tronqué.** C'est le fichier de référence pleine page, laissé à
`full_page=True` par le correctif ci-dessus — lui seul, pas les segments —
peut donc encore franchir le plafond de hauteur de Chromium sur une page
suffisamment haute, exactement la cause déjà mesurée. Corrigé en rendant
cette seule capture à `scale="css"` (échelle 1x) au lieu de l'échelle 2x des
segments, ce qui divise par deux la hauteur physique demandée. Et
`analyser_captures.py`, écrit dans la foulée, exclut ce fichier de ce qu'il
envoie au modèle de vision — un aplat blanc éventuel sur ce fichier de
référence ne doit jamais se substituer au dernier segment numéroté, qui
couvre le même contenu sans ce risque.

### Le point resté ouvert a été tranché, et c'est un regard qui l'a fait

La bande de tête identique sur les segments 02 à 05 de `payfit.com/fr` était
bien un en-tête `position: sticky` épinglé — et la question posée était : vraie
fidélité au parcours, ou défaut à corriger ? **Regardée à l'œil le 12/09/2026,
la réponse est nette : l'en-tête est posé par-dessus le titre de la section**,
qui en ressort coupé. Ce n'est donc pas seulement « quatre fois le même
en-tête » pour un modèle de vision : c'est du **texte perdu**, quatre fois. La
même chose sur `pennylane.com`.

**Le partage retenu satisfait les deux contraintes** — celle qui avait fait
épargner les `sticky`, et celle-ci :

| Ce qui flotte | Comment | Pourquoi |
| --- | --- | --- |
| `position: fixed` | `display: none` | n'occupe aucune place, rien ne bouge |
| `position: sticky` | `visibility: hidden` | invisible **en gardant sa place** : la hauteur du document reste identique **au pixel** sur les trois sites mesurés, donc rien ne se décale |

Et le masquage est **rejoué avant chaque segment** : un en-tête ne devient
collant qu'une fois le hero dépassé, un bouton flottant n'apparaît qu'après
quelques écrans — un masquage unique au départ ne peut pas attraper ce qui
n'existe pas encore.

Deux pièges mesurés en chemin, chacun ayant coûté un tour :

- **Le style en ligne ne prend pas toujours, et ne le dit pas.** Sur l'en-tête
  de Payfit, `noeud.style.setProperty('display','none','important')` ne
  s'enregistre même pas — `style.display` est encore vide juste après l'appel —
  alors qu'un `setAttribute` sur le **même nœud**, dans la **même boucle**,
  passe. La cause n'a pas été élucidée ; ce qui est mesuré est que
  `bypass_csp=True` n'y change rien (ce n'est donc pas la CSP) et qu'une
  **feuille de style** injectée, elle, s'applique. Le masquage passe désormais
  par là.
- **`visibility` s'hérite, mais un enfant peut la reprendre.** Un descendant
  qui déclare `visibility: visible` réapparaît malgré un ancêtre caché,
  contrairement à `display:none`. Sans la seconde moitié du sélecteur
  (`[marque] *`), les libellés du menu restaient posés sur le titre — et le
  contrôle automatique les déclarait masqués, parce qu'il ne regardait que les
  éléments *en position collante* et que les enfants sont en `static`. Une
  mesure juste sur le mauvais objet, attrapée par le regard sur l'image.

**Vérifié sur les quatre URLs le 12/09/2026**, sur la machine du propriétaire :
aucune tranche vide, **aucune bande de tête ni de pied identique entre deux
segments** sur les quatre sites, pleines pages peintes à 99,3 / 99,8 / 100 %,
et les tranches regardées à l'œil — dont celle qui portait l'en-tête, où le
titre est désormais entier.

## Utiliser

```bash
pip install playwright   # PyPI est ouvert, pas besoin de plus — Pillow n'est plus nécessaire
python3 capturer_page.py "https://exemple.com" --sortie captures/
```

Puis, une fois les segments écrits, les faire juger par un modèle de vision :

```bash
pip install anthropic
export ANTHROPIC_API_KEY="…"
python3 analyser_captures.py captures/exemple-com/
```

Écrit `rapport.md` dans le dossier de capture : verdict global, six catégories
notées sur 10 (message et promesse, preuve sociale, appel à l'action,
objections et confiance, lisibilité et hiérarchie visuelle, cohérence de
marque), des constats triés par sévérité et référencés au segment où ils se
voient, et les trois priorités à corriger en premier. Voir l'en-tête de
`analyser_captures.py` pour le détail du prompt et du schéma.

### Exercé pour de vrai le 12/09/2026, et il a fallu cinq correctifs

Le module était écrit contre la surface réelle du SDK (signatures relevées dans
le paquet, jamais de mémoire), il passait ses tests, et cette section disait
honnêtement « non exercé ». **Le premier appel réel a échoué cinq fois de
suite, pour cinq causes différentes** — aucune détectable sans appeler :

| Ce qui a échoué | Ce que le serveur ou Python a répondu |
| --- | --- |
| `minItems: 6` dans le schéma | 400 — « For 'array' type, 'minItems' values other than 0 or 1 are not supported » |
| `minimum`/`maximum` sur un entier | 400 — « For 'integer' type, properties maximum, minimum are not supported » |
| `reponse.content[0].text` | `AttributeError: 'ThinkingBlock' object has no attribute 'text'` |
| `max_tokens = 4096` | JSON coupé au caractère 799, rendu comme « réponse non JSON » |
| appel bloquant, génération longue | `APIConnectionError` à 299 s puis 239 s |

Ce que chacun a changé dans le code :

- **Le schéma de sortie structurée n'accepte qu'un sous-ensemble de JSON
  Schema.** Les contraintes de cardinalité (`minItems`, `maxItems`) et de
  bornes numériques (`minimum`, `maximum`) en sont absentes. Elles n'ont pas
  disparu pour autant : elles sont **reportées sur `analyser_reponse_json`**,
  qui refuse un rapport auquel il manque une catégorie, une note hors de
  l'échelle 0–10, ou aucune priorité — avec trois tests qui le gardent. Une
  contrainte retirée d'un endroit se réinstalle ailleurs, sinon elle s'évapore.
- **Le premier bloc de la réponse n'est pas forcément du texte** : un bloc de
  réflexion peut le précéder. On cherche désormais le premier bloc de type
  `text` au lieu de supposer sa place.
- **Le budget de jetons est partagé avec la réflexion du modèle**, et une
  troncature ne se présente pas comme telle — elle se présente comme un JSON
  invalide. D'où un plafond relevé **et** un contrôle explicite de
  `stop_reason`, qui dit la vraie cause pendant qu'on la connaît.
- **Une génération longue en appel bloquant se fait couper la connexion.** Les
  essais courts passaient, les longs mouraient en « injoignable » pour un
  serveur qui répondait parfaitement. L'appel passe donc par
  `messages.stream`, qui fait circuler des données pendant toute la génération.

**Et un faux positif que seule la lecture du rapport a vu.** Le premier rapport
produit signalait « le témoignage client est tronqué en fin de segment » : vrai
de l'image, faux de la page — c'est le découpage à hauteur d'écran fixe qui
coupe, et un visiteur fait défiler en continu. Un audit vendu l'aurait fait
payer pour un défaut inexistant. Le prompt système distingue maintenant une
coupure au **bord** d'un segment (artefact, à ignorer) d'une coupure **à
l'intérieur** d'un segment (vrai défaut). Vérifié en relançant : le faux
positif a disparu, et le vrai constat de la même famille — des logos
partenaires coupés par le bord de leur cadre CSS sur `06-milieu.png` — est
resté, confirmé à l'œil sur l'image.

Détail et portée générale dans
`second-brain/lecons/2026-09-12-cinq-defauts-quun-seul-appel-reel-a-reveles.md`.

**Ce qui reste vrai d'une session distante** : `api.anthropic.com` n'y est pas
joignable, comme les quatre URLs de test. L'appel réel se fait sur la machine
du propriétaire.

Sans argument, le script capture les quatre URLs de test de la consigne
(`qonto.com/fr`, `payfit.com/fr`, `app.spendesk.com`, `pennylane.com`).

Le Chromium déjà présent sur une session Claude Code distante est réutilisé
via `--chromium /opt/pw-browsers/chromium` (valeur par défaut) : pas de
`playwright install`, qui est interdit dans ce dépôt (voir `CLAUDE.md`, repli
`playwright` de `/capacites-session`).

Chaque URL produit un dossier (`captures/<domaine-nettoyé>/`) contenant :

- `00-pleine-page.png` — la capture entière, pour référence ;
- `01-hero.png` — au-dessus de la ligne de flottaison ;
- `02-milieu.png`, `03-milieu.png`, … — le corps de page, en tranches d'une
  hauteur d'écran chacune plutôt qu'un unique bloc géant (voir plus bas) ;
- `NN-bas.png` — la dernière tranche.

## Ce que le script fait, dans l'ordre

1. **Viewport 1440×900, `device_scale_factor=2`** — rendu net, comme un écran
   Retina, pour que le texte reste lisible une fois découpé.
2. **Fermeture du bandeau de cookies** : essai de clic sur une liste de
   sélecteurs des CMP les plus répandus (OneTrust, Didomi, Axeptio,
   Cookiebot, TrustArc, Google Funding Choices) puis, en repli, sur un
   bouton dont le texte visible ressemble à « Tout accepter » / « Accept
   all ». Best effort, silencieux si rien ne matche.
3. **Masquage de ce qui flotte, différemment selon le cas, et rejoué avant
   chaque segment** — bandeau qui a résisté au clic, bannière promo, chat en
   direct, en-tête collant. Nécessaire même après l'étape 2 : un élément fixe
   est pinné au viewport, il apparaîtrait donc identique sur les treize
   segments si on ne le retirait pas. Un `position: fixed` reçoit
   `display:none` ; un `position: sticky` reçoit `visibility:hidden`, qui le
   rend invisible **sans le retirer du flux** — `display:none` sur un sticky
   raccourcirait la page et décalerait tout son contenu suivant (mesuré sur
   fixture), un vrai risque puisqu'un site de storytelling s'en sert souvent
   pour de grandes sections de mise en page et pas seulement pour un petit
   en-tête. Le masquage est **rejoué avant chaque segment** parce qu'un
   en-tête ne devient collant qu'une fois le hero dépassé. Il passe par une
   **feuille de style**, le style en ligne ne s'appliquant pas sur certains
   nœuds — voir « Le point resté ouvert » plus haut pour les deux pièges
   mesurés.
4. **Scroll progressif jusqu'en bas** (pas de 700 px, pause de 150 ms) pour
   déclencher le lazy-loading des images sous la ligne de flottaison —
   la plupart se chargent via `IntersectionObserver` et ne se déclenchent
   jamais si on ne scrolle pas jusqu'à elles.
5. **Attente de stabilité, deux fois** : `networkidle` ou 5 secondes de
   secours (ce qui arrive en premier), avant *et* après le scroll. Une page
   B2B avec chat en direct ou traqueurs ne devient parfois jamais inactive ;
   s'y fier seul bloquerait le script jusqu'au long timeout par défaut de
   Playwright.
6. **Un segment à la fois, capturé pendant qu'il est réellement scrollé dans
   le viewport** — jamais une capture pleine page composite découpée après
   coup. Le script scrolle à la position de chaque segment, laisse un court
   instant à une révélation au scroll de se terminer, puis capture le
   viewport à cet endroit précis (voir « Défaut corrigé » plus bas pour la
   raison). Une capture pleine page de référence (`00-pleine-page.png`) est
   prise en plus, en dernier.

### Pourquoi découper en tranches d'écran plutôt qu'en trois blocs fixes

La consigne parle de trois segments (« Hero, milieu, bas »). C'est ce que
rend le script sur une page courte. Mais sur une vraie page SaaS de
8000-10000 px, un « milieu » unique reste un bloc énorme — exactement le
défaut que le découpage existe pour éviter (le modèle de vision écrase
l'image en la redimensionnant, le texte devient illisible, le rapport
devient vague). `calculer_segments()` découpe donc en tranches d'une hauteur
d'écran, et nomme la première `hero`, la dernière `bas`, et numérote le
reste `milieu-1`, `milieu-2`… Sur une page qui tient en une ou deux tranches,
le résultat correspond exactement aux trois segments demandés.

## Ce qui a été vérifié, et comment

**Les quatre URLs réelles n'ont pas pu être testées depuis cette session** —
et ce n'est pas propre à ces quatre sites. La politique réseau de cet
environnement bloque toute navigation vers un domaine arbitraire, vérifié
sur **quatre clients différents**, y compris le script lui-même :

| Client | Résultat sur `qonto.com` |
| --- | --- |
| `curl` | `CONNECT tunnel failed, 403` |
| `WebFetch` (service distinct d'Anthropic) | `EGRESS_BLOCKED` |
| `curl` sur `example.com`, `en.wikipedia.org`, `stripe.com` | même refus — ce n'est pas ciblé sur ces quatre sites |
| `capturer_page.py` (Chromium/Playwright, l'outil livré) | `net::ERR_TUNNEL_CONNECTION_FAILED` |

Le journal du mandataire confirme : `connect_rejected — organization policy`.
Ce n'est donc pas un problème de client (contrairement au piège `*.vercel.app`
déjà consigné dans `CLAUDE.md` §7, où seul `curl` passait) : ici, la politique
de l'environnement bloque la navigation générale vers l'internet public. Une
session future sur un environnement dont la politique réseau autorise ces
domaines — ou la machine du propriétaire — pourra lancer directement :

```bash
python3 audit-landing/capturer_page.py
```

**Ce qui a en revanche été vérifié, à l'œil, sur une page fabriquée
localement** (`http://127.0.0.1:8934/`, reproduisant les trois difficultés
nommées dans la consigne — bandeau de cookies fixe façon OneTrust, images en
lazy-loading sous la ligne de flottaison, trafic réseau perpétuel façon chat
en direct) :

- le bandeau de cookies est fermé par un vrai clic (pas seulement masqué) ;
- les 12 images de test passent de « en attente » à « chargées » après le
  scroll forcé (vérifié par script, pas seulement à l'œil : 12 → 0 en
  attente) ;
- le reliquat du bandeau de cookies (`position: fixed`) est bien masqué,
  absent de toutes les tranches ; un en-tête collant (`position: sticky`),
  lui, reste visible sur chaque tranche où il apparaît réellement au scroll —
  c'est le comportement voulu depuis le correctif ci-dessous, pas un oubli ;
- le script ne reste pas bloqué par le trafic réseau perpétuel : il capture
  en une dizaine de secondes grâce au délai de secours de 5 s, jamais au
  timeout par défaut de Playwright (30 s) ;
- les tranches produites sont nettes, correctement dimensionnées (2880×1800
  px à l'échelle 2, sauf la dernière), et couvrent toute la hauteur de la
  page sans trou ni chevauchement (garanti par `calculer_segments`, testé
  unitairement).

Trois fixtures supplémentaires ont servi à diagnostiquer et corriger le défaut
des tranches blanches sur `qonto.com/fr` — voir « Défaut corrigé » plus haut :
une grande section `position: sticky`, une section `content-visibility:
auto`, et une révélation au scroll réversible (opacity 0 → 1, la cause
réelle). Aucun des scripts de fixture n'est versionné ici (outils de test
ponctuels, pas des dépendances du produit) ; ils tiennent chacun en une page
dans l'historique de cette session si besoin de les rejouer.

## Tests

```bash
python3 -m unittest discover -s tests --verbose
```

Couvre uniquement la logique pure — `calculer_segments()` (découpage,
bornes, cas limites) et `nom_dossier_pour_url()` — sans navigateur ni réseau,
donc exécutable sur n'importe quel runner. La partie qui pilote réellement
Chromium (fermeture des bandeaux, scroll, capture) n'est pas testée
unitairement : c'est un parcours d'intégration, vérifié à l'œil ci-dessus
plutôt que simulé.

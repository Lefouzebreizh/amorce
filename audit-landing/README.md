# Audit de page de vente en 24h — capture visuelle

Brique de capture pour le futur produit « Audit de page de vente en 24h » :
transformer une URL en une poignée d'images nettes, prêtes à être montrées à
un modèle de vision — pas du texte brut. Juger l'ergonomie et le
copywriting *en contexte* demande de voir la page, pas d'en extraire les
mots.

**Ce dossier ne fait que ça : capturer et découper.** Le prompt d'analyse
d'image, la génération du rapport, la page de vente du produit et Stripe
viennent après — voir la consigne d'origine, pas encore commencée ici.

## Utiliser

```bash
pip install playwright Pillow   # PyPI est ouvert, pas besoin de plus
python3 capturer_page.py "https://exemple.com" --sortie captures/
```

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
3. **Masquage de tout ce qui reste en `position: fixed`/`sticky`** — bandeau
   qui a résisté au clic, bannière promo, chat en direct, en-tête collant.
   Nécessaire même après l'étape 2 : sans lui, ces éléments se dupliquent
   sur chaque tranche découpée, puisqu'un élément fixe apparaît à la même
   position d'écran à chaque « hauteur » de la page composite.
4. **Scroll progressif jusqu'en bas** (pas de 700 px, pause de 150 ms) pour
   déclencher le lazy-loading des images sous la ligne de flottaison —
   la plupart se chargent via `IntersectionObserver` et ne se déclenchent
   jamais si on ne scrolle pas jusqu'à elles.
5. **Attente de stabilité, deux fois** : `networkidle` ou 5 secondes de
   secours (ce qui arrive en premier), avant *et* après le scroll. Une page
   B2B avec chat en direct ou traqueurs ne devient parfois jamais inactive ;
   s'y fier seul bloquerait le script jusqu'au long timeout par défaut de
   Playwright.
6. **Une capture pleine page, puis un découpage en tranches d'une hauteur
   d'écran chacune** (1800 px physiques = 900 px logiques × échelle 2),
   nommées `hero` / `milieu` / `bas`.

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
- l'en-tête collant et le reliquat du bandeau sont bien masqués, donc absents
  de toutes les tranches — y compris de `01-hero.png`, ce qui est un
  compromis assumé : masquer *tout* élément fixe/collant avant la capture
  pleine page est ce qui évite sa duplication sur les tranches suivantes,
  au prix de sa disparition de la tranche où il apparaîtrait naturellement ;
- le script ne reste pas bloqué par le trafic réseau perpétuel : il capture
  en une dizaine de secondes grâce au délai de secours de 5 s, jamais au
  timeout par défaut de Playwright (30 s) ;
- les tranches produites sont nettes, correctement dimensionnées
  (2880×1800 px à l'échelle 2, sauf la dernière tranche partielle), et
  couvrent toute la hauteur de la page sans trou ni chevauchement (garanti
  par `calculer_segments`, testé unitairement).

Le script de la fixture n'est pas versionné ici (c'est un outil de test
ponctuel, pas une dépendance du produit) ; il tient en une page dans
l'historique de cette session si besoin de le rejouer.

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

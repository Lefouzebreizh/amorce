# Audit des dépendances — les paquets qui débloquent plusieurs choses d'un coup

*Mesuré le 01/09/2026, sur les dix-neuf projets du dépôt, un par un. Tout ce
qui suit a été exécuté, pas lu.*

Le modèle de cet audit est PyMuPDF : un paquet, quatre gestes de
`paper-manager` — lire le texte d'un PDF, rendre une page en image, remplir un
formulaire, l'aplatir. La question posée ici est donc : **où reste-t-il un
paquet de ce genre, et que coûte son absence ?**

## 1. Ce que la mesure dit d'abord : le dépôt est propre

Deux choses cherchées et **non trouvées**, ce qui vaut d'être écrit parce que
c'est la moitié de la réponse :

- **Aucun test ignoré.** Pas un `skipUnless`, pas un `pytest.mark.skip`, pas un
  `it.skip`. Ni en Python, ni en TypeScript. Rien ne dort derrière une
  condition.
- **Aucune garde d'import opportuniste.** Les trente `except ImportError` du
  dépôt sont toutes des replis délibérés, commentés, avec la commande qui les
  lève. C'est la discipline du §7 appliquée, et elle tient.

Le gisement n'était donc pas là où on le cherche d'habitude. Il est dans
l'**écart entre ce que le code importe et ce que les projets déclarent**.

## 2. Le chiffre : quatre paquets, +191 tests

Suites Python lancées dans une session distante nue, avant et après
installation. Rien d'autre n'a changé.

| Projet | Avant | Après | Ce qui manquait |
| --- | --- | --- | --- |
| `paper-manager` | 148 tests, **6 erreurs** | **259 tests, 0 erreur** | `pymupdf`, `pydantic` |
| `montage-auto` | 35 tests, **3 erreurs** | **76 tests, 0 erreur** | `numpy` |
| `kdp` | 23 tests, **4 erreurs** | **62 tests, 0 erreur** | `fitz`, `numpy`, `cv2` |
| **Total** | 1077 tests, 13 erreurs | **1268 tests, 0 erreur** | **+191 tests** |

Les six autres suites Python — `chat-traducteur`, `conseiller-patrimoine`,
`life-organizer`, `nexuscrypto`, `pepites`, `repondeur-facebook` — passent sans
rien installer. C'est la propriété « bibliothèque standard pure » de `CLAUDE.md`
§4, et elle est vraie.

**Treize modules de test ne se chargeaient même pas.** Pas un test rouge : un
`ImportError` au chargement, qui retire la suite entière du compte sans qu'aucun
verdict ne l'annonce. Une suite qui affiche « OK » sur 23 tests quand elle en
porte 62 est exactement le motif du §8 — *une mesure disait vert et le fichier
était faux*.

## 3. Les quatre trous, nommés

### a) `pydantic` — le seul vrai trou du dépôt, et il coûte 5 tests

`.github/requirements-tests.txt` le déclare. `paper-manager/requirements.txt` le
déclare. **Le hook de démarrage ne l'installe nulle part.** Son bloc
Paper-Manager (ligne 252) installe `PyMuPDF Pillow streamlit` et s'arrête là.

Conséquence exacte : la CI est verte, et `test_vision.py` — les cinq tests qui
gardent la forme de ce que rend le modèle de vision — ne tourne jamais dans une
session distante. C'est le cas que `requirements-tests.txt` décrit dans son
propre en-tête, retourné : ici c'est le hook qui est en retard sur la liste, pas
l'inverse.

### b) `pyloudnorm` — 20 Ko, et la mesure LUFS du dépôt est muette sans lui

Le plus intéressant des quatre, parce qu'il ne casse **aucun** test.

`montage-auto/sfx_pro.py:118` importe `pyloudnorm` dans un `try`, et son
`except Exception: return None` rend `None` en silence quand il manque. Mesuré
sur un sinus de 1 kHz à −12 dBFS, trois secondes :

```
LUFS sans pyloudnorm : None
LUFS avec pyloudnorm : -15.1
```

`pyloudnorm` n'est **ni** dans `montage-auto/requirements.txt`, **ni** dans
`.github/requirements-tests.txt`, **ni** dans le hook. La mesure de sonie du
dépôt ne tourne donc nulle part aujourd'hui, et elle ne le dit pas.

Ce que ça touche, au-delà d'un fichier : `CLAUDE.md` §2 pose
`/master-telephone` avant toute publication, et §8 exige « le niveau entendu
section par section ». Les deux reposent sur une fonction qui rend `None`.

C'est le paquet le plus proche du modèle PyMuPDF de tout cet audit : minuscule,
absent de partout, et il rend une capacité que le dépôt considère comme acquise.

### c) `kdp` et `visual_library` n'ont aucun manifeste

`kdp` importe `PIL` dans **26 fichiers**, `numpy` dans **19**, `fitz` dans
**14**, `cv2` dans 4, `segno` dans 1 — et ne porte pas de `requirements.txt`. La
liste vit en dur à la ligne 140 du hook et dans `requirements-tests.txt`, c'est-à-dire
à deux endroits dont aucun n'est le projet. Tout autre projet du dépôt
déclare chez lui ; ces deux-là dérogent.

**`visual_library` va plus loin : il n'existe pour personne.** 1109 lignes de
Python, cinq dépendances (`PIL`, `numpy`, `imagehash`, `imageio_ffmpeg`,
`tqdm`), **aucun test**, **aucun manifeste**, et **aucune mention dans
`CLAUDE.md` §4** — qui énumère pourtant tous les projets. Dernière touche : la
PR #449. Ce n'est pas une dépendance manquante, c'est un projet entier hors
inventaire.

### d) `fitz` était déprécié dans 14 fichiers de `kdp` — corrigé

PyMuPDF l'annonçait à chaque import :

```
warning: The `fitz` API is deprecated and will be removed in future.
Use `import pymupdf` instead.
```

Les 14 fichiers et leurs 156 références sont passés à `pymupdf`, le nom que
`paper-manager` employait déjà. Vérifié avant d'écrire plutôt qu'après : les dix
symboles que la chaîne utilise — `Rect`, `Point`, `Page`, `Document`, `Font`,
`Matrix`, `open`, `csGRAY` et les deux alignements — sont **les mêmes objets**
des deux côtés (`fitz.Rect is pymupdf.Rect`), donc aucun `isinstance` ne pouvait
basculer.

**Et le renommage a découvert une borne fausse, dans les deux projets.** Le
module `pymupdf` n'apparaît qu'en **1.24.3** : les roues 1.24.0, .1 et .2 ne
livrent que `fitz/`, vérifié en les téléchargeant toutes les quatre. Or les deux
manifestes disaient `PyMuPDF>=1.24`. `paper-manager` portait donc déjà le
défaut — il importe `pymupdf` dans 8 fichiers depuis toujours — et il ne s'est
jamais vu parce que pip installe la version la plus récente. Il se serait vu le
jour où quelqu'un épingle. Les deux bornes sont à `>=1.24.3`.

C'est la leçon du §7 sur les API tierces, appliquée à un renommage qui avait
l'air purement mécanique : **la surface réelle se lit, elle ne se suppose pas.**
Un `sed` bien écrit aurait laissé les deux bornes fausses derrière lui.

## 4. Côté JavaScript : Playwright tient à un fil

Neuf projets Node audités en croisant leurs imports et leurs `package.json`.
Trois écarts, tous sur la même bibliothèque.

| Projet | Importe | Déclare |
| --- | --- | --- |
| Amorce (racine) | `playwright` | **oui** — `^1.62.1` |
| `iptv` | `playwright` (`scripts/verifier-interface.mjs`) | **non** |
| `annuaire-ia` | `playwright`, `postcss`, `@tailwindcss/postcss` | **non — aucune dépendance déclarée du tout** |

`annuaire-ia/package.json` ne porte ni `dependencies` ni `devDependencies`,
alors que `verifier.mjs` conduit un vrai navigateur et que
`construire-styles.mjs` compile du Tailwind.

**Correction, apportée le jour même : ce n'est pas un oubli, c'est un choix, et
il est écrit dans le code.** Les deux fichiers chargent Playwright par un
`await import()` sous `try`, et leur message d'échec dit quoi faire :

```
Playwright est introuvable.
  Il vient des dépendances du dépôt : lancer `npm install` à la racine d'Amorce.
  Le navigateur, lui, est déjà là — ne pas lancer `playwright install`.
```

Playwright est **mutualisé à la racine, exprès**. Le déclarer dans les deux
projets installerait une seconde copie — et surtout une seconde *révision*,
alors que les deux fichiers gèrent explicitement le décalage entre la révision
qu'attend le Playwright de la racine et le Chromium préinstallé du conteneur.
Deux révisions en désaccord, c'est le téléchargement que la politique réseau
refuse, et qu'ils évitent tous les deux à la main.

C'est donc le §0 bis règle 4 qui s'applique — un doublon arrête le geste — et
la correction vaut d'être écrite parce que **c'est un croisement automatique
d'imports et de manifestes qui a produit le faux positif** : un `await import()`
sous `try` avec un message d'aide est indiscernable, pour un script, d'un import
oublié. La lecture du code les sépare en dix secondes ; le script, jamais.

Ce qui reste vrai, et qui ne demande rien : `cd iptv && npm ci` seul ne suffit
pas à lancer la vérification regardée. Mais ce n'est pas un défaut silencieux —
c'est un repli explicite qui nomme sa parade, le motif standard du dépôt.

## 5. Les fonctionnalités annoncées jamais commencées

Cinq relevées. **Aucune n'attend une bibliothèque** — et c'est la conclusion
utile, parce qu'elle évite d'aller en chercher une.

| Projet | Ce qui manque | Ce qui bloque vraiment |
| --- | --- | --- |
| `chat-traducteur` | intentions *faim* et *envie de sortir* | des **données** étiquetées. Zenodo (CatMeows) resondé : `000` |
| `iptv` | affiches et synopsis TMDB | une **clé**. `api.themoviedb.org` resondé : `000` |
| `iptv` | sous-titres SubDL | une **clé**, et une archive ZIP à ouvrir |
| `paper-manager` | gestes depuis le téléphone, relève de boîte mail | rien — c'est du code à écrire |
| `kdp` | planche page 15, *Le secret de l'hermine* | un **dessin**. La chaîne rend PUBLIABLE sans |

Les trois hôtes ont été resondés ce jour, par acquit de conscience du §7 (« un
blocage levé se reprend ») : `zenodo.org`, `api.themoviedb.org` et
`api.opensubtitles.com` rendent tous `000`. `pypi.org` répond `200`. Les README
disent vrai, rien à reprendre.

`annuaire-ia` est un cas à part : ce qui le bloque — 42 inscriptions
d'affiliation à ouvrir — n'est ni une bibliothèque ni une clé, et personne
d'autre que le propriétaire ne peut le faire.

## 6. Ce que cet audit n'a pas mesuré

À écrire, sinon la prochaine session lira ce rapport comme une couverture
complète :

- **Les suites JavaScript, elles, ont fini par être exécutées** — et cette
  ligne disait le contraire, ce qui la rendait fausse. Huit `npm install`, puis
  les dix-huit suites : **631 tests, 0 échec, 0 ignoré, 0 todo** (racine 267,
  iptv 155, agence 70, titan-builder 59, hypersensible 37, artisan-express 29,
  licence-serveur 14). Cela confirme **en exécutant** ce que le §1 n'avait fait
  que chercher : aucun test ignoré nulle part, JS compris.

  Les vérifications regardées passent aussi : `annuaire-ia` rend 213 contrôles
  sur 11 niches, `iptv` déroule son flux HLS réel et son mandataire signé, et
  Amorce donne **110/110** plus ses trois parcours annexes.

  Ce qu'il a fallu réparer pour y arriver est le sujet du §7 ci-dessous.
- **Look & Find n'a pas été touché.** Flutter est absent de la session.
- **Le hook n'a pas tourné ici** : ni `node_modules`, ni Flutter, ni `ffmpeg`,
  ni un seul paquet Python. C'est ce qui a rendu la mesure possible — un
  environnement nu est le seul endroit où l'on voit ce qui manque — mais cela
  veut dire que les 13 erreurs du §2 ne se voient pas dans une session où le
  hook a fait son travail. **Sauf `pydantic` et `pyloudnorm`, que le hook
  n'installe pas.** Ces deux-là manquent partout, tout le temps.

## 7. Ce que le montage de l'environnement JS a trouvé — 02/09/2026

Six défauts, tous du même motif que ceux du §3 : **une parade qui existe, mais
au mauvais endroit.**

| Où | Ce qui n'allait pas |
| --- | --- |
| `scripts/*.mjs` d'Amorce | sept scripts lançaient Chromium sans repli sur `/opt/pw-browsers` — `iptv` et `annuaire-ia` l'avaient tous les deux, Amorce non |
| `scripts/planche.mjs` | pire : il ne lisait **même pas** `AMORCE_CHROMIUM`. La copie avait dérivé |
| `iptv/scripts/verifier-interface.mjs` | annonçait « le reste, si » sans ffmpeg, puis lisait le `.m3u8` sans garde et tombait |
| `motion/package.json` | `remotion render` sans `--browser-executable` : la parade était dans `CLAUDE.md`, pas dans le code |
| `motion/tsconfig.json` | `typecheck` rouge sur `main` — le test importe `.ts`, indispensable à Node, refusé par `tsc` |
| `.github/requirements-tests.txt` | `imageio-ffmpeg` absent, donc le repli de `kits` ne pouvait pas jouer |

**Trois d'entre eux méritent d'être retenus nommément.**

*La copie dérive, et c'est mesurable.* Six scripts d'Amorce lisaient la
variable puis retombaient sur `undefined` ; le septième ne lisait rien. Une
règle recopiée sept fois s'était désynchronisée en silence. `scripts/chromium.mjs`
en fait un point unique — la raison écrite une fois, pas sept.

*Un plantage brut coûte trois fois.* En tombant sur le `.m3u8` manquant,
`iptv` laissait un `next start` orphelin que `ss` ne montrait pas — seul `curl`
le révélait. Les deux exécutions suivantes ont donc échoué sur « le port 3210
répond déjà », une cause qui n'était plus la vraie. Un seul défaut, trois
diagnostics.

*Le test qui garde un repli est le premier à tomber quand le repli n'est
déclaré nulle part.* `kits` a `imageio_ffmpeg` en repli de `ffmpeg`, et
`test_ffmpeg_a_bien_un_repli_lui` pour le garder. Le paquet n'étant dans aucune
liste, le runner sans ffmpeg faisait échouer exactement ce test-là. Invisible
en local, où le hook installe le paquet pour Life-Organizer.

**Et deux échecs n'étaient pas des défauts** : `agence` veut un `.env.local`
(des valeurs factices suffisent, le build ne joint jamais Supabase — le hook
l'écrit désormais), et `verify.mjs` réclamait `npm run dev` en le disant
clairement. Un message qui guide n'est pas une panne.

## La leçon, en une phrase

**Une dépendance déclarée à trois endroits est déclarée à zéro.** Le dépôt tient
ses listes dans le hook, dans `.github/requirements-tests.txt` et dans les
`requirements.txt` des projets — et les trois se sont désynchronisées sans
qu'aucun test ne rougisse, parce qu'un module de test qui ne se charge pas ne
compte pas comme un échec. Le seul endroit qui ne ment pas est ce que le code
`import`.

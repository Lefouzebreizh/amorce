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

- **Les suites JavaScript n'ont pas été exécutées.** Aucun `node_modules` dans
  cette session, et neuf `npm install` coûtaient plus que ce qu'ils auraient
  appris — les écarts du §4 se lisent dans les manifestes. Ce qui reste non
  mesuré : combien de tests JS s'ouvriraient réellement.
- **Look & Find n'a pas été touché.** Flutter est absent de la session.
- **Le hook n'a pas tourné ici** : ni `node_modules`, ni Flutter, ni `ffmpeg`,
  ni un seul paquet Python. C'est ce qui a rendu la mesure possible — un
  environnement nu est le seul endroit où l'on voit ce qui manque — mais cela
  veut dire que les 13 erreurs du §2 ne se voient pas dans une session où le
  hook a fait son travail. **Sauf `pydantic` et `pyloudnorm`, que le hook
  n'installe pas.** Ces deux-là manquent partout, tout le temps.

## La leçon, en une phrase

**Une dépendance déclarée à trois endroits est déclarée à zéro.** Le dépôt tient
ses listes dans le hook, dans `.github/requirements-tests.txt` et dans les
`requirements.txt` des projets — et les trois se sont désynchronisées sans
qu'aucun test ne rougisse, parce qu'un module de test qui ne se charge pas ne
compte pas comme un échec. Le seul endroit qui ne ment pas est ce que le code
`import`.

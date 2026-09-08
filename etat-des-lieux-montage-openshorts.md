# Rapprocher le montage d'Amorce du niveau CapCut — état des lieux et plan

*Écrit le 08/09/2026, avant toute ligne de code. Sources lues : le dépôt
d'Amorce, et OpenShorts (mutonby/openshorts, MIT, commit `5a6f428`, cloné en
local et non versionné ici).*

**But à terme** : qu'un rush tourné à l'horizontale sorte d'Amorce cadré sur ce
qui compte et sous-titré sur ce qui est dit — pas centré au hasard et rythmé au
métronome.

---

## 1. Ce que le dépôt a déjà, et qui est meilleur que je ne le croyais

| Brique | Où | Ce qu'elle fait vraiment |
| --- | --- | --- |
| Chemin de rendu unique | `src/lib/renderer.ts` | `renderFrame` est le seul à savoir à quoi ressemble une image ; aperçu **et** export l'appellent. Toute correction de cadrage se pose là et vaut pour les deux. |
| Décalage horizontal par image | `src/lib/renderer.ts` | `transform.dx` **existe déjà** et sert aux mouvements `pan`. Le mécanisme d'un recadrage qui suit un sujet est donc en place ; personne ne l'alimente. |
| Cinq styles de sous-titre | `src/lib/captions.ts` | Contour, ombre, halo néon, capitales, surlignage karaoké. Le tracé est soigné. |
| Bande sûre mesurée | `src/lib/captions.ts` | 12–45 % de la hauteur, relevé sur captures réelles des trois plateformes, jamais déduit des chartes. OpenShorts n'a pas d'équivalent : il pose ses sous-titres au centre bas. |
| **Calage des mots sur le signal** | `src/lib/voice.ts` | `rmsEnvelope` → `speechSegments` → `alignWords` rend des `TimedWord { text, start, end }`. Enveloppe d'énergie + répartition au prorata des syllabes. Sans modèle, sans réseau, en bibliothèque standard. |
| Détection des manques | `src/lib/manques.ts` | Repère accroche faible, plan qui dort, miniature absente. |
| Notation de structure | `src/lib/analysis.ts` | Rythme des coupes, force du hook, tension, couverture texte. |

**La conclusion qui compte : nous ne partons pas de zéro sur les sous-titres qui
suivent la parole. Le calcul existe.**

---

## 2. Ce qui manque, précisément

### 2.1 Le recadrage est centré, en dur, pour toute la durée du plan

`src/lib/renderer.ts`, dans `drawClipLayer` :

```ts
const cover = Math.max(OUTPUT_WIDTH / vw, OUTPUT_HEIGHT / vh) * transform.scale;
const x = (OUTPUT_WIDTH - width) / 2 + transform.dx;
```

Sur un rush 1920 × 1080 ramené en 1080 × 1920, le recouvrement jette **65 % de
la largeur** et garde le milieu. Un sujet dans le tiers gauche sort du cadre, et
rien dans le moteur ne peut le savoir : `grep` sur `face`, `visage`,
`mediapipe`, `detector`, `saillance` rend **zéro** dans tout `src/`.

**Pourquoi personne ne l'avait vu, et c'est mesuré** : `scripts/make-fixtures.mjs`
fabrique tous ses rushes en 9:16 — 540 × 960, ou 1080 × 1920 pour les images.
Le matériel d'épreuve du dépôt n'a **jamais eu de côtés à perdre**. C'est
exactement le cas qu'OpenShorts documente en tête de ses modes de recadrage :
une source déjà verticale passe sans être touchée. Six mesures vertes, et le
défaut hors de leur portée.

### 2.2 Le karaoké est un métronome, et l'information juste est jetée trois lignes plus haut

`src/lib/captions.ts` :

```ts
export function activeWordIndex(caption: Caption, time: number, wordCount: number): number {
  const progress = (time - caption.start) / span;
  return Math.min(wordCount - 1, Math.max(0, Math.floor(progress * wordCount)));
}
```

Division égale : chaque mot reçoit la même tranche, qu'il dure un dixième ou une
seconde. C'est le point faible que tu décris.

**Et le défaut n'est pas un manque, c'est une perte.** `captionsFromVoice`, dans
`src/lib/voice.ts`, calcule le vrai `start` et le vrai `end` de chaque mot, puis
les jette en aplatissant le bloc :

```ts
return groupIntoBlocks(words, options).map((block) => ({
  text: block.map((word) => word.text).join(' '),   // ← les instants meurent ici
  start: offset + block[0].start,
  end: offset + block[block.length - 1].end,
}));
```

Le type `Caption` (`src/lib/types.ts`) n'a aucun champ pour porter des mots
datés, alors le tracé les réinvente. **Le calage exact existe, traverse une
frontière de type, et n'arrive jamais à l'écran.**

### 2.3 Ce qui manque pour de bon

- **Aucun détecteur de sujet** dans le navigateur. C'est le seul vrai trou.
- **Aucun découpage de scène** à l'intérieur d'un rush (`scene_detection.py`
  chez eux). Amorce coupe où l'utilisateur coupe.
- **Aucune transcription d'une voix qu'on n'a pas écrite.** `voice.ts` cale un
  texte **connu** sur un signal ; il ne sait pas ce que dit un rush filmé.

---

## 3. Ce qu'OpenShorts sait faire, et ce qui est transposable

Leur pipeline est **Python + FFmpeg + MediaPipe, côté serveur**. Le nôtre est
**navigateur seul, canvas + WebCodecs, sans serveur**. Aucune ligne ne se
reprend telle quelle, et une dépendance externe est exclue : elle casserait
l'invariant fondateur d'Amorce.

Mais leur **arithmétique** se transpose intégralement, et elle est bonne.

| Chez eux | Transposable ? | Ce qu'on en garde |
| --- | --- | --- |
| `SmoothedCameraman` (« trépied lourd »), `main.py` | **oui, entièrement** | ~100 lignes de calcul pur sur un centre horizontal. Zone morte à 25 % de la largeur de crop ; en dessous, la caméra ne bouge pas. Vitesse 3 px/image, 15 px/image au-delà d'un demi-cadre d'écart. Remise à zéro à chaque coupe. |
| `JUMP_CONFIRM_FRAMES = 3` | **oui** | Un grand saut doit se **répéter trois fois** avant d'être suivi. Leur commentaire porte la mesure qui le justifie : sur des rushes réels, **22 % des mises à jour de cible sautaient plus loin que toute la zone morte** — presque toutes des erreurs de détecteur. C'est ce réglage-là qui sépare une caméra qui suit d'une caméra qui balaye. |
| `normalise_activity` (`active_speaker.py`) | **oui** | L'activité de bouche doit être normalisée **par locuteur** avant comparaison : l'amplitude brute suit le contraste local, et sans normalisation un vrai plan à deux donnait 90–100 % de la scène au même. |
| Le choix de disposition par 12 images à 1024 px | **oui, comme principe** | Ils demandent au modèle un **choix entre options fermées**, jamais une mesure. Quatre tentatives de mesure continue avaient échoué avant. Vaut pour nous le jour où un modèle entre dans la boucle. |
| Sous-titres ASS, `{\an5}` sur la couture | non | Nous traçons au canvas ; mais l'idée — poser le texte là où il ne couvre personne — se garde. |
| MediaPipe / YOLOv8, FFmpeg filtergraph | **non** | Substrat incompatible. |

---

## 4. La seule vraie fourche, et elle est pour toi

Le calcul du cadrage est portable. **Le détecteur, non.** Trois chemins, et ils
ne coûtent pas la même chose sur un Redmi Note 12 Plus :

| Chemin | Poids à télécharger | Ce qu'il donne | Ce qu'il coûte |
| --- | --- | --- | --- |
| **A. Saillance sans modèle** — énergie de mouvement + contraste + teinte chair, au canvas | **0 octet** | Un centre d'intérêt par image, honnête sur un sujet qui bouge, faible sur un sujet immobile | Rien à installer, tourne partout, se teste par `npm test` |
| **B. MediaPipe Tasks Vision (WASM)** | ~3 Mo + modèle | De vraies boîtes de visage, ce qu'OpenShorts utilise | Un téléchargement au premier usage. Précédent dans le dépôt : `chat-traducteur/web` embarque déjà 16 Mo de WASM |
| **C. `FaceDetector` du navigateur** | 0 | — | **Écarté** : jamais sorti de derrière un drapeau, absent de Chrome Android |

**Ma recommandation : A d'abord, B ensuite si A ne suffit pas.** Parce que le
cadrage se juge à l'œil et que A se livre en une nuit sans rien télécharger, ce
qui permet de **regarder** avant de payer 3 Mo. Et parce que la partie qui fait
vraiment la différence n'est pas le détecteur : c'est le trépied lourd. Un bon
détecteur derrière une caméra nerveuse donne un résultat pire qu'une saillance
approximative derrière une caméra qui ne bouge presque jamais.

---

## 5. Le plan, étape par étape

Cinq lots. Chacun tient debout seul, se vérifie, et se fusionne avant le suivant.

### Lot 1 — Les mots datés arrivent jusqu'à l'écran *(le moins cher, le plus visible)*

Ne demande **aucun** détecteur et corrige un défaut dont le calcul est déjà fait.

1. `src/lib/types.ts` — `Caption` reçoit un champ optionnel `mots?: { text, start, end }[]`.
2. `src/lib/voice.ts` — `captionsFromVoice` cesse de jeter les `TimedWord`.
3. `src/lib/captions.ts` — `activeWordIndex` lit `mots` s'ils sont là, et garde
   la division égale sinon. Aucun sous-titre écrit à la main ne change de
   comportement.
4. Un test qui refuse la régression : sur une voix où un mot dure quatre fois
   plus qu'un autre, le surlignage doit s'y attarder quatre fois plus.

**Ce que ça donne à l'écran** : le karaoké suit la voix off au lieu de la
survoler. Sur un rush filmé, rien ne change encore — c'est le lot 5.

### Lot 2 — Le recadrage cesse d'être centré

1. `src/lib/cadrage.ts`, neuf : le trépied lourd, porté en TypeScript. Pur,
   sans dépendance, testable — zone morte, confirmation de saut, deux vitesses,
   remise à zéro à la coupe. Entrée : une suite de centres par image. Sortie :
   une trajectoire lissée.
2. `src/lib/renderer.ts` — une seule ligne change : `x` prend la trajectoire au
   lieu du milieu. Le chemin de rendu reste unique, l'invariant n°1 tient.
3. `scripts/make-fixtures.mjs` — un rush **paysage** avec un sujet décentré qui
   traverse. Sans lui, aucun test de ce dépôt ne peut voir le défaut.

### Lot 3 — Quelque chose à suivre

Le chemin A du §4 : `src/lib/saillance.ts`, énergie de mouvement et contraste,
un centre d'intérêt par image échantillonnée. Branché sur le lot 2.

### Lot 4 — On regarde, et on tranche

Une planche avant/après sur un vrai rush 16:9, et **c'est là qu'on décide** si
la saillance suffit ou si MediaPipe se justifie. Pas avant : le §8 du dépôt dit
que ça se regarde, pas que ça se mesure.

### Lot 5 — Les sous-titres d'un rush filmé

Le seul lot qui demande une brique absente : transcrire une voix qu'on n'a pas
écrite. `sherpa-onnx` est déjà la parade retenue par le dépôt pour la voix off
(§7), et les modèles se prennent en release GitHub. À rouvrir une fois les
quatre premiers livrés — et pas avant, parce qu'il pèse plus que les quatre
autres réunis.

### ViralMint — après, et il me manque une adresse

Secondaire, comme tu l'as dit. La recherche GitHub est fermée à cette session
(« sessions are bound to their configured repositories ») : je peux lire
n'importe quel dépôt public dont on me donne le chemin, pas en chercher un.
**Donne-moi `proprietaire/depot` ou l'URL et je le lis.**

---

## 6. Le prérequis que je ne peux pas lever : l'essai MiniMax

Tu as posé l'essai de génération de bout en bout avant cette mission. Il ne peut
pas se faire ici, et voici l'état exact, resondé aujourd'hui :

| Ce qu'il faudrait | État |
| --- | --- |
| Une clé MiniMax | **absente** — aucune variable dans l'environnement |
| Joindre MiniMax | **impossible** — les cinq hôtes rendent `000`, le tunnel est refusé avant toute requête HTTP |
| Une grille de prix | **vide à dessein** — donc le service refuse toute génération, par construction |
| Dépenser | **c'est ton geste**, pas le mien (§5) |

Ce qui le débloquera : la clé, en secret GitHub pour le runner du dépôt — qui a
du vrai réseau, mesuré le 04/09 — et les prix relevés à leur source. Tant que
c'est ouvert, la partie montage avance sans en dépendre : elle ne touche ni au
réseau, ni à l'argent.

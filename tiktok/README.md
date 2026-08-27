# Le volet TikTok

Percer sur TikTok en apprenant le montage — et en le montrant.

Ce dossier ne contient pas de code. Il contient ce qui se décide **avant**
d'ouvrir un logiciel : le concept, puis le script. Le montage vient après, et
c'est le studio Amorce, à la racine de ce dépôt, qui s'en charge.

```
tiktok/
  README.md          la méthode — ce fichier
  concepts.md        les huit formats répétables, et lequel choisir
  modele-script.md   le gabarit vierge à recopier
  scripts/           les scripts écrits, prêts à tourner
  carnet.py          fabrique le PDF qu'on emporte en tournage
```

## Le carnet

```bash
python3 tiktok/carnet.py      # → .fixtures/carnet-tiktok.pdf
```

Tout ce dossier, en un PDF au format d'un téléphone : c'est la seule forme qui
serve une main tenant déjà une caméra. Il se **régénère**, il ne se corrige
pas — les Markdown ci-dessus font foi, sans quoi les deux divergent dès la
première retouche et plus personne ne sait lequel dit vrai. Le fichier produit
n'est pas versionné : le dépôt ne porte aucun binaire.

## La ligne

Deux sujets, et ils se tiennent :

- **Créer avec l'IA.** Ce que tu fabriques, comment, et ce qui rate. C'est le
  sujet qui va chercher des gens qui ne te connaissent pas.
- **Le défi.** Tu apprends le montage en public. C'est le sujet qui transforme
  un passant en abonné.

Le premier sans le second, c'est une chaîne de tutoriels de plus — utile,
oubliable. Le second sans le premier, c'est un journal intime : personne ne
s'abonne à la progression de quelqu'un dont il ne sait pas ce qu'il fabrique.

**Deux démonstrations pour un épisode de feuilleton.** C'est le seul dosage à
tenir. Un feuilleton ne se regarde que par ceux qui suivent déjà ; une
démonstration se regarde par tout le monde et ramène du monde au feuilleton.

## Ce qu'on tourne, et rien d'autre

Deux dispositifs, choisis parce que tu les tiendras :

| Dispositif | Ce que c'est | Ce que ça coûte |
| --- | --- | --- |
| **Voix off sur images** | Tu parles par-dessus des rushes, des illustrations, des captures | Une prise de voix, aucune mise en scène |
| **Capture d'écran** | Ton écran pendant que tu montes, que tu écris, que tu génères | Rien : tu enregistres pendant que tu travailles de toute façon |

Ni face caméra, ni décor, ni lumière. Ce n'est pas un renoncement : c'est ce
qui fait qu'une vidéo se tourne le mardi soir plutôt que « le week-end
prochain ». Le jour où le face caméra te démangera, il sera là — il ne sera
pas la condition pour publier.

Et la capture d'écran a un avantage que rien ne remplace : **la preuve est à
l'image**. Personne ne discute une timeline qu'on voit bouger.

## Comment un script s'écrit ici

**Les trois premières secondes ne sont pas le début : elles sont tout.** Le
spectateur ne choisit pas de regarder, il choisit de ne pas passer. C'est aussi
la fenêtre que mesure la note de viralité d'Amorce — `HOOK_WINDOW = 3` dans
`src/lib/analysis.ts`, et le hook y pèse 30 points sur 100. Ce n'est pas un
hasard de configuration, c'est la même observation.

**Ça s'écrit pour l'oreille.** Un script se lit à voix haute avant d'être
validé. Une phrase qui bute à l'oral bute aussi au montage, et il est trop tard
pour s'en apercevoir avec le micro allumé. Les respirations se marquent.

**Une seule idée par vidéo.** Deux idées, c'est deux vidéos. La deuxième te
fera gagner une journée de tournage le jour où tu seras à sec.

**On ferme la boucle qu'on a ouverte.** Une accroche qui promet et une vidéo
qui ne donne rien, c'est un abonné perdu pour de bon — plus sûrement qu'une
vidéo tiède.

**Les crochets sont à toi.** Comme dans `src/lib/hooks.ts`, `[90 jours]`,
`[400 vues]`, `[trois semaines]` marquent ce que personne ne peut écrire à ta
place : tes chiffres, tes délais, tes décisions. Un script qui part au tournage
avec un crochet non rempli est un script pas fini.

## Le parcours d'une vidéo

1. **Choisir un concept** dans `concepts.md`. Pas une idée : un concept, c'est
   un format qui tiendra vingt fois.
2. **Écrire le script** en recopiant `modele-script.md`. Le lire à voix haute.
3. **Tourner** — la voix, ou l'écran, ou les deux.
4. **Monter dans Amorce** : `npm run dev`, on dépose, *Montage express*, puis
   on retouche. L'étape 6 donne la note et dit ce qui décroche.
5. **Publier**, et noter ce que ça a fait en bas du script.

Ce dernier point est le seul qui rende le reste utile. Un script sans son
résultat, c'est une intuition ; avec son résultat, c'est une leçon.

## Les sept scripts écrits

Ils couvrent les concepts les plus productifs, et se tournent tous avec les deux
seuls dispositifs ci-dessus.

| Script | Concept | Durée | Sans montage |
| --- | --- | --- | --- |
| `01-je-ne-sais-pas-monter` | B4 — l'épisode qui ouvre le feuilleton | 24 s | oui |
| `07-je-construis-mes-outils` | B1 / A1 — le blocage comme matière | 32 s | oui |
| `02-le-son-avant-l-image` | A1 — le réglage que je n'avais pas compris | 30 s | non |
| `03-meme-rush-deux-montages` | A2 — même rush, deux montages | 32 s | non |
| `04-le-grave-que-ton-telephone-n-entend-pas` | A3 — le son que personne n'entend | 34 s | oui |
| `05-les-chiffres-du-jour-15` | B1 — les chiffres du jour N | 30 s | non |
| `06-trois-prompts-un-plan` | A4 — trois prompts, un plan | 32 s | non |

La mention « sans montage » compte : **trois d'entre eux se tournent avant de
savoir monter.** Le 01 et le 07 ne demandent que ta voix, tes images et ton écran ; le
04 se démontre au son. Les quatre autres attendent que tu aies une timeline —
c'est normal, ils parlent de montage.

Dans l'ordre, ils font une première quinzaine cohérente : le 01 ouvre, le 07
explique le retard sans s'en excuser, le 02 tient la promesse que le 01 a faite,
et le 05 revient dire ce que tout ça a donné.

## Ce qu'on ne fait pas

- **Pas d'accroche qui ment.** « Attends la fin » sur une vidéo sans fin, ça
  marche une fois, et ça coûte la deuxième.
- **Pas de tendance qu'on ne comprend pas.** Un son qui tourne et qui ne dit
  rien de toi ramène des vues qui ne reviennent pas.
- **Pas de rafale d'emoji, pas de rythme ternaire, pas de « dans un monde
  où ».** La charte éditoriale en tient la liste ; elle vaut ici mot pour mot.
- **Rien sur ta vie privée qu'on écrirait à ta place.** Le défi se raconte, pas
  l'intime.

## Ce que ce dossier ne sait pas

Il ne sait pas ce que l'algorithme récompense **cette semaine**, ni combien de
vues font tes vidéos, ni quel concept te ressemble une fois à l'écran. Ces
choses-là s'apprennent en publiant, et se notent au fil des scripts.

Ce qu'il sait, c'est ce qui ne bouge pas : l'attention se gagne dans les trois
premières secondes, une histoire commencée réclame sa fin, et un haut-parleur
de téléphone ne descend pas sous 400 hertz.

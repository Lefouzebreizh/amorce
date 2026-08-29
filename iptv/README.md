# IPTV / VOD — gestion et lecture

Tableau de bord pour ses propres abonnements IPTV : une liste **M3U / M3U8** ou
un panneau **Xtream Codes** entre, et il en ressort une navigation utilisable —
direct, films, séries par saisons — avec recherche, filtres de langue à priorité
francophone, favoris, guide des programmes et lecteur HLS.

Ce dossier ne contient **aucune source de contenu** : ni liste, ni identifiants,
ni adresse de fournisseur. Ce qu'on y branche vient de l'abonnement de celui qui
s'en sert, et n'en sort pas — `.env` et les listes locales sont ignorés par Git.

## Où en est le projet

Le **cœur d'ingestion**, le **cache** et l'**interface** sont écrits et
vérifiés : lecture d'une liste M3U en flux, client Xtream, normalisation,
écriture en base avec recherche plein texte, une application Next.js 16 avec
grilles filtrables, fiches de séries, recherche, favoris, reprise de lecture et
lecteur HLS, le **guide des programmes** en XMLTV, et la **recherche de
sous-titres externes** — écrite, testée, et en sommeil tant qu'aucune clé
d'API n'est posée.

**Mesuré sur une liste de 120 000 entrées** (15 Mo, fabriquée pour l'occasion,
jamais versionnée) : import en **6,6 s**, 135 Mo de mémoire de crête, base de
47 Mo. Toutes les requêtes que l'interface fera répondent **sous 30 ms** —
recherche 13 ms, grille filtrée 16 ms, épisodes d'une série 29 ms.

```
iptv/
├── src/
│   ├── domaine/          ← le modèle, et rien d'autre
│   │   ├── types.ts        Element, FicheSerie, Langue, Qualite, Genre
│   │   └── identite.ts     l'identifiant stable des favoris et du cache
│   ├── flux/
│   │   └── lignes.ts       découpage en lignes borné en mémoire
│   ├── ingestion/
│   │   ├── m3u.ts          analyseur M3U étendu, au fil de l'eau
│   │   └── xtream.ts       client Xtream Codes, tolérant aux panneaux
│   ├── epg/
│   │   └── xmltv.ts        guide des programmes, au fil de l'eau lui aussi
│   ├── sous-titres/
│   │   ├── conversion.ts   encodage réel, puis SRT vers WebVTT
│   │   └── fournisseurs.ts l'interface, et OpenSubtitles derrière
│   ├── cache/
│   │   ├── schema.ts       les tables, et les décisions qu'elles portent
│   │   ├── depot.ts        tout le SQL, et rien que là
│   │   └── importer.ts     source → normalisation → base, en flux
│   ├── serveur/
│   │   ├── depot-partage.ts une seule ouverture de la base pour l'application
│   │   └── flux.ts         le mandataire, et pourquoi ses adresses sont signées
│   ├── app/                ← Next.js 16 : les écrans et les routes d'API
│   ├── composants/         ← lecteur HLS, grille, filtres, navigation
│   ├── cli.ts              de quoi regarder ce que ça fait sans navigateur
│   └── normalisation/
│       ├── titre.ts        nettoyage du titre, année, étiquettes
│       ├── etiquettes.ts   langue et définition à partir des étiquettes
│       ├── episode.ts      saison et épisode, cinq écritures reconnues
│       ├── genre.ts        direct / film / série
│       └── normaliser.ts   le seul endroit qui fabrique un Element
├── scripts/
│   └── verifier-interface.mjs  Chromium réel, flux HLS réel
└── tests/                ← une suite par module, sans réseau
```

Ce que la suite ajoutera, aux mêmes endroits :

## Y accéder : sur quelle machine, et depuis quoi

**Cette application n'est hébergée nulle part, et c'est voulu.** Elle lit vos
identifiants d'abonnement et votre historique de lecture ; les mettre sur un
serveur en ligne serait la seule vraie mauvaise idée du projet. Elle tourne donc
sur une machine à vous — un ordinateur, ou un petit serveur allumé le soir.

```bash
cd iptv && npm ci
npm run iptv -- importer ma-liste.m3u
npm run dev
```

Next affiche alors deux adresses. **C'est la seconde qui compte** :

```
- Local:        http://localhost:3000        ← seulement sur cette machine
- Network:      http://192.168.1.20:3000     ← depuis le téléphone, la tablette,
                                               la télévision
```

Le serveur écoute volontairement sur toutes les interfaces (`--hostname
0.0.0.0`), sans quoi rien d'autre que la machine elle-même ne verrait
l'application. **Conséquence à connaître : n'importe qui sur votre wifi peut
l'ouvrir.** Il n'y a pas de mot de passe — pour un réseau domestique c'est le
bon compromis, sur un wifi partagé ce n'en est pas un.

## S'en servir tout de suite

```bash
npm run iptv -- importer ma-liste.m3u     # un fichier, ou une URL
npm run iptv -- epg guide.xml.gz          # le guide, .gz accepté
npm run dev                                # puis http://localhost:3000
```

Les autres commandes, quand on veut voir sans ouvrir de navigateur :

```bash
npm run iptv -- resume      # ce que le cache contient
npm run iptv -- chercher kaamelott
npm run iptv -- groupes
npm run iptv -- series
npm run iptv -- grille      # ce qui passe en ce moment
```

La base atterrit dans `donnees/iptv.db`, ignoré par Git. La ligne de commande
n'est pas un confort : tant qu'il n'y a pas d'écran, c'est le seul moyen de
**regarder** ce que le cœur fait d'une vraie liste plutôt que de le déduire
d'une suite de tests verte. Elle a déjà servi à cela — voir plus bas.

## Vérifier

```bash
cd iptv
npm ci
npm test          # 56 tests, sans réseau ni navigateur
npm run check     # typage
npm run build     # ce que tsc ne voit pas d'une application App Router
npm run verify    # Chromium réel, flux HLS fabriqué par ffmpeg
```

`npm run verify` n'est **pas** dans l'intégration continue, et c'est délibéré :
Playwright vit dans les dépendances de la racine du dépôt, que la CI d'IPTV
n'installe pas. Il se lance à la main avant de livrer un changement d'interface,
et il monte tout ce qu'il faut — un flux HLS fabriqué par ffmpeg, un serveur
d'origine **sans en-tête CORS** (c'est ce qui rend le mandataire nécessaire, et
donc vérifiable), un catalogue jetable, l'application au format du terrain de
référence.

Aucune dépendance d'exécution : le cœur tourne en bibliothèque standard. Les
tests lisent le TypeScript directement (`--experimental-strip-types`), d'où
`erasableSyntaxOnly` dans `tsconfig.json` — le réglage qui empêche d'écrire du
TypeScript que Node ne saurait pas retirer.

## Les décisions qui tiennent le projet

**Une liste M3U ne se charge jamais en mémoire.** Une liste française courante
pèse de 50 à 400 Mo ; `await reponse.text()` puis `.split('\n')` en demande deux
à trois fois autant et fait tomber le processus avant la première entrée.
`analyserM3U` est donc un générateur asynchrone : il rend les entrées au fil de
l'eau, et un test le prouve en lui donnant une source infinie.

**Rien ne remonte au-dessus de l'ingestion sans être un `Element`.** M3U et
Xtream ne se ressemblent pas ; si chacun gardait sa forme, la recherche, les
favoris et les filtres seraient écrits deux fois et divergeraient. Un seul
module fabrique des `Element`, et l'interface ne saura jamais d'où ils viennent.

**Une série n'est pas un `Element`.** Elle n'a pas d'URL — ses épisodes en ont
une. Lui en donner une vide ferait qu'un clic ouvrirait un lecteur sur rien, et
le défaut ne se verrait qu'à l'exécution. `FicheSerie` est un type à part : ici
le défaut ne compile pas.

**L'identifiant Xtream se calcule sur l'adresse de base, jamais sur l'URL de
lecture.** Celle-ci porte le mot de passe : un changement de mot de passe
effacerait tous les favoris. Pour une liste M3U, en revanche, l'URL est la seule
chose stable — un fournisseur qui change ses adresses fait perdre les favoris,
et c'est le prix du format.

**Le mot de passe voyage dans l'URL, c'est le protocole qui le veut.** Tout
message d'erreur passe donc par `masquerIdentifiants`, y compris celui d'une
erreur réseau — sans quoi le premier journal serveur venu conserve les
identifiants du fournisseur en clair. Deux tests le vérifient.

**L'étiquette de l'élément l'emporte sur le nom du groupe.** Un groupe
`SERIES VF` contient aussi des épisodes sous-titrés ; peser les deux également
faisait ressortir `multi` pour un fichier qui n'a qu'une piste, et un
spectateur filtrant sur `vf` tombait sur du sous-titré.

**Le mot de passe n'entre jamais en base.** L'adresse d'une source est
enregistrée sous sa forme masquée ; un réimport reçoit l'adresse réelle en
argument, depuis `.env`. La base peut donc être copiée, sauvegardée ou envoyée
en pièce jointe sans livrer l'abonnement de personne.

**Favoris et positions de lecture ne référencent pas le catalogue.** Un
fournisseur retire un film une semaine puis le remet ; avec une clé étrangère en
cascade, le réimport effacerait le favori au premier retrait. Ce que
l'utilisateur a marqué lui appartient et survit au catalogue — quitte à
désigner, un temps, une entrée absente. Un test le vérifie sur le cycle complet.

**Un import partiel ne purge pas.** Charger les épisodes d'une seule série
— ce que fait l'application à l'ouverture d'une fiche — retirerait sinon les
40 000 autres entrées de la même source, qui n'ont simplement pas été revues.
L'application se viderait sur un clic, sans la moindre erreur.

**Une télévision ne reçoit pas l'image, elle va la chercher.** C'est ce qui
explique toute la forme du bouton « Diffuser ». Trois conséquences, et chacune
casse la diffusion si on l'ignore :

- **L'adresse envoyée doit être absolue et joignable depuis le salon.** Elle est
  calculée depuis l'adresse de la page — si le téléphone est arrivé par
  `http://192.168.1.20:3000`, c'est exactement ce que la télévision utilisera.
  Rien à configurer côté serveur, ce qui serait faux dès qu'une machine a deux
  cartes réseau. Ouvrir l'application par `localhost` empêche la diffusion, et
  l'interface le dit au lieu de laisser un écran noir : pour un Chromecast,
  « localhost » désigne le Chromecast.
- **Ce que le navigateur fabrique ne se diffuse pas.** hls.js assemble la vidéo
  dans la page ; ce flux-là n'a pas d'adresse. Diffuser détruit donc la
  bibliothèque **avant** de poser la source directe — l'ordre compte, sinon elle
  reprend la main et écrase l'adresse qu'on vient d'écrire. Un Chromecast lit le
  HLS nativement, il n'a besoin de rien d'autre.
- **Le bouton n'apparaît que si un appareil est visible.** `RemotePlayback`
  réclame un contexte sécurisé et n'est pas exposée partout ; plutôt que de
  deviner la règle, on interroge l'objet, on écoute la disponibilité, et on
  explique quand il manque quelque chose.

**Le mandataire de flux n'accepte pas d'URL arbitraire.** Un relais qui prend
une adresse en paramètre est un *proxy ouvert* : n'importe qui s'en sert pour
atteindre, depuis cette machine, le réseau local ou les métadonnées d'un
hébergeur. Deux entrées seulement : un identifiant du catalogue, ou une adresse
**signée** — et seules les réécritures de manifeste en produisent. La
vérification tente une signature falsifiée et attend un 403.

**Le manifeste est réécrit, pas seulement relayé.** Relayer le manifeste sans
toucher à son contenu ne sert à rien : le lecteur irait ensuite chercher les
segments en direct chez le fournisseur, et buterait sur le même refus CORS. Les
trois formes d'adresse d'un HLS sont réécrites, `URI="…"` compris — c'est là que
vivent les pistes audio séparées, donc la version française.

**Tout l'arbre est rendu à la demande.** Next pré-rend par défaut ce qu'il peut
au build ; ici cela n'a aucun sens, la base n'existe pas encore à ce
moment-là — le build échouait d'ailleurs franchement, ce qui vaut mieux qu'une
page figée sur l'état d'un soir.

**Le guide se lit au fil de l'eau, avec un analyseur écrit à la main.** Un
XMLTV français couvre deux semaines sur trois cents chaînes : 50 à 200 Mo,
plusieurs millions de nœuds. Toute bibliothèque XML en construit l'arbre —
c'est son métier — et l'arbre ne tient pas. Or on ne lit ce fichier qu'une
fois, du début à la fin, pour le verser en base.

**Un instant XMLTV sans décalage horaire n'est pas de l'UTC.** Le format rend
le décalage facultatif ; un guide qui l'omet est en heure locale de son
générateur. Le lire comme de l'UTC décale toute la grille de deux heures en
été, et personne ne le voit avant de se demander pourquoi « en ce moment »
montre le film d'après.

**Dans un CDATA, une entité n'en est pas une, et une balise non plus.** Déballer
le CDATA avant de retirer les balises fait ressortir « Les » pour
`<![CDATA[Les <Bronzés>]]>`. C'est exactement ce que le CDATA existe pour
protéger : on met son contenu de côté, on nettoie autour, on le remet.

**Une recherche de sous-titres ne part jamais toute seule.** Elle se déclenche
sur un geste. Une requête automatique dirait à un service tiers ce que la
personne regarde, à chaque lecture — un sous-titre ne vaut pas cela. Et ce qui
part est un titre, une année, une saison, un épisode : jamais l'adresse du flux,
qui porte les identifiants du fournisseur en clair. Un test le vérifie sur
l'URL réellement appelée.

**Un `.srt` francophone sur deux n'est pas en UTF-8.** Il vient d'un outil
Windows, en windows-1252, et décodé sans se poser la question « L'été » devient
« L'Ã©tÃ© » — un défaut qui ne se voit que sur les accents, donc rarement sur la
première ligne. L'ordre d'essai n'est pas indifférent : l'UTF-8 strict **lève**
sur une séquence invalide, ce qui en fait un test fiable ; windows-1252 accepte
n'importe quel octet et ne se plaint jamais.

**Aucun navigateur ne lit le SRT.** L'élément `<track>` ne connaît que le
WebVTT, et les deux se ressemblent assez pour qu'on croie qu'un renommage
suffit : il manque l'en-tête, et les millisecondes s'y écrivent avec un point.
Sans ces deux détails, la piste se charge sans erreur et n'affiche rien.

**Le chemin de l'URL prime sur tout le reste pour classer.** `/series/`,
`/movie/` et `/live/` sont la route du serveur, pas une convention de nommage :
ils ne mentent pas, là où un groupe nommé à la main se trompe régulièrement.

## Ce que les tests ne pouvaient pas voir

La première version de l'index de recherche portait une colonne
`element_id UNINDEXED`, plus lisible à l'écriture. Les 56 tests passaient, sur
six entrées. Sur 120 000, l'import **ne finissait pas en dix minutes** :
`UNINDEXED` veut dire « stockée, pas indexée », donc chaque mise à jour
retrouvait sa ligne par un balayage complet — quadratique. Lié par le `rowid`,
qui est la clé native de FTS5, le même import prend 6,6 s.

Aucune assertion n'aurait attrapé cela : le comportement était juste, seul le
coût était faux. **Un ordre de grandeur ne se teste pas, il se mesure**, une
fois, sur du volume.

Et trois défauts d'interface que seul `npm run verify` a vus : le champ de
recherche débordait de l'écran à 393 px — le `min-width: auto` d'un élément
flex, que rien ne signale —, la lecture ne démarrait pas parce que `play()`
était appelé avant que hls.js ait rattaché la source, et une capture prise sur
`domcontentloaded` montrait une page sans aucun style, la feuille n'étant pas
encore appliquée.

## Ce qui ne se vérifie pas dans ce conteneur

**Le décodage vidéo.** Mesuré : le Chromium livré avec Playwright est compilé
sans les codecs propriétaires. `MediaSource.isTypeSupported('video/mp4;
codecs="avc1.42E01E"')` rend `false`, et l'AAC aussi ; seul VP9 passe. Aucun
flux IPTV n'étant en VP9, l'image ne s'affichera jamais ici, quoi que fasse le
code.

Ce qui est prouvé malgré cela, et ce n'est pas rien : le manifeste est réécrit,
les cinq segments repassent par le mandataire, un segment de 953 Ko arrive avec
le bon type, une signature falsifiée est refusée, et **le lecteur annonce la
durée exacte du média** — 20 s — ce qu'il ne peut savoir qu'en ayant lu le
manifeste entier au travers du relais. Il ne reste que l'image, et elle se
regarde dans un vrai Chrome.

## Xtream Codes : ce qu'on ne peut pas vérifier ici

Cette API n'a **pas de spécification publiée** — c'est un panneau propriétaire
dont l'interface s'est figée par imitation. Il n'existe donc aucun document
officiel à opposer à un panneau qui répond autrement, et la méthode habituelle
(`/api-tierce-verifiee` : lire la surface réelle du paquet) ne s'applique pas.

La parade est écrite dans le code plutôt que dans un contrat : aucun champ n'est
supposé présent, aucun type n'est supposé — le même panneau rend `stream_id` en
nombre pour le direct et en chaîne pour la vidéo à la demande — et une réponse
qui n'est pas du JSON est traduite en erreur claire au lieu d'une `SyntaxError`
sans rapport.

**Ce qui n'est donc pas vérifié : le dialogue avec un vrai panneau.** Les tests
injectent `fetch` et ne touchent pas au réseau. Le premier branchement sur un
abonnement réel est le seul moment où l'on saura si un champ manque, et c'est
`verifierCompte()` qu'il faut appeler en premier : il dit en un appel si les
identifiants passent, si l'abonnement court encore et combien de connexions
simultanées il autorise.

## Pour la suite

**Stack retenue** : Next.js 16 seul, App Router — les routes d'API y font le
travail de serveur (ingestion, mandataire pour contourner le CORS des flux,
lecture du XMLTV), et l'interface partage le modèle sans sérialisation
intermédiaire. Un serveur Fastify séparé doublerait la surface de déploiement
sans rien apporter que les routes ne fassent déjà.

**Cache** : `node:sqlite`, livré avec Node 22 — pas de module natif à compiler,
pas de Redis à faire tourner. Le SQL reste portable si l'hébergement passe un
jour sur Cloudflare D1, qui est le cap posé pour ce dépôt.

**Lecteur** : `hls.js`. C'est la seule dépendance d'exécution prévue, et elle
est incontournable — aucun navigateur de bureau ne lit HLS nativement, et c'est
elle qui donne le changement de piste audio en cours de lecture.

**Ce qui demande une clé qu'on n'a pas** : les affiches et synopsis TMDB, et
les services de sous-titres. Le second est **écrit** : sans clé, la liste des
pistes externes est vide et l'interface dit laquelle poser — aucun écran ne
casse, et la vérification d'interface contrôle cette phrase-là. Le premier
branchement avec une vraie clé reste le seul moment où l'on saura si un champ
de l'API a bougé.

SubDL n'est volontairement pas implémenté : son API rend une **archive ZIP**,
ce qui demande un décompresseur, et rien ne permet d'éprouver la forme réelle
de ses réponses sans clé. L'interface `Fournisseur` est là pour l'ajouter le
jour où c'est vérifiable — écrire ce code à l'aveugle donnerait une
implémentation qui compile et ne marche pas.

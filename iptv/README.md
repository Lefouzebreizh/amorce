# IPTV / VOD — gestion et lecture

Tableau de bord pour ses propres abonnements IPTV : une liste **M3U / M3U8** ou
un panneau **Xtream Codes** entre, et il en ressort une navigation utilisable —
direct, films, séries par saisons — avec recherche, filtres de langue à priorité
francophone, favoris, guide des programmes et lecteur HLS.

Ce dossier ne contient **aucune source de contenu** : ni liste, ni identifiants,
ni adresse de fournisseur. Ce qu'on y branche vient de l'abonnement de celui qui
s'en sert, et n'en sort pas — `.env` et les listes locales sont ignorés par Git.

## Où en est le projet

Le **cœur d'ingestion** est écrit et vérifié : lecture d'une liste M3U en flux,
client Xtream, et la normalisation qui ramène les deux au même modèle. Le
serveur, l'interface et le lecteur ne sont pas commencés — la structure les
attend et les décisions qui les concernent sont écrites plus bas.

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
│   └── normalisation/
│       ├── titre.ts        nettoyage du titre, année, étiquettes
│       ├── etiquettes.ts   langue et définition à partir des étiquettes
│       ├── episode.ts      saison et épisode, cinq écritures reconnues
│       ├── genre.ts        direct / film / série
│       └── normaliser.ts   le seul endroit qui fabrique un Element
└── tests/                ← une suite par module, sans réseau
```

Ce que la suite ajoutera, aux mêmes endroits :

```
src/
├── cache/         ← SQLite (node:sqlite), écriture par paquets, index de recherche
├── epg/           ← lecture XMLTV en flux, association par tvg-id
├── sous-titres/   ← pistes du flux, puis repli sur une API externe
└── lecture/       ← reprise de position, saut d'épisode
app/               ← Next.js 16 : routes d'API et interface
```

## Vérifier

```bash
cd iptv
npm ci
npm test     # 43 tests, sans réseau ni navigateur
npm run check
```

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

**Le chemin de l'URL prime sur tout le reste pour classer.** `/series/`,
`/movie/` et `/live/` sont la route du serveur, pas une convention de nommage :
ils ne mentent pas, là où un groupe nommé à la main se trompe régulièrement.

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

**Ce qui demande une clé qu'on n'a pas** : les affiches et synopsis TMDB, les
sous-titres OpenSubtitles ou SubDL. Ces trois-là s'écrivent derrière une
interface avec un repli neutre — pas d'affiche, pas de sous-titre externe, le
reste fonctionne — pour que l'absence de clé ne bloque ni le développement ni
la vérification.

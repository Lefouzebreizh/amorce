# Quand le défaut vient du téléphone, pas du code

Tout ce qui suit a été **mesuré** sur l'appareil qui sert réellement à monter,
un Xiaomi sous Android. Rien n'apparaît en vérification automatique : le
Chromium des scripts n'a ni ces limites ni ce sélecteur de fichiers.

La règle : **quand un défaut ne se reproduit pas ici, regarder d'abord du côté
de l'appareil.** Une journée entière est passée à corriger du code pour des
symptômes dont deux venaient du téléphone.

Ces observations ne sont pas des correctifs. Ce que le code traite ou non est
dit à chaque fois — et vérifié dans le code, pas supposé : une première version
de cette fiche annonçait trois manques qui n'en étaient pas, faute d'avoir
cherché les bons mots dans un dépôt écrit en français.

## Le sélecteur de fichiers rend zéro octet

Le symptôme le plus coûteux, parce qu'il ressemble à un format non pris en
charge alors qu'il appelle le geste inverse.

Quand l'entrée choisie vient d'un espace de stockage en ligne — Drive, l'onglet
« Récents », l'application d'un service — Android livre un fichier de **zéro
octet**. Le fichier existe et il est bon : le même MP3, transmis autrement,
faisait 137 Ko et se décodait parfaitement.

Ce qui débloque l'utilisateur :

- recopier le fichier dans un dossier local depuis le gestionnaire de fichiers ;
- l'envoyer dans une conversation avec soi-même, puis le télécharger ;
- le bouton **Partager**, qui transmet les octets réels.

**Traité.** L'import dit explicitement qu'un fichier est arrivé vide et donne le
geste qui débloque, au lieu du « format non pris en charge » qui envoyait
chercher un autre encodage — la mauvaise direction, puisque le fichier est bon.
Le partage fonctionne de bout en bout : `manifest.webmanifest` déclare la cible
`/partage`, et `public/sw.js` intercepte le dépôt pour le ranger avant de rendre
la main à l'application. Aucune route serveur n'est nécessaire, ce qui préserve
le principe du studio.

## Le débit de l'export s'effondre

L'enregistrement se fait en temps réel. Sur un appareil chargé, l'encodeur
n'obtient pas ce qu'il lui faut :

| Origine | Débit vidéo |
| --- | --- |
| Export CapCut, même téléphone | 9 565 kb/s |
| Export Amorce, appareil chargé | **761 kb/s** |

À 761 kb/s en 1080 × 1920, l'image est visiblement dégradée. Conseiller de
fermer les autres applications, ou de choisir **720 × 1280** : moitié moins de
pixels, cadence tenue, résultat souvent meilleur qu'un 1080 qui suffoque.

## L'image noire à l'export — cause non établie

Un export réel est sorti **entièrement noir** : luminosité 8 sur 255, détail 1,7,
sur quinze secondes. Deux exports antérieurs des mêmes rushes étaient à 52.

L'image extraite est un dégradé brun sombre : c'est l'étalonnage — halo et
vignettage — appliqué sur un cadre vide. Le studio a donc bien dessiné, mais
**les éléments vidéo n'ont rien produit**. Le son passait, venant des bruitages
et de la musique et non des plans, ce qui rendait le défaut d'autant plus
difficile à lire.

Deux pistes, aucune confirmée :

- **Le nombre de vidéos décodables en même temps.** Le studio crée un `<video>`
  par plan — l'invariant n°3, nécessaire — et n'en borne pas le nombre. Mesuré :
  le montage express des quatre rushes de test en réclame **4**, et douze
  découpes sur ces mêmes 7,5 secondes en portent le compte à **13**. La relation
  est linéaire, un décodeur par plan. Un format court réaliste de trente à
  soixante secondes en demanderait donc vingt-cinq à cinquante, quand un
  navigateur Android en accorde six à huit.

  **Traité.** `ClipVideoPool.sync` ne garde plus chargés que les six plans les
  plus proches de la tête de lecture, et rend les identifiants retenus ; la
  boucle de rendu purge puis rebranche le graphe audio sur cette même fenêtre.
  Sans cette purge, `attachClip` refuserait de rebrancher un identifiant qu'il
  connaît déjà — un élément média ne se relie qu'à une seule source Web Audio
  dans toute sa vie — et le plan recréé reviendrait muet, en silence.

  Ce que cela ne prouve pas : le Chromium de bureau n'ayant pas le plafond
  d'Android, la borne est vérifiée, pas le symptôme qu'elle prévient. Si un
  export noir revient du téléphone après ce changement, la cause est ailleurs.
- **Un fichier rangé vide**, qui produit un lien valide ne décodant rien. Un
  `Blob` de zéro octet est `truthy` et `createObjectURL` lui rend un lien
  parfaitement formé : le montage se rouvrait normalement et sortait noir, sans
  message. `persistence.ts` refuse désormais de l'écrire comme de le relire, et
  le traite comme un fichier perdu — l'élément et les plans qui en dépendaient
  sont retirés, ce que la reprise savait déjà faire.

**Le test qui tranche**, à demander avant toute correction : ramener la tête de
lecture à zéro et lire. Si l'image apparaît, l'export capture avant que les
décodeurs soient prêts. Si elle reste noire, les plans ne décodent pas.

## La reprise du montage a échoué

Le montage a disparu et il a fallu tout réimporter, alors que
`npm run verify:reprise` passe partout ailleurs. Probablement un manque de
place : les rushes pèsent plusieurs dizaines de mégaoctets, et un navigateur
efface ce qu'on lui a confié quand il en manque.

**Traité.** `usePersistence.ts` pose un `storageError` quand l'écriture échoue —
« ton montage ne peut pas être conservé : il n'y a plus de place sur cet
appareil, exporte avant de fermer » — et l'efface dès qu'une écriture repasse.
Vérifier que l'utilisateur l'a vu avant de chercher ailleurs.

## La note ne regarde jamais les pixels

Un montage a affiché **95 sur 100 alors que la vidéo exportée était noire**.

`analysis.ts` note la structure — rythme des coupes, accroche, ponctuation
sonore, couverture en texte. Une note élevée ne dit rien de ce qui sort du
rendu. Le préciser à l'utilisateur plutôt que le laisser conclure que son
jugement est mauvais.

## Le réflexe qui fait gagner le plus de temps

Face à un défaut signalé depuis le téléphone : **demander l'export**, et le
mesurer. Luminosité et détail image par image, niveau sonore seconde par
seconde — c'est ainsi qu'on a établi en deux commandes qu'un export était noir,
et qu'un autre perdait son son à la sixième seconde.

Le skill `/transcription-media` fait ces mesures ; le contrôle de silence de
`scripts/verify.mjs` montre comment décoder un export seconde par seconde.

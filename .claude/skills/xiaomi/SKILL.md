---
name: xiaomi
description: Ce que l'appareil de l'utilisateur fait de travers — fichiers importés à zéro octet, image noire à l'export, montage disparu, débit vidéo effondré. À lire dès qu'un défaut est signalé depuis un téléphone Android et qu'il ne se reproduit pas en vérification, avant de chercher la cause dans le code.
---

# Le terrain : un Xiaomi sous Android

Tout ce qui suit a été **mesuré**, pas supposé, sur l'appareil qui sert
réellement à monter. Rien de cela n'apparaît en vérification automatique : le
Chromium des scripts n'a ni ces limites ni ce sélecteur de fichiers.

La règle générale : **quand un défaut ne se reproduit pas ici, chercher d'abord
du côté de l'appareil.** Une journée entière a été passée à corriger du code
pour des symptômes dont deux venaient du téléphone.

## Le sélecteur de fichiers rend zéro octet

Le symptôme le plus coûteux, et le plus trompeur.

Quand l'entrée choisie vient d'un espace de stockage en ligne — Drive, l'onglet
« Récents », l'application d'un service — Android livre un fichier de **zéro
octet**. Le fichier existe et il est bon : le même MP3, transmis autrement,
faisait 137 Ko et se décodait parfaitement, avec cinq passages parlés détectés.

Le studio le dit désormais explicitement au lieu d'un « fichier illisible »
générique, et distingue ce cas d'un format non pris en charge — les deux
appellent des gestes opposés.

**Ce qui aide :**

- Recopier le fichier dans un dossier local depuis le gestionnaire de fichiers.
- L'envoyer dans une conversation avec soi-même, puis le télécharger.
- **Le bouton « Partager »**, qui transmet les octets réels. C'est pour cela
  qu'Amorce est installable et déclare une cible de partage — voir `public/sw.js`.

Le `accept` des sélecteurs nomme les extensions en plus du type générique :
`audio/*` seul oriente vers un choix de média qui échoue plus souvent.

## Le débit de l'export s'effondre

L'enregistrement se fait en temps réel. Sur un appareil chargé, l'encodeur
n'obtient pas ce qu'il faut :

| Origine | Débit vidéo |
| --- | --- |
| Export CapCut, même téléphone | 9 565 kb/s |
| Export Amorce, appareil chargé | **761 kb/s** |

À 761 kb/s en 1080 × 1920, l'image est visiblement dégradée. Conseiller de
fermer les autres applications, ou de choisir **720 × 1280** : moitié moins de
pixels, cadence tenue, résultat souvent meilleur qu'un 1080 qui suffoque.

## L'image noire à l'export — cause non établie

Un export réel est sorti **entièrement noir** : luminosité 8 sur 255, détail 1,7,
sur les quinze secondes. Deux exports antérieurs des mêmes rushes étaient à 52.

L'image extraite est un dégradé brun sombre : c'est l'étalonnage — halo et
vignettage — appliqué sur un cadre vide. Le studio a donc bien dessiné, mais
**les éléments vidéo n'ont rien produit**. Le son passait, parce qu'il venait des
bruitages et de la musique, pas des éléments vidéo — ce qui rendait le défaut
d'autant plus difficile à lire.

Deux pistes, aucune confirmée :

- **Le nombre de vidéos décodables simultanément.** Le studio crée un `<video>`
  par plan (invariant n°3, nécessaire) ; huit plans redécoupés en font bien
  davantage. Les navigateurs Android plafonnent souvent autour de six à huit.
  Le remède serait de ne garder chargés que les plans proches de la tête de
  lecture.
- **Un fichier rangé vide.** Corrigé depuis : `persistence.ts` refuse d'écrire
  comme de relire un blob de zéro octet, qui produisait un lien valide ne
  décodant rien.

**Le test qui tranche**, à demander avant toute correction : ramener la tête de
lecture à zéro et lire. Si l'image apparaît, l'export capture avant que les
décodeurs soient prêts. Si elle reste noire, les plans ne décodent pas.

## La reprise du montage a échoué

Le montage a disparu et il a fallu tout réimporter, alors que
`npm run verify:reprise` passe partout ailleurs. Probablement un manque de place :
les rushes pèsent plusieurs dizaines de mégaoctets et un navigateur efface ce
qu'on lui a confié quand il en manque.

Le studio affiche un avertissement dans l'étape Importer quand le rangement
échoue. Vérifier que l'utilisateur l'a vu avant de chercher ailleurs.

## Ce que la note ne voit pas

Un montage a affiché **95 sur 100 alors que la vidéo exportée était noire**.

`analysis.ts` note la structure — rythme des coupes, accroche, ponctuation
sonore, couverture en texte. Il ne regarde jamais les pixels. Une note élevée ne
dit rien de ce qui sort, et il faut le dire à l'utilisateur plutôt que le
laisser conclure que son jugement est mauvais.

## Demander le fichier

Le plus efficace face à un défaut signalé depuis le téléphone : **demander
l'export**, et le mesurer. Voir le skill `verifier` — luminosité et détail image
par image, niveau sonore seconde par seconde. C'est ainsi qu'on a établi en
deux commandes qu'un export était noir et qu'un autre perdait son son à la
sixième seconde.

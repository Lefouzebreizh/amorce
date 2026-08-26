# Quand le défaut vient du téléphone, pas du code

Tout ce qui suit a été **mesuré** sur l'appareil qui sert réellement à monter,
un Xiaomi sous Android. Rien n'apparaît en vérification automatique : le
Chromium des scripts n'a ni ces limites ni ce sélecteur de fichiers.

La règle : **quand un défaut ne se reproduit pas ici, regarder d'abord du côté
de l'appareil.** Une journée entière est passée à corriger du code pour des
symptômes dont deux venaient du téléphone.

Ces observations ne sont pas des correctifs. Plusieurs désignent des manques
que le code ne traite toujours pas : c'est dit à chaque fois.

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

**Non traité aujourd'hui.** L'import ne distingue pas ce cas d'un format refusé,
et `public/sw.js` ne déclare pas de cible de partage. Les deux mériteraient de
l'être : le message générique envoie l'utilisateur chercher un autre format,
c'est-à-dire dans la mauvaise direction.

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
  par plan — l'invariant n°3, nécessaire — et huit plans redécoupés en font bien
  davantage. Les navigateurs Android plafonnent souvent entre six et huit. Le
  remède serait de ne garder chargés que les plans proches de la tête de lecture.
- **Un fichier rangé vide**, qui produit un lien valide ne décodant rien.
  `persistence.ts` ne refuse toujours ni d'écrire ni de relire un blob de zéro
  octet.

**Le test qui tranche**, à demander avant toute correction : ramener la tête de
lecture à zéro et lire. Si l'image apparaît, l'export capture avant que les
décodeurs soient prêts. Si elle reste noire, les plans ne décodent pas.

## La reprise du montage a échoué

Le montage a disparu et il a fallu tout réimporter, alors que
`npm run verify:reprise` passe partout ailleurs. Probablement un manque de
place : les rushes pèsent plusieurs dizaines de mégaoctets, et un navigateur
efface ce qu'on lui a confié quand il en manque.

**Non traité aujourd'hui.** Rien n'avertit l'utilisateur quand le rangement
échoue ; le montage disparaît sans un mot. Le lui dire à l'étape Importer
vaudrait mieux qu'un projet qui s'ouvre vide.

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

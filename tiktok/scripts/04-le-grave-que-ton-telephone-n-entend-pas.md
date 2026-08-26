# Le grave que ton téléphone n'entend pas

**Concept** : A3 — Le son que personne n'entend
**Dispositif** : capture d'écran + voix off
**Durée visée** : 34 s
**Ce que le spectateur emporte** : un grave pur en dessous de 400 Hz n'existe pas sur un téléphone ; il faut le doubler d'une couche plus haute.

## L'accroche — 0 à 3 s

> **Incrusté** : « Ton bruitage préféré est inaudible. »
> **Image** : un analyseur de spectre, une grosse bosse dans les graves
> **Voix** : « Ton plus beau bruitage, là — ton téléphone ne le joue pas. »

## Le déroulé

| t | Image | Voix off | Incrusté | Son |
| --- | --- | --- | --- | --- |
| 0:03 | Spectre, la bosse à 60 Hz surlignée | « Écoute. » | « 60 Hz » | le sinus à 60 Hz, seul, 2 s |
| 0:07 | Même écran, rien ne bouge | « Tu n'as rien entendu. C'est normal. » | — | silence |
| 0:11 | Coupe du haut-parleur d'un téléphone, ou schéma | « Un haut-parleur de téléphone ne descend pas sous [400 hertz]. » | « 400 Hz » | — |
| 0:16 | Le spectre, avec la zone sous 400 Hz barrée | « Ton beau grave, il ne le joue pas moins fort. Il ne le joue pas du tout. » | — | — |
| 0:22 | On ajoute une couche d'harmoniques dans l'éditeur | « La parade : tu doubles ton grave d'une couche plus haute. » | — | le même impact, doublé, 2 s |
| 0:28 | Les deux spectres l'un sous l'autre | « Là, tu l'as entendu. » | — | — |

## La sortie — 4 dernières secondes

> **Voix** : « Et le meilleur : tu regardes ça sur un téléphone. Donc la démonstration vient de marcher sur toi. »
> **Incrusté** : « ✓ »

C'est le seul moment de la vidéo où l'humour est possible, et il est gratuit :
la preuve est dans l'appareil du spectateur. Ne pas le surjouer — la phrase se
dit posément, et c'est ce qui la rend drôle.

## Le détail à ne pas rater

Les deux couches de l'impact doublé **se partagent** le niveau demandé, elles
ne s'additionnent pas. Si elles s'additionnent, la crête grimpe, le limiteur
l'écrase, et tout le mixage pompe à chaque frappe. C'est écrit dans
`src/lib/sfx.ts` d'Amorce, et ça s'entend immédiatement quand c'est raté.

## La légende

Ton téléphone ne joue pas les graves. Pas « moins fort » : pas du tout.

Sous [400 Hz], le haut-parleur ne restitue rien. Un impact qui ne vit que là
est simplement absent de l'appareil sur lequel ta vidéo sera regardée. La
parade tient en une couche d'harmoniques.

## Ce qui peut rater

- **Le sinus à 60 Hz s'entend quand même**, parce que l'exportation a laissé
  passer une distorsion qui crée des harmoniques. Vérifier sur un vrai
  téléphone, haut-parleur, pas au casque : au casque, tout s'entend, et la
  vidéo devient un mensonge.
- **Deux secondes de silence à 0:07**, c'est une éternité en format court. Le
  texte incrusté doit occuper l'écran pendant ce temps-là, sinon on passe.
- **Le chiffre 400 varie** selon l'appareil. Dire « autour de » à l'oral si tu
  veux être exact ; l'incrustation, elle, reste nette.

## Après publication

- **Publié le** : [ ]
- **Vues / rétention** : [ ]
- **Ce que j'en retiens** : [ ]

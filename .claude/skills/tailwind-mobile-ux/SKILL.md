---
name: tailwind-mobile-ux
description: Rendre une interface Amorce utilisable au doigt sur un téléphone tenu à la verticale — plages de viewport, zones d'atteinte du pouce, encoches et barres de geste, hauteur réelle du navigateur, et la boucle de vérification sous processeur bridé. À charger avant de toucher à la coque mobile, à un panneau qui doit tenir sur un écran étroit, ou dès qu'il est question de tactile, de téléphone, de portrait, de safe area, de 100vh ou de mise en page responsive dans ce dépôt.
---

# Le mobile, de plein droit

`CLAUDE.md` pose les règles — `min-h-11`, `100dvh`, `env(safe-area-inset-*)`,
rien de superposé à l'aperçu. Cette skill explique **pourquoi elles existent** et
ce qu'elles ne couvrent pas.

## On ne conçoit jamais pour un modèle de téléphone

C'est l'erreur la plus coûteuse, parce qu'elle est invisible sur l'appareil de
celui qui l'a commise. Un téléphone n'a pas un viewport, une gamme en a des
dizaines : de **360 à 440 points de large** en usage courant, avec des encoches
de tailles différentes, des barres de geste présentes ou non, et une taille de
police que l'utilisateur a pu doubler.

Visez des **plages**, et vérifiez aux extrémités. Une mise en page qui tient à
360 et à 440 tient partout entre les deux. Une mise en page calée sur un modèle
casse chez tout le monde sauf son auteur.

Trois largeurs suffisent pour couvrir l'essentiel : **360** (petit Android),
**390** (le plus courant), **430** (grand format).

## La hauteur ment

`100vh` est la hauteur du navigateur **barres masquées**. Sur mobile, la barre
d'adresse est visible au chargement puis se rétracte au défilement : une
interface en `100vh` déborde à l'ouverture, et le bouton principal est sous
l'écran au moment précis où l'utilisateur le cherche.

`100dvh` suit la hauteur réelle. C'est la seule raison de la règle, et elle
suffit à la justifier.

## Les bords ne sont pas à vous

En haut, l'encoche ou la pilule. En bas, la barre de geste — et sur Amorce, la
barre d'onglets s'y trouve. Un bouton posé à moins de la marge système est
soit masqué, soit déclenche un geste du téléphone au lieu de l'action prévue.

`env(safe-area-inset-*)` sur tout ce qui touche un bord. Et rappelez-vous que
ces valeurs sont **nulles sur ordinateur** : les utiliser ne coûte rien là où
elles ne servent pas.

## Le pouce décide de la mise en page

Sur un téléphone tenu d'une main, le pouce atteint confortablement le **tiers
bas** de l'écran et le **côté** de la main qui tient. Le haut de l'écran demande
de changer de prise.

Conséquence directe pour un studio de montage : **les actions fréquentes vont en
bas**, les réglages rares peuvent monter. La barre d'onglets en bas n'est pas une
mode, c'est là que le pouce est.

Et **44 points au minimum** pour toute cible tactile — pas parce qu'un doigt
mesure 44 points, mais parce qu'il touche large et imprécis, en marchant, d'une
main. Une cible de 32 points se rate une fois sur cinq.

## Ce qui n'existe pas au doigt

**Le survol.** Toute information qui n'apparaît qu'au survol est invisible sur
téléphone. Si un réglage a besoin d'une explication, elle est écrite à côté —
c'est ce que `Field` impose, et c'est une règle mobile avant d'être une règle
d'accessibilité.

**Le clic droit, le glisser fin, le double-clic.** Ce qui demande de la précision
demande une alternative.

**La patience.** Un téléphone décode de la vidéo, mixe de l'audio et dessine sur
un canvas avec un budget thermique. C'est pour ça que le studio a un
`QualityGovernor` : l'interface doit survivre à une dégradation de qualité sans
sauter, et sans le cacher à l'utilisateur.

## Vérifier pour de vrai

```bash
AMORCE_PROFILE=mobile npm run verify
```

Le profil téléphone **bride le processeur d'un facteur quatre**, et ce n'est pas
décoratif : sans ce bridage, la dégradation automatique de qualité ne se
déclencherait jamais sur une machine de développement, et l'on croirait le
chemin mobile testé alors qu'on n'aurait testé que le confortable.

Une interface qui n'a pas été vue sous bridage n'a pas été vue.

## Le test qui ne coûte rien

Réduisez la fenêtre à 360 points de large, mettez la police système à sa plus
grande taille, et refaites le parcours du début à la fin. La plupart des défauts
mobiles se voient là, en trois minutes, sans appareil.

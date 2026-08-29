# Ce qu'on répond après avoir livré

C'est l'endroit où quarante-huit heures deviennent trois semaines. Un client
content demande une petite chose, puis une autre, et le site à 299 € finit par
coûter cinq jours.

Ce fichier existe pour éviter ça sans être désagréable — et il commence par un
chiffre, parce que c'est lui qui décide de tout le reste.

---

## Une modification coûte 277 millisecondes

Mesuré sur un vrai dossier : nouveau numéro de téléphone, nouvelle couleur, un
service ajouté. On modifie `commande.json`, on relance, c'est régénéré.

```bash
# on corrige le dossier, puis :
npm run generer dossiers/couverture-tanguy-2026-08-29
```

**Le travail n'est pas dans la modification, il est dans la conversation.** Lire
le message, comprendre ce qu'il veut, republier. Cinq minutes en tout, dont
zéro de fabrication.

Ça change complètement ce qu'on peut dire oui. Un artisan qui demande à changer
son numéro ou à ajouter « Gouttières » à sa liste ne demande pas une faveur : il
demande quelque chose qui coûte moins cher que de lui expliquer que c'est en
supplément.

---

## Ce qui est compris, et qu'on fait sans discuter

Tout ce qui **existe déjà dans le dossier** et qu'on remplace :

- le téléphone, le WhatsApp, la ville, la zone d'intervention ;
- le slogan, la présentation, la liste des services ;
- la couleur ;
- les photos — on en retire, on en ajoute, on en réordonne.

**Pendant les trois premiers mois, et on le dit à la livraison.** Pas
« illimité », pas « à vie » : trois mois, c'est assez long pour couvrir tout ce
qu'un artisan découvre en montrant son site autour de lui, et assez court pour
que la phrase reste vraie.

Dire oui à ces demandes-là n'est pas de la générosité mal placée. Sur un métier
où tout le monde se connaît, l'artisan dont on a changé le numéro en une heure
un samedi en parle à trois collègues. **C'est le seul canal d'acquisition qui ne
coûte rien.**

---

## Ce qui n'est pas compris

Tout ce qui demande de **fabriquer quelque chose qui n'existe pas** :

| Demande | Pourquoi c'est autre chose |
| --- | --- |
| Une deuxième page | Le site vendu est une page. Deux pages, c'est une navigation, une structure, un autre travail. |
| Un formulaire de contact | La page a l'appel et le WhatsApp. Un formulaire demande une adresse d'envoi, un serveur, et il tombe en panne un jour. |
| Une prise de rendez-vous | Un agenda à synchroniser, des créneaux, des rappels. |
| Un logo | Ce n'est pas le même métier. |
| Un nom de domaine à soi | Un achat annuel, à son nom, qu'il faut renouveler. On l'accompagne, on ne le porte pas. |

---

## Comment le dire

Quand la demande est comprise :

> C'est fait, regarde. Tu me dis si c'est bien ça.

Rien de plus. Ne jamais rappeler que c'était gratuit — ça transforme un service
en dette.

Quand elle ne l'est pas :

> Ça, c'est un vrai bout de travail en plus — ce n'est plus la même page. Je
> peux te le faire, je te dis combien et tu vois. Si tu préfères rester comme
> ça, le site marche très bien tel quel.

**« Le site marche très bien tel quel » est la phrase importante.** Elle dit
qu'on ne cherche pas à vendre la suite, et c'est exactement ce qui fait qu'on la
vend parfois.

Quand les trois mois sont passés :

> Ça fait un moment qu'on a mis le site en ligne — les retouches comprises
> couraient sur trois mois. Je te fais celle-là quand même, et pour la suite on
> verra ensemble.

Une dernière offerte après la limite coûte cinq minutes et rachète la règle
pour un an.

---

## La seule chose qui n'attend pas

**Un site en ligne qui affiche une information fausse se corrige tout de
suite**, quelle que soit la date, gratuitement, sans en discuter : un mauvais
numéro, une commune où il n'intervient plus, un service qu'il a arrêté.

Ce n'est pas une retouche. C'est un client qui perd des appels à cause de
quelque chose qu'on a écrit.

---

## Le geste, en trois lignes

1. On modifie `commande.json` dans le dossier du client.
2. `npm run generer <dossier>`.
3. On redépose le dossier là où il est publié.

Le dossier du client est la seule vérité. On ne retouche **jamais** le
`index.html` à la main : la prochaine régénération l'écraserait, et on
chercherait longtemps pourquoi la correction a disparu.

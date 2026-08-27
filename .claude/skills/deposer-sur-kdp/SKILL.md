---
name: deposer-sur-kdp
description: Accompagner le dépôt d'un livre papier sur Amazon KDP une fois les fichiers prêts — l'ordre réel des trois onglets, les réglages d'impression qui ne se reprennent plus, comment obtenir une épreuve papier sans publier, et quoi faire de chaque refus de l'aperçu en ligne. À utiliser dès qu'une demande parle de déposer, publier, mettre en vente, téléverser ou soumettre un livre, de commander une épreuve ou un exemplaire auteur, de remplir le formulaire KDP, de choisir un prix, une catégorie, des mots-clés ou un ISBN, et dès qu'un message de refus tombe — « fichier non conforme », « marges insuffisantes », « aperçu impossible », « votre couverture ne correspond pas ». À utiliser aussi quand la demande dit seulement « on le sort quand », « je fais quoi maintenant, le livre est prêt », « c'est prêt à vendre », « comment je l'envoie à Amazon ». Pour préparer ou corriger les fichiers avant d'arriver là — DPI, fond perdu, tranche, nombre de pages — c'est `prepresse-kdp` ; pour juger la couverture en vignette, `kdp-thumbnail-validator`.
---

# Déposer un livre papier sur KDP

Les fichiers passent la validation locale : c'est nécessaire et ce n'est pas
suffisant. Le formulaire décide de choses que le PDF ne porte pas — le papier,
l'encre, la finition, le prix — et **trois d'entre elles ne se reprennent plus**
une fois le livre publié.

Le but de cette étape n'est pas de publier. C'est d'**obtenir une épreuve
papier**, qui est le seul contrôle voyant ce qu'aucun écran ne montre.

## Ce qui surprend tout le monde

**Il faut remplir les trois onglets, tarifs compris, avant que le bouton
« Commander une épreuve » apparaisse.** L'épreuve n'est pas un service à part :
c'est un bouton qui se débloque une fois le titre complet. On va donc jusqu'au
bord du dépôt sans le franchir.

Tant qu'on n'a pas cliqué sur *Publier*, le titre reste en brouillon et
personne d'autre ne peut le voir. Mettre un prix provisoire n'engage rien.

Deux détails à connaître avant de déballer le colis, pour ne pas croire à un
défaut : l'épreuve porte **« NOT FOR RESALE »** imprimé en travers de la
couverture, et le prix affiché à la commande est le **coût d'impression**, pas
le prix de vente.

## L'ordre réel

1. **Détails** — titre, sous-titre, auteur, description, mots-clés, catégories,
   tranche d'âge. Tout se prépare hors ligne : le formulaire n'est pas
   l'endroit où l'on rédige. Voir `kdp/depot/FICHE-KDP.md`.
2. **Contenu** — l'intérieur, la couverture, puis l'**aperçu en ligne**, qui
   doit passer sans avertissement.
3. **Tarifs** — à remplir même provisoirement, sans quoi la suite reste fermée.
4. Retour à **Contenu** : *Commander une épreuve* est désormais actif.

Les cotes du formulaire — nombre de mots-clés, longueur de la description,
nombre de catégories — bougent d'une année à l'autre. **Les lire à l'écran
plutôt que de les affirmer.**

## Les trois réglages qui ne se reprennent plus

Ils se choisissent dans l'onglet Contenu et suivent le livre pour toujours.
Pour un album jeunesse illustré en aquarelle :

| Réglage | Choix | Pourquoi |
| --- | --- | --- |
| **Encre** | couleur **premium** | la standard est faite pour des aplats et des schémas ; sur de l'aquarelle en pleine page elle délave les ciels et grise les violets |
| **Papier** | **blanc** | si la crème est déjà peinte dans les planches, un papier crème la cumule et l'album jaunit |
| **Finition** | **mate** | le brillant marque les doigts en une semaine sur un livre d'enfant, et écrase les hautes lumières |

Le raisonnement compte plus que la réponse : il faut savoir **ce que le papier
apporte déjà** avant de choisir le sien. Un livre au fond blanc appelle
l'inverse.

## Quand l'aperçu refuse

Chaque refus a une cause dans le fichier, jamais dans le formulaire. Les
corriger dans le PDF et redéposer — **ne jamais contourner en changeant le
format du livre**, ce qui déplace le problème sur toutes les pages.

| Message | Cause réelle | Correction |
| --- | --- | --- |
| marges ou texte hors zone de sécurité | du texte trop près du bord coupé, ou de la reliure | rentrer le texte ; une illustration a le droit d'aller au pli, pas une phrase |
| dimensions de couverture incorrectes | tranche calculée sur le mauvais nombre de pages | recalculer sur le nombre de pages du **PDF final** |
| résolution insuffisante | une image sous 300 DPI à sa taille d'emploi | reprendre la source ; rééchantillonner ajoute des pixels, pas du détail |
| nombre de pages invalide | sous le minimum, ou impair | compléter par des pages composées plutôt que d'en retirer |
| police non incorporée | texte tracé avec une police non embarquée | réenregistrer en incorporant tout |

`prepresse-kdp` porte les cotes ; `python3 kdp/pipeline/valider.py --dossier …`
rejoue les neuf contrôles avant de redéposer.

## L'épreuve reçue

C'est le moment du travail réel. `kdp/depot/EPREUVE.md` porte la liste complète
et les numéros de page exacts. Les quatre contrôles qu'aucun écran ne remplace :

- **ce qui ne peut être testé que sur papier** — un QR imprimé, un aplat de
  couleur, un contraste limite. À faire en premier, appareil photo natif ;
- **la coupe** — le massicot emporte jusqu'à 3 mm sur n'importe quel bord, et
  pas le même d'un exemplaire à l'autre ;
- **la reliure** — le livre s'ouvre-t-il assez à plat pour ce qu'on demande au
  lecteur d'y faire ?
- **la lecture à voix haute, en entier**, crayon en main. Le papier fait
  apparaître des coquilles qu'un écran cache depuis des semaines.

## Ce qui reste à l'auteur

Trois décisions ne se prennent pas à sa place, parce qu'elles ne sont pas
techniques : **le prix**, la **date de mise en vente**, et le choix de
**publier**. Préparer, mesurer, expliquer — puis attendre.

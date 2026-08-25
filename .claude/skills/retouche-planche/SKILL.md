---
name: retouche-planche
description: Corriger au pixel une illustration dont le texte ou le dessin est incrusté — coquille dans une bulle, mot en trop, regard raté, élément à effacer ou à déplacer. Méthode de chirurgie de glyphe avec la matière de la planche elle-même, sans police importée ni régénération. À charger avant toute retouche d'image contenant du lettrage, et dès qu'il est question de masquer, effacer, recentrer, prélever ou greffer sur une planche.
---

# Retouche d'une planche au pixel

Quand le texte est pixellisé dans l'illustration, une coquille ne se corrige pas
« au traitement de texte » : elle se corrige au glyphe. Ces règles viennent de
corrections réellement appliquées, et chacune a coûté un essai raté.

## Mesurer avant de couper

Jamais de coordonnées au jugé. Dans l'ordre :

1. **Carte d'encre** de la zone : afficher les pixels sombres en caractères, ligne
   par ligne. C'est le seul moyen de savoir où commence et finit un glyphe.
2. **Profil de colonnes** dans la bande de hauteur d'x uniquement — les hampes et
   les jambages soudent les lettres et faussent la séparation.
3. **Gouttière d'encre** entre deux lignes : c'est elle qui borne la bande de
   travail. Trop haute, elle emporte les jambages de la ligne du dessus ; trop
   basse, les hampes de celle du dessous.
4. **Lignes de base** des deux lignes concernées, pour connaître l'écart exact
   quand on prélève un glyphe une ligne plus haut.

## Prélever plutôt qu'importer

La fonte d'une bulle n'est presque jamais une police disponible. À hauteur de
capitale égale, la plus proche est facilement 20 % trop large, et les facteurs
de condensation relevés d'une ligne à l'autre ne concordent pas assez pour
retypographier sans que le raccord se voie.

Donc :

- **Ce qui manque se construit avec des lettres de la même bulle.** Un « ne »
  absent se fabrique avec le « n » d'un autre mot et le « e » d'un troisième,
  décalés de l'écart entre lignes de base.
- **Un `m` est un `n` avec une arche de plus** : dupliquer l'arche plutôt que
  redessiner la lettre.
- **Ce qui est en trop se supprime**, et la ligne se recentre sur son ancien axe.
  Supprimer est toujours plus sûr qu'insérer.
- **Un tréma parasite s'efface**, il ne se remplace pas.

Ne retypographier une ligne entière qu'en dernier recours — et alors la ligne
entière, jamais la moitié : une liste à moitié refaite est pire qu'une liste
fautive.

## Les deux pièges qui coûtent un essai

- **En italique, le point du `i` penche à droite de sa hampe.** Une boîte calée
  sur la lettre suivante l'emporte et laisse un `i` mutilé.
- **Le fondu du masque ne doit jamais rencontrer d'encre.** À dix pixels de
  rampe, le premier et le dernier glyphe de la ligne tombent dans la zone à
  demi effacée et laissent un fantôme. Fondu étroit, bande large.

## Reboucher

- Aplat de la **teinte médiane des pixels clairs** autour de la zone, pas une
  couleur devinée.
- Sur du papier texturé, ne pas paver un échantillon : il rapporte ce qui traîne
  dans la marge et le répète en rayures. Un **grain calculé** ne se répète jamais.
- Toujours **fondre les bords** du rebouchage : un rectangle posé net se repère
  à sa lisière, même quand la couleur est juste.

## Retoucher un dessin, pas un texte

Même discipline. Un regard vide se mesure : des pupilles de six pixels dans un
œil de cinquante en sont un. On redessine à une proportion de dessin animé,
**tracé à quatre fois la taille puis réduit** — une ellipse dessinée directement
à l'échelle sort crénelée, et une pupille crénelée se voit plus qu'une pupille
trop petite. Un reflet en haut à gauche rend l'œil vivant.

## Contrôler

Après retouche, **regarder à taille réelle**, pas au zoom. Une correction
invisible à 100 % est réussie ; une correction parfaite au zoom 8× mais visible
à taille réelle ne l'est pas.

Et se rappeler qu'aucun script ne verra un défaut de dessin. C'est l'auteur qui
repère un regard raté. Quand il en signale un, le mesurer avant de le corriger —
et avant de le contester.

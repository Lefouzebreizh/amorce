---
name: typographie-francaise
description: Règles de typographie française pour du texte destiné à l'impression ou au lettrage — espaces insécables, guillemets, apostrophes, points de suspension, virgule du vocatif, casse des titres, négation complète. À charger avant d'écrire ou de relire des bulles de bande dessinée, des titres, une quatrième de couverture, une description produit ou tout texte français qui partira en image ou en impression.
---

# Typographie française

Un texte destiné à devenir une image doit être juste **avant** d'être pixellisé :
après, une virgule coûte une régénération complète. Ces règles sont celles dont
l'absence a coûté cher.

## Les règles

- **Espace insécable avant `!` `?` `:` `;`** — sans exception. L'espace fine
  insécable (U+202F) est la forme soignée ; l'insécable ordinaire (U+00A0)
  convient. Jamais une espace ordinaire, jamais rien.
- **Apostrophe courbe** `’`, jamais l'apostrophe droite `'`.
- **Points de suspension en trois points**, jamais quatre, et **jamais en tête**
  de réplique.
- **Virgule du vocatif** : « Merci, Zéphy », jamais « Merci Zéphy ». C'est
  l'oubli le plus fréquent et le plus visible.
- **Négation complète** dans la narration : « on ne va pas », jamais « on va pas ».
  En dialogue enfantin, la forme orale se défend — mais elle se choisit, elle ne
  s'oublie pas, et elle reste cohérente dans tout le volume.
- **Casse des titres** : minuscules sauf l'initiale et les noms propres. Pas de
  capitalisation à l'anglaise. Les sigles et noms propres gardent leur casse.
- **Guillemets français** « … » dans la prose. **Dans une bulle de bande
  dessinée, aucun guillemet** : la bulle est déjà le signe du dialogue, et les
  guillemets font double emploi pour un lecteur débutant. Un volume ne peut pas
  mélanger les deux systèmes.
- **Pas de ponctuation orpheline** en début de ligne.

## Longueur

Vingt-deux mots par bulle au maximum. Au-delà, la lecture décroche à hauteur
d'album — et c'est mesurable avant d'être visible.

## Rendre les règles exécutables

Énoncer les règles ne suffit pas : elles doivent être vérifiables par une
machine, et le texte doit donc **exister hors de l'image**. Un contrôle qui lit
les répliques et applique ces règles trouve en quelques secondes ce que trois
relectures humaines laissent passer — sur un dossier fraîchement écrit et
soigné, il a relevé soixante-deux erreurs.

Distinguer deux niveaux :

- **Erreur** : faux à coup sûr — apostrophe droite, espace manquante, guillemet
  dans une bulle, bulle trop longue.
- **Doute** : demande un œil — virgule du vocatif, négation sans « ne ». Mieux
  vaut trois fausses alertes qu'une négation partie chez l'imprimeur.

Et calibrer : une règle qui alerte sur presque tout est fausse, pas sévère.
Vérifier chaque contrôle sur un cas connu bon **et** un cas connu mauvais avant
de lui faire confiance.

## Se relire soi-même

Une lecture à basse résolution invente des fautes. Un tréma sur un « e » peut
n'être que la barre partagée d'un double « t » surmontée de ses deux hampes.
Avant de corriger une coquille, l'établir sur la carte d'encre — et si elle
n'existe pas, le dire.

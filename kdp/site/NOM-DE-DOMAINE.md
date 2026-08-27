# Ouvrir roussyetzephy.fr

Le QR de la page 28 encode `roussyetzephy.fr/hymne`. Cette adresse doit exister
**avant que le livre parte à l'impression** — après, elle est gravée dans du
papier chez des inconnus.

---

## La règle qui décide de tout

**Un QR imprimé est définitif ; un domaine se loue à l'année.**

Le jour où le domaine expire, tous les exemplaires vendus pointent vers une
page morte — et un domaine expiré portant un nom identifiable est racheté en
quelques heures par des revendeurs, qui le remettent en vente à cent fois le
prix ou y posent de la publicité. C'est le seul endroit de ce projet où un
oubli de renouvellement casse quelque chose d'irréparable.

Trois conséquences, dans l'ordre d'importance :

1. **Prendre le domaine pour plusieurs années d'un coup.** L'AFNIC, qui gère
   le `.fr`, autorise jusqu'à dix ans. Dix ans de `.fr` coûtent moins cher
   qu'un seul retirage du livre.
2. **Activer le renouvellement automatique**, et vérifier une fois par an que
   la carte bancaire enregistrée est toujours valable. La plupart des domaines
   perdus le sont sur une carte expirée, pas sur une décision.
3. **Utiliser une adresse e-mail que vous garderez.** C'est là qu'arrivent les
   avis d'expiration, et c'est le seul lien entre vous et le domaine.

---

## Où le prendre

Le `.fr` est réservé aux personnes résidant dans l'Union européenne — vous y
avez droit. Comptez de sept à quinze euros par an selon le bureau
d'enregistrement.

| | |
| --- | --- |
| **OVHcloud** | Français, le plus courant pour un `.fr`, autour de 7 € la première année. Interface dense mais complète. |
| **Infomaniak** | Suisse, réputé pour son service client, autour de 10 €. Plus simple à prendre en main. |
| **Gandi** | Français, historique, plus cher (autour de 20 €) mais très clair. |

Évitez les bureaux d'enregistrement américains bon marché pour un `.fr` : la
gestion du domaine y est parfois bridée, et le service client ne parle pas
français au moment où vous en aurez besoin.

**Sur la protection des données personnelles**, rien à acheter : pour un `.fr`
détenu par un particulier, l'AFNIC ne publie pas vos coordonnées. C'est déjà
le cas par défaut, et c'est gratuit. Refusez toute option payante vendue sous
ce prétexte.

---

## Ce qu'il faut prendre, et ne pas prendre

À la commande, on vous proposera une longue liste d'options. Une seule compte.

- **Le domaine `roussyetzephy.fr`** — oui, pour le plus d'années possible.
- **Le renouvellement automatique** — oui.
- L'hébergement, la boîte mail, le certificat SSL, le « pack site web » — non.
  L'hébergement du site est gratuit là où nous allons le poser, et le
  certificat y est fourni sans rien demander.

---

## Ensuite : brancher le site

Le site tient en deux fichiers autonomes, sans serveur ni base de données.
Deux hébergements gratuits conviennent, tous deux avec HTTPS automatique :

- **Cloudflare Pages** — on y dépose un dossier, on y branche le domaine. Le
  plus direct quand on n'a pas de dépôt Git à connecter.
- **GitHub Pages** — vous avez déjà le compte. Le site se met à jour tout seul
  à chaque modification du dépôt.

Dans les deux cas, l'hébergeur affichera **les enregistrements DNS à recopier**
chez le bureau d'enregistrement. C'est du copier-coller, et c'est réversible.

---

## Le contrôle qui compte

Une fois en ligne, et **avant de valider l'impression** :

1. Ouvrir `roussyetzephy.fr/hymne` dans un navigateur. La page des paroles
   doit s'afficher.
2. Scanner le QR **de l'épreuve papier** — pas un rendu à l'écran — avec
   l'appareil photo natif du téléphone.
3. Recommencer depuis un autre téléphone, sur le réseau mobile et non sur le
   wifi de la maison.

Tant que ces trois contrôles ne sont pas passés, le livre n'est pas prêt à
imprimer.

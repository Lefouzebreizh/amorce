# L'essai sur téléphone, en sept minutes

Tout ce qui se décide hors appareil est verrouillé par des tests. Ce document
couvre ce qui reste, et qui est de deux natures : ce qu'un **modèle de langage**
répond sur un objet réel (étape 4), et ce que la **caméra tenue à la main**
donne à juger — cadrage compris (étape 4 bis, Accord). Aucune des deux ne se
simule.

Il est écrit pour être suivi **sans rien relire d'autre**, sur le Redmi
Note 12 Plus (HyperOS/MIUI). Chaque étape dit ce qui compte comme réussite,
ce qui compte comme échec, et quoi renvoyer dans ce cas.

Ce qu'il faut avoir sous la main : le téléphone, une clé Gemini
(`aistudio.google.com` ▸ « Get API key »), les trois objets de l'étape 4 et les
quatre surfaces de l'étape 4 bis. La clé ne sert qu'à l'étape 4 — **Accord
n'appelle aucun modèle et fonctionne sans elle.**

---

## 1. Récupérer l'APK — 1 min

GitHub ▸ onglet **Actions** ▸ workflow **Look & Find** ▸ la dernière exécution
verte sur `main` ▸ tout en bas, artéfact **`look-and-find-debug-apk`**.

Le téléchargement est un **zip**, pas un APK. Ouvrir *Fichiers* (l'application
Xiaomi) ▸ Téléchargements ▸ appuyer sur le zip ▸ **Extraire**. L'APK est dedans,
nommé `app-debug.apk`.

- ✅ **Réussite** : `app-debug.apk` visible dans Téléchargements.
- ❌ **Aucune exécution verte** : la dernière poussée n'a pas touché
  `look_and_find/**`, donc le workflow ne s'est pas relancé. Prendre l'exécution
  verte précédente — l'APK reste valable 14 jours.

## 2. Installer — 1 min

Appuyer sur l'APK. MIUI oppose deux refus successifs, tous deux normaux pour une
application qui ne vient pas du Play Store :

1. « Installation d'applications inconnues » → autoriser **Fichiers**.
2. « Analyse de sécurité » / « Envoyer pour analyse » → **Installer quand même**.

Si MIUI refuse sèchement sans proposer de continuer : *Paramètres ▸ Protection de
la confidentialité ▸ Spécial ▸ Installer via USB / Sources externes*, puis
réessayer.

- ✅ **Réussite** : l'icône **Look & Find** apparaît sur l'écran d'accueil.
- ❌ **Échec** : noter le texte exact du refus MIUI et le renvoyer.

## 3. La clé — 1 min

Au premier lancement, l'application ouvre son écran de configuration. Coller la
clé, valider. (Plus tard, elle se change dans **Ma liste ▸ 🔑**.)

Puis autoriser l'appareil photo quand Android le demande.

- ✅ **Réussite** : le viseur s'ouvre, on voit la pièce à l'écran.
- ❌ **« Clé d'API refusée »** : clé mal copiée, ou API Generative Language non
  activée sur le projet Google. Vérifier en ouvrant dans le navigateur :
  `https://generativelanguage.googleapis.com/v1beta/models?key=LA_CLÉ`
  — une liste de modèles = la clé est bonne.
- ❌ **« Le modèle … n'est plus servi par Google »** : renvoyer le message tel
  quel, c'est une constante à changer dans le dépôt, pas une erreur de ta part.

## 4. Scanner trois objets — 2 min

Trois objets choisis pour éprouver trois choses différentes. Les faire dans cet
ordre, chacun cadré **de près, l'objet occupant le centre**, fond dégagé.

| # | Objet | Ce qu'on éprouve | Réussite |
| --- | --- | --- | --- |
| 1 | Une manette de console, ou une boîte d'écouteurs sans fil | Marque et prix d'un produit identifiable | Le nom et la marque sont justes ; le prix est dans le bon ordre de grandeur |
| 2 | Une chaise, ou un meuble courant | Catégorie et dimensions | Catégorie « Mobilier », cotes plausibles en cm (une chaise fait ~45 × 90 × 50) |
| 3 | Un mur nu, ou le plafond | Le refus propre | L'application dit « objet non identifié », elle n'invente pas une fiche |

Pour chacun, regarder **dans cet ordre** :

1. **Le titre et la marque** — est-ce bien l'objet ?
2. **Le prix moyen** — un prix à `0 €` est un échec, pas une absence.
3. **Les marchands** — appuyer sur un lien : il doit ouvrir une page réelle,
   pas une 404.
4. **Les dimensions** — en centimètres, celles du produit, pas de la photo.
5. **Les alternatives** — elles doivent être **moins chères** que le prix moyen.

## 4 bis. Accord — quatre surfaces, 2 min

Numérotée « 4 bis » pour ne pas décaler les renvois à l'étape 5.

C'est le seul essai qui manque encore, et il ne se remplace pas : trente-deux
photos prises **sans voir le viseur** ont été dépouillées le 03/09/2026, et deux
refus sur trois venaient du cadrage, pas de la surface. Un mur photographié de
loin passe pour deux surfaces parce que le centre de l'image était le téléviseur.
**Ici, le carré est à l'écran** — c'est ce qui change tout, et c'est précisément
ce qu'aucune photo de galerie ne peut éprouver.

Ouvrir Accord, et **cadrer de façon que le carré soit entièrement rempli par une
seule surface**. Pas la pièce : la surface.

| # | Surface | Ce qu'on éprouve | Réussite |
| --- | --- | --- | --- |
| 1 | Un mur **coloré** | Le cas nominal | Une palette sort, et la couleur ressemble au mur |
| 2 | Un canapé, un fauteuil, un rideau | Un textile, qui rend moins franc qu'une peinture | Une palette, ou un refus « presque grise » si le tissu est clair |
| 3 | Un mur **blanc ou gris** | Le refus juste | « La surface est presque grise » — c'est la bonne réponse, pas un défaut |
| 4 | Une pièce entière, en reculant | Le refus qui manquait | « Le cadre contient plusieurs surfaces » |

Ce qu'il faut regarder, dans cet ordre :

1. **Le carré est-il rempli** par ce que vous visez ? Si non, c'est le cadrage
   qu'on éprouve, pas la porte.
2. **La couleur rendue ressemble-t-elle à la surface ?** C'est le seul contrôle
   qui compte, et il se fait à l'œil, pas sur le code hexadécimal.
3. **Un refus porte-t-il un geste faisable ?** « Cadrez uniquement le mur » est
   utile ; un refus sans geste est un défaut, même si la cause est juste.

### Le résultat qu'on attend, et celui qui apprend quelque chose

Sur ces quatre-là, **deux palettes et deux refus** est le résultat visé.

Ce qui apprend le plus n'est pas l'échec : c'est **une palette dont la couleur
ne ressemble pas à la surface**. Le module a un défaut mesuré dans ce sens — il
accepte des scènes entières et en rend un brun qui n'est la couleur de rien. Si
ça se produit ici, **avec le viseur**, c'est une information neuve et il faut la
renvoyer.

### Ce qu'il faut renvoyer

Une **capture d'écran du résultat**, et la **photo de la même surface** prise
juste après avec l'appareil photo normal. La paire suffit : elle dit à la fois
ce que l'application a rendu et ce qu'elle regardait.

Il n'y a pas de bouton « réponse brute » ici, et c'est normal — Accord ne
questionne aucun modèle, tout se calcule sur l'appareil.

## 5. Ce qu'il faut renvoyer quand quelque chose cloche

**La réponse brute, avant toute discussion.** Icône **`{}`** en haut de la fiche
▸ bouton **Copier** ▸ coller dans la conversation.

Elle tranche la seule question qui décide du correctif : le modèle s'est-il
trompé, ou l'avons-nous mal lu ? Sans elle, on corrige à l'aveugle une fois sur
deux — et durcir une invite déjà correcte dégrade l'identification de tous les
autres objets.

Elle ne survit pas à la fermeture de l'application. **La copier avant de fermer.**

Avec elle, dire aussi en une phrase ce qui paraît faux (« il dit 12 € pour une
manette »). Le reste se déduit.

## Ce qui n'est pas un échec de cet essai

- **« Voir chez moi » indisponible.** La projection en réalité augmentée demande
  un modèle 3D que l'identification connaisse réellement, et le Redmi Note 12
  n'est pas certifié ARCore. L'application affiche alors les dimensions, ce qui
  est le repère utile. C'est le comportement prévu.
- **Une vignette d'historique manquante.** Les photos vont dans le dossier
  temporaire du système, qu'Android vide quand il manque de place. La fiche
  reste lisible, c'est ce qui compte.
- **Un scan lent la première fois.** L'ouverture de la caméra et la première
  requête réseau se cumulent.

## Après l'essai

Si les trois objets passent : l'inconnu est levé, l'invite tient sur du réel.

Si l'un échoue : la réponse brute suffit à décider quoi corriger, et
`/identification-produit` mène le reste — jusqu'à la PR fusionnée.

**Pour Accord, l'issue n'est pas la même**, et il ne faut pas la confondre avec
la précédente. Ses seuils **ne se retouchent pas sur quelques photos** : la
fiche `projets-actifs/accord.md` porte cette garde, et trois pistes ont déjà été
mesurées puis abandonnées pour l'avoir respectée. Ce que cet essai produit est
un **relevé** — les paires capture/photo — qui va dans la fiche. Un seuil ne
bouge qu'une fois qu'on sait quelle grandeur il devrait mesurer.

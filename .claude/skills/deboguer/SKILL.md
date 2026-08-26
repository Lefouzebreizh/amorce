---
name: deboguer
description: Méthode de débogage systématique pour ce dépôt à cinq projets — comment reproduire une panne avant de la diagnostiquer, ce qui est reproductible ici et ce qui ne l'est pas (caméra, appareil réel, réseau bloqué), et les huit pannes maison qui ne lèvent aucune erreur et se diagnostiquent de travers. À utiliser dès qu'une demande décrit un symptôme plutôt qu'une tâche : « ça marche pas », « l'export est noir », « le son est décalé », « l'application plante au scan », « le radar ne trouve rien », « c'est vide sur mon téléphone », « pourquoi ce test casse », ou avant d'ouvrir un fichier pour « voir ce qui cloche ».
---

# Reproduire avant de diagnostiquer

La tentation, face à un symptôme, est d'ouvrir le fichier suspect et de lire.
C'est le moyen le plus rapide de corriger quelque chose qui n'était pas cassé —
et ce dépôt en offre plusieurs occasions, parce que la moitié de ses pannes
**ne lèvent aucune erreur**. Une police non chargée est remplacée en silence, un
lien objet révoqué donne une image noire, un montage restauré s'ouvre
normalement et sort vide. Lire le code ne montre rien de tout ça ; l'exécuter,
si.

## La boucle

1. **Reproduire.** Trouver la plus petite commande qui montre le symptôme. Si
   elle n'existe pas, c'est le premier travail — pas le diagnostic.
2. **Écrire l'observation, pas l'hypothèse.** « L'export dure 12 s au lieu de
   8 s et le son finit avant l'image » est exploitable ; « il doit y avoir un
   problème de synchronisation » ne l'est pas et oriente déjà la recherche.
3. **Une hypothèse à la fois, avec sa prédiction.** « Si c'est la borne du temps
   écoulé, alors couper la borne allonge encore le fichier. » Une hypothèse qui
   ne prédit rien ne se teste pas.
4. **Réduire par bissection.** Sur un montage, retirer la moitié des plans. Sur
   un scan, réduire à une chaîne. Sur un test, remplacer une entrée par sa
   version minimale.
5. **Vérifier la correction sur la reproduction**, pas sur la lecture du diff.
   Un correctif qu'on n'a pas vu passer du rouge au vert est une conjecture.

Quand une étape n'est pas praticable — et il y en a ici — le dire fait partie du
diagnostic. Un « corrigé » sur un symptôme jamais reproduit est un pari présenté
comme un résultat.

## Ce qui se reproduit, et comment

| Symptôme | La commande qui le montre | Ce qui ne le montrera pas |
| --- | --- | --- |
| Découpe, notation, guidage, reprise (Amorce) | `npm test` | — |
| Image, son, export, mise en page mobile (Amorce) | `npm run fixtures` puis `npm run dev` puis `npm run verify` | `npm test` : il ne dessine rien et n'entend rien |
| Reprise après rechargement (Amorce) | `npm run verify:reprise` | le parcours principal, qui se réinitialise |
| Logique métier, providers (Look & Find) | `cd look_and_find && flutter test` | — |
| Erreur de compilation qui pointe un `.g.dart` | `dart run build_runner build` **d'abord** | l'analyse seule, qui accuse le fichier généré |
| Notation, filtres, sécurité (radar crypto) | `cd pepites && python3 -m unittest discover -s tests` | — |
| Effet d'un réglage (radar crypto) | `cd pepites && python3 profils.py` | les tests, qui passent sans dire que la note a chuté |
| Réponse d'API malformée (radar crypto) | ajouter la charge utile à `ClientFactice` dans `tests/test_pipeline.py` | un vrai scan : le réseau est refusé ici |
| Mixage, atténuation (studio audio) | `python3 -m unittest discover -s mon-app-audio/tests` | — |
| Une couverture illisible en vignette (KDP) | `python3 kdp/vignette.py --source … --vers …` **et regarder l'image** | les chiffres seuls, qui disent où regarder |

## Ce qui ne se reproduit pas ici

Le dire au lieu de conclure :

- **La caméra, la réalité augmentée, la qualité d'identification du modèle.**
  Elles demandent un appareil réel.
- **Le build Android et iOS.** `dl.google.com` est refusé par le mandataire des
  sessions distantes. C'est le workflow GitHub qui construit l'APK.
- **Les appels réseau du radar crypto.** `api.dexscreener.com` et les services de
  sécurité sont refusés par le même mandataire : un scan s'arrête sur « Réseau
  indisponible » au bout d'une trentaine de secondes. **Ce n'est pas une panne
  de l'outil**, et c'est le premier faux diagnostic à écarter.
- **La chaîne KDP de bout en bout.** Elle demande des PDF assemblés à partir de
  rushes non versionnés.

## Les pannes maison qui ne lèvent rien

Chacune a déjà coûté une session à quelqu'un. Quand le symptôme y ressemble,
commencer par là plutôt que par une lecture du code.

- **Image noire à l'export ou après reprise** → un lien objet révoqué ou
  ressuscité. `persistence.ts` vide les liens au rangement et les recrée au
  retour ; conserver l'ancien produit un rendu noir sans un message.
- **Une police remplacée en silence** → le canvas ne déclenche pas le chargement
  d'une police. Sans `preloadCaptionFonts` avant tout tracé, le navigateur
  substitue une police système et personne ne le dit.
- **Un canvas qui se vide tout seul** → un `<canvas>` redimensionné est effacé et
  son contexte réinitialisé. D'où le cache de `resolveContext`.
- **Un export plus long que le montage, son décalé** → la borne du temps écoulé
  laissée active pendant l'export. Elle protège d'une mise en veille hors
  export, elle désynchronise pendant.
- **Un montage restauré qui s'ouvre normalement et se lit vide** → un plan
  orphelin dont le média a été évincé du stockage du navigateur. La reprise
  n'est pas une sauvegarde.
- **Une erreur Dart qui accuse un fichier généré** → un provider `@riverpod`
  modifié sans régénération. `build_runner` avant l'analyse, toujours.
- **« Le radar ne trouve plus rien »** → dans l'ordre : la découverte (regarder
  le tableau « Écartés avant notation » du rapport), puis la persistance
  (« premier relevé » partout est normal), et seulement ensuite les seuils. Une
  erreur de configuration est refusée au chargement avec un message ; si le
  programme démarre, ce n'est pas elle.
- **Un jeton crypto qui sort « sûr » sans raison** → une source qui a répondu
  sans rien savoir. Vérifier que le verdict nomme ses sources ; `INCONNU` avec un
  facteur réduit est le comportement correct, pas une panne.

## Ce qu'on ne fait pas

- **« C'est un test instable » n'est pas une cause.** Ce n'en est une qu'après
  l'avoir vu passer et échouer sur le même commit sans rien changer d'autre.
- **On ne désactive pas un test pour passer au vert.** Le test décrit ce que le
  code doit faire ; s'il a tort, c'est une décision à écrire, pas à contourner.
- **On ne corrige pas deux choses à la fois.** Deux correctifs simultanés dont
  l'un suffisait laissent un changement non justifié dans le diff, et personne
  ne saura lequel.
- **On ne touche pas au code voisin en passant.** Ce dépôt tient par les blocs
  de commentaires en tête de fichier : ils portent la justification des
  décisions. Un bloc devenu faux coûte plus cher qu'un bloc absent — si le
  correctif l'invalide, le corriger fait partie du correctif.

## Rendre compte

La reproduction, la cause, le correctif, et **la vérification qui est passée du
rouge au vert**. Si le symptôme n'a pas pu être reproduit, le dire en premier :
c'est l'information la plus importante du rapport, pas une note de bas de page.

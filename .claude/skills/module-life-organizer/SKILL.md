---
name: module-life-organizer
description: "Dans quel ordre écrire un module de l'assistant de rangement Life-Organizer, et les quatre pièges du domaine qui coûtent chacun une reprise complète — la date qui ment, le doublon qui n'en est pas, l'outil externe absent, le dossier qui contient n'importe quoi. À utiliser dès qu'on touche à `life-organizer/`, et dès qu'une demande parle de ranger, trier, dédoublonner, convertir, agrandir, scanner ou nettoyer des fichiers personnels : « écris le module nettoyage », « ajoute la détection des photos floues », « il faut convertir les HEIC », « range mes photos par date », « détecte les doublons », « suis mes abonnements ». Les pièges ne sont écrits nulle part ailleurs, et aucun ne se voit avant d'avoir traité deux mille fichiers."
---

# Écrire un module de Life-Organizer

**Lire `life-organizer/README.md` d'abord.** Les cinq décisions structurantes y
sont — découpe en trois fichiers, imports tardifs, quarantaine plutôt que
suppression, réglages dans un seul fichier, aucun secret dans la configuration.
Elles ne sont pas répétées ici : cette recette a été amaigrie après un banc
d'essai où un agent sans elle a suivi ces règles à la lettre, en citant le
`README`, le validateur de configuration et les commentaires d'en-tête. Ce qui
suit est ce que le projet ne dit nulle part.

## L'ordre de travail

1. **`regles.py` en premier, et ses tests avec.** Tant que la décision n'est pas
   juste, coder le geste est du temps perdu — et écrire le geste d'abord finit
   toujours par y faire migrer la décision.
2. **Les réglages dans `organizer_config.json`**, avant d'écrire le code qui les
   lit : c'est en nommant un seuil qu'on découvre qu'il en fallait deux.
3. **`traitement.py`** ensuite, une fois qu'il n'a plus qu'à obéir.
4. **`commande.py`**, branché sur `organizer.py`.
5. **Vérifier** : `python3 -m unittest discover -s life-organizer/tests`, puis
   la commande elle-même sur un dossier fabriqué pour l'occasion — un module qui
   n'a jamais vu de vrai dossier n'a pas été essayé.

## Un module n'appelle jamais un autre module

Ce qu'ils partagent va dans `noyau/`. Le classement a besoin du type détecté par
le scan : il le reçoit en argument, il ne va pas le chercher. Cette règle-là
n'est pas dans le `README`, et c'est celle qui décide si la chaîne reste
démêlable au sixième module.

## Les quatre pièges

Aucun ne se voit sur dix fichiers de test. Tous se voient sur deux mille.

1. **La date de modification n'est pas la date de la photo.** Une copie, une
   restauration de sauvegarde, un transfert par messagerie la réécrivent — et
   range alors dix ans de souvenirs sous le mois courant. L'ordre de
   `classement.source_de_la_date` est le bon : EXIF, métadonnées, nom de
   fichier, et modification en tout dernier recours.
2. **Deux fichiers identiques ne sont pas des doublons, et réciproquement.** Une
   photo recadrée, recompressée ou passée par une messagerie a d'autres octets
   et la même image : seul le hachage perceptuel les rapproche, jamais un SHA.
   À l'inverse, deux photos d'une rafale sont *presque* identiques sans être des
   doublons — d'où `doublons.distance_max`, et son réglage prudent par défaut.
3. **Les outils externes manquent souvent.** `ffmpeg` et `tesseract` ne sont pas
   des paquets Python : `pip install` ne les fait pas apparaître. Les chercher
   au démarrage (`noyau/outils_externes.py`) et désactiver proprement le module
   concerné, avec le message qui dit quoi installer. Découvrir l'absence au
   millième fichier coûte les neuf cent quatre-vingt-dix-neuf premiers.
4. **Un dossier réel contient n'importe quoi** : un fichier de 0 octet, un nom
   avec un saut de ligne, un lien symbolique qui boucle, un fichier verrouillé
   par une autre application, un `.HEIC` qui est un PNG déguisé. Le parcours les
   enjambe et les consigne — il ne s'arrête pas.

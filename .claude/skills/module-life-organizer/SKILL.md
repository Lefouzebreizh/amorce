---
name: module-life-organizer
description: Recette pour écrire ou modifier un module de l'assistant de rangement Life-Organizer — où poser chacun des trois fichiers, ce qui doit rester pur et testable, comment charger les bibliothèques lourdes sans plomber le démarrage, et la règle de sécurité qui interdit de supprimer quoi que ce soit. À utiliser dès qu'on touche à `life-organizer/`, et dès qu'une demande parle de ranger, trier, dédoublonner, convertir, agrandir, scanner ou nettoyer des fichiers personnels : « écris le module nettoyage », « ajoute la détection des photos floues », « il faut convertir les HEIC », « range mes photos par date », « détecte les doublons », « relance les abonnements ». Ne pas écrire de module Life-Organizer sans l'avoir lue : la découpe en trois fichiers n'est devinable par rien.
---

# Écrire un module de Life-Organizer

Lire d'abord `life-organizer/README.md` : les cinq décisions structurantes y
sont et cette recette ne les répète pas. Ce document dit **quoi écrire, dans
quel ordre**.

## Un module, trois fichiers, jamais moins

`life-organizer/modules/<nom>/` :

| Fichier | Ce qu'il contient | Ce qu'il ne contient jamais |
| --- | --- | --- |
| `regles.py` | La décision, en fonctions pures : ce fichier est-il flou, où doit-il aller, comment doit-il s'appeler | Aucun accès disque, aucun `import cv2`, aucun `subprocess` |
| `traitement.py` | Le geste : lire, décoder, convertir, déplacer. Applique la décision, ne la prend pas | Aucun seuil, aucune règle métier |
| `commande.py` | Arguments, affichage, code de sortie | Aucun calcul |

Cette découpe n'est pas de la cosmétique : c'est ce qui permet de vérifier un
seuil de netteté sur des nombres, en une seconde, sans décoder une image ni
installer OpenCV. Un module dont la décision vit dans `traitement.py` n'est
testable qu'en fabriquant des fichiers de test — donc il ne sera pas testé.

## L'ordre de travail

1. **Écrire `regles.py` en premier, et ses tests avec.** Tant que la décision
   n'est pas juste, coder le geste est du temps perdu.
2. **Ajouter les réglages dans `organizer_config.json`.** Un seuil qui mérite
   d'être réglé y va ; sinon il reste dans `regles.py`, en constante nommée,
   avec le commentaire qui justifie sa valeur. Jamais un nombre nu dans le code.
3. **Écrire `traitement.py`**, en important les bibliothèques lourdes **dans le
   corps des fonctions**. Un `import cv2` en tête de fichier ferait payer trois
   secondes de démarrage à `life-organizer abonnements`, qui ne lit qu'un JSON.
4. **Brancher `commande.py`** sur `organizer.py`.
5. **Vérifier** : `python3 -m unittest discover -s life-organizer/tests`.

## Ce qui ne se négocie pas

**Rien ne se supprime.** Ce qui est écarté part dans le dossier de quarantaine
daté, purgé après le délai de `securite.retention_quarantaine_jours`. Un module
qui appelle `Path.unlink()` sur un fichier de l'utilisateur est un module à
réécrire — l'outil range des souvenirs de famille, il n'a pas droit à un faux
positif définitif.

**La simulation est le mode par défaut.** Toute commande doit pouvoir dire ce
qu'elle ferait sans rien faire, et c'est ce qu'elle fait quand rien n'est
précisé (`securite.simulation_par_defaut`). Le passage à l'acte est explicite.

**L'original survit à sa conversion.** `conversion.conserver_original_jusqua_
verification` : on ne remplace qu'après avoir relu le fichier produit et
constaté le gain. Une conversion qui échoue à moitié laisse deux fichiers, pas
zéro.

**Un module n'appelle pas un autre module.** Ce qu'ils partagent va dans
`noyau/`. Le classement a besoin du type détecté par le scan : il le reçoit en
argument, il ne l'appelle pas. Sinon la chaîne devient un plat de spaghettis
dès le troisième module.

## Les quatre pièges

1. **La date de modification n'est pas la date de la photo.** Une copie, une
   restauration de sauvegarde, un transfert par messagerie réécrivent la date
   du fichier. L'ordre de `classement.source_de_la_date` est le bon : EXIF,
   puis métadonnées, puis nom de fichier, puis modification en dernier recours.
2. **Deux fichiers identiques ne sont pas des doublons.** Une photo recadrée,
   recompressée ou passée par une messagerie a d'autres octets et la même
   image : c'est le hachage perceptuel qui les rapproche, pas un SHA. À
   l'inverse, deux photos d'une rafale sont *presque* identiques et ne sont pas
   des doublons — d'où `doublons.distance_max` et son réglage prudent.
3. **Les outils externes manquent souvent.** `ffmpeg` et `tesseract` ne sont pas
   des paquets Python. `noyau/outils_externes.py` les cherche au démarrage et
   désactive proprement le module concerné, avec un message qui dit quoi
   installer. Échouer au milieu d'un traitement de deux mille fichiers, non.
4. **Un dossier de l'utilisateur peut contenir n'importe quoi** : un fichier de
   0 octet, un nom avec un saut de ligne, un lien symbolique qui boucle, un
   fichier ouvert par une autre application. Le parcours de `noyau/fichiers.py`
   les traverse sans s'arrêter et les consigne dans le journal.

## Conventions

Le français partout — commentaires, messages, intitulés de tests, messages de
commit — les identifiants de code en anglais quand ils sont techniques
(`phash_distance`), en français quand ils sont métier (`passages_parles`,
`mettre_en_quarantaine`). Un bloc en tête de chaque fichier qui explique la
décision de conception, pas ce que fait le code.

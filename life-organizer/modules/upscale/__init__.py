"""Module 5 — agrandissement des photos basse définition.

**Écrit, et à moitié vérifié — la moitié est écrite noir sur blanc.**

`regles.py` décide quoi agrandir, de combien et où poser le résultat. Il ne
touche à rien : ses six décisions se vérifient sur des nombres, et 25 tests les
couvrent. `traitement.py` mesure les images et pilote le modèle.
`commande.py` affiche le plan — **même quand le modèle est absent**, ce qui est
tout l'intérêt : les seuils se règlent ici, le calcul se lance ailleurs.

## Ce qui a été éprouvé, et ce qui ne l'a pas été

| | |
| --- | --- |
| La décision (seuils, facteur borné, refus, file reprenable) | **vérifiée** — 25 tests, plus un vrai dossier de six images |
| La mesure des images (dimensions, netteté) | **vérifiée** sur de vraies images |
| La détection de l'absence du modèle et son message | **vérifiée** |
| **L'inférence elle-même** — `_charger_moteur`, `_agrandir_une` | **jamais exécutée** |

`torch`, `realesrgan` et `basicsr` sont absents de l'environnement où ce module
a été écrit, et les poids ne se téléchargent pas : le mandataire refuse
`huggingface.co`. Le code d'inférence suit l'API publiée de Real-ESRGAN, mais
il n'a pas tourné. **Sa première exécution sur une machine équipée est une
vérification entière qui reste à faire** — et c'est écrit ici plutôt que
supposé, parce qu'un module annoncé prêt et qui ne l'est pas coûte plus qu'un
module annoncé à moitié.

## Ce qu'il ne fera pas

Les vidéos. La fiche d'origine les mentionnait ; agrandir une vidéo, c'est
agrandir chaque image puis réencoder — des heures pour un clip, sur un
processeur. Le jour où cela se justifie, c'est un module à part, pas une option
de celui-ci.

Réglages dans `organizer_config.json`, section « upscale », désactivée par
défaut.
"""

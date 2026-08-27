---
name: capacites-session
description: Savoir ce que cette session-ci peut réellement faire — binaires présents, bibliothèques installées, hôtes que le mandataire laisse joindre, modèles en cache — et par quoi remplacer ce qui manque. Sonde le terrain en une seconde avec `sonder.py`. À utiliser avant toute tâche qui dépend du réseau ou d'un outil externe : transcrire un média, fabriquer une voix, lancer un navigateur, appeler une API, télécharger un modèle, installer une dépendance — et dès qu'une commande échoue par « 403 », « connection refused », « command not found » ou « please run install ». À utiliser aussi avant d'annoncer un résultat qui dépend d'un de ces outils : une promesse tenue à moitié coûte plus cher qu'un « voici ce que je peux faire ici ».
---

# Ce que cette session peut faire

Une session distante n'a ni les binaires, ni le réseau, ni les modèles d'une
machine de développement. Elle ne le dit pas : on l'apprend en pleine tâche,
souvent après avoir annoncé un résultat.

```bash
python3 .claude/skills/capacites-session/scripts/sonder.py
python3 .claude/skills/capacites-session/scripts/sonder.py --court   # une ligne
```

Une seconde. Les binaires, les bibliothèques Python, les paquets Node, huit
hôtes et les modèles en cache, avec le repli de chacun.

## Quand le sonder change quelque chose

Trois moments, et ce sont les seuls :

1. **Avant de planifier** une tâche qui dépend du dehors — média, navigateur,
   API, dépendance à installer. Le plan tient compte du terrain au lieu de
   l'espérer.
2. **Après un échec inexpliqué.** Un `403`, un `command not found`, un
   « please run install » : la sonde dit en une ligne si c'est le terrain ou le
   code.
3. **Avant d'annoncer.** Une promesse tenue à moitié coûte plus cher qu'un
   « voici ce qui est possible ici, voici ce qui demandera votre machine ».

## Ce qui manque a presque toujours un repli

Le script les affiche à côté du manque, au moment où on les lit. Les quatre qui
ont déjà coûté un détour dans ce dépôt :

| Ce qui manque | Ce qu'on fait à la place |
| --- | --- |
| `ffprobe` | `ffmpeg -i fichier` donne les mêmes informations sur sa sortie d'erreur. `imageio-ffmpeg` fournit ffmpeg, jamais ffprobe. |
| Modèle Whisper | Le téléchargement est refusé ici. Demander le texte, ou faire lancer la transcription sur la machine de l'utilisateur. **Ne pas réessayer** : ce n'est pas une panne passagère. |
| Voix edge-tts | Le service refuse les sessions distantes. Écrire le code, le couvrir par des tests unitaires, et le dire — plutôt que l'annoncer vérifié. |
| Chromium de Playwright | Il est là, mais pas à la révision attendue : `AMORCE_CHROMIUM=/opt/pw-browsers/chromium`. Ne **jamais** lancer `playwright install`, le dépôt l'interdit. |

## La règle qui fait gagner du temps

**Un hôte refusé par le mandataire ne se retente pas.** Le refus vient de la
politique réseau de la session, pas d'un incident : la deuxième tentative
échouera exactement comme la première, et la troisième aussi. Ce qui se gagne,
c'est ce qu'on fait ensuite — annoncer la limite, proposer le chemin local,
continuer sur ce qui marche.

Le corollaire vaut autant : **un outil absent ne s'installe pas par réflexe**.
Sur ce dépôt, `playwright install` est explicitement interdit et retéléchargerait
un navigateur déjà présent. Chercher le repli avant l'installation.

## Étendre la sonde

Les listes de `sonder.py` ne sont pas génériques : ce sont les besoins réels des
projets d'ici. En ajouter une entrée se justifie par un usage constaté, pas par
une intuition — une sonde qui grossit sans raison ralentit chaque démarrage et
finit par n'être plus lancée.

Quand une capacité manque **et** qu'un repli existe, l'écrire dans `REPLIS` :
c'est ce que la prochaine session lira au moment exact où elle en a besoin.

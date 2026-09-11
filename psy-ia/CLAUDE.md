@AGENTS.md

Ce projet hérite du `CLAUDE.md` racine du dépôt (§1 bis, §2, §8, §8 bis…). Ce
qui lui est propre — l'architecture de sécurité à quatre couches et ce qui
n'est pas encore validé — vit dans [SECURITY.md](./SECURITY.md) et
[TODO.md](./TODO.md), pas ici : ne pas dupliquer, les lire.

Deux règles à ne jamais perdre de vue sur ce projet précis, en plus de
celles du dépôt racine :

1. **L'avis humain prime toujours sur le vert des tests automatiques**, et
   plus encore ici : un test qui passe sur `crisisDetection.ts` prouve que
   le code applique la liste de motifs écrite, jamais qu'elle est
   cliniquement juste. Cette deuxième chose n'existe que validée par un
   professionnel de santé mentale (SECURITY.md, couche 4).
2. **Vérifier le parcours complet comme une vraie personne avant de
   déclarer un travail terminé**, jamais seulement les tests unitaires — et
   sur ce projet, cette vérification humaine doit inclure des simulations
   volontaires de situations de crise à chaque étape avant toute mise en
   ligne (voir TODO.md).

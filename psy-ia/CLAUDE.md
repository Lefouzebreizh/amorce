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

## Les trois règles qui ne dépendent pas du projet

Posées dans le `CLAUDE.md` de la racine, rappelées ici le 11/09/2026 à la
demande du propriétaire, après un audit de processus : elles n'existaient que
dans quelques projets, et une session qui n'ouvre que ce dossier-ci n'en lisait
aucune.

**Ce bloc dit la règle, jamais son détail.** Le détail vit à la racine, à
l'endroit cité, et ne se recopie pas : une règle écrite à deux endroits diverge
au premier changement, et c'est la moins bonne des deux qui est lue une fois
sur deux.

1. **Jamais un minimum qui fonctionne juste** — racine, §1 ter. « Ça marche »
   et « les tests sont verts » sont le début du travail, pas sa fin. Une brique
   livrée se retravaille jusqu'à un niveau vraiment abouti ; ce qui est fini est
   ce dont on n'a plus rien à redire en le regardant ou en l'utilisant. Cette
   barre est la même sur tous les projets du dépôt.
2. **`Projet : psy-ia` en tête de la toute première réponse** — racine, §9 — et
   rappelé à chaque changement de sujet. Le nom est celui que le dépôt emploie,
   jamais une paraphrase. Ce dépôt porte vingt-trois chantiers : sans cette
   ligne, un fil qui dérive au fil des heures ne dit plus à quel dossier la
   réponse en cours se rattache.
3. **Rebase sur `main` à jour avant d'ouvrir la pull request** — racine, section
   Git — puis fusionner dès que le lot tient debout. Plusieurs sessions écrivent
   ce dépôt en parallèle, et une branche qui attend collectionne les conflits sur
   les mêmes fichiers : un conflit à vingt-quatre fichiers a déjà été payé pour
   l'avoir oublié.

   ```bash
   git fetch --prune -q origin main && git rebase origin/main
   ```

Tout le reste — invariants, garde-fous, zones sensibles, ce qui part seul et ce
qui attend — est dans le `CLAUDE.md` de la racine. **Le relire avant chaque
changement**, pas seulement au début du fil : il bouge plusieurs fois par jour,
poussé par les autres sessions.

Et avant le premier geste : `inbox/psy-ia.md`, la boîte aux lettres de ce
chantier. Un fichier qui dit « aucun message en attente » est une réponse ;
ne pas le sauter.

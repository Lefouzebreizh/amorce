# life-organizer — guide du sous-projet

Rangement de fichiers personnels, Python. Source du coffre chiffré porté dans `le-coffre/` et du classement de document par modèle de vision.

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
2. **`Projet : life-organizer` en tête de la toute première réponse** — racine, §9 — et
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

Et avant le premier geste : `inbox/life-organizer.md`, la boîte aux lettres de ce
chantier. Un fichier qui dit « aucun message en attente » est une réponse ;
ne pas le sauter.

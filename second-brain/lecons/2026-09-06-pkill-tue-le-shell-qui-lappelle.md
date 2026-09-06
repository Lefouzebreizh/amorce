# `pkill -f` tue le shell qui l'appelle

06/09/2026 — mesuré en arrêtant un serveur de développement, dans `iptv/`.

## Ce qui s'est passé

Pour arrêter un serveur lancé en tâche de fond :

```bash
pkill -f "next dev"
```

La commande n'a rien affiché du tout — ni erreur, ni confirmation — et le tour
s'est terminé sur un code de sortie nu. Rien dans ce symptôme ne dit qui est
mort.

## La cause, isolée

`pkill -f` compare le motif à la **ligne de commande entière** de chaque
processus. Or une session d'agent n'exécute pas la commande dans un interpréteur
interactif : elle la passe à `bash -c "<le texte complet>"`. Le texte contient
le motif, donc **la ligne de commande du shell appelant contient le motif** —
et `pkill` le trouve, exactement comme il trouve le serveur.

Mesuré sur les deux formes, à la suite :

| commande | résultat |
| --- | --- |
| `bash -c 'echo …; pkill -f "next dev"; echo SURVECU'` | **`Terminated`, code 143** — `SURVECU` n'est jamais affiché |
| `bash -c 'echo …; pkill -f "n[e]xt dev"; echo SURVECU'` | code 0, `SURVECU` affiché |

143 = 128 + 15, le SIGTERM que `pkill` envoie par défaut. Le shell s'est tué
lui-même.

Le même script écrit dans un fichier et lancé par `bash auto.sh` **survit** : la
ligne de commande vaut alors `bash auto.sh` et ne contient plus le motif. Ce
n'est donc pas une propriété de `pkill`, c'est une propriété de **la façon dont
la commande arrive au shell** — et depuis une session, c'est toujours `-c`.

## Les deux parades

Briser l'auto-correspondance sans changer ce qui est cherché, par une classe de
caractères d'un seul caractère :

```bash
pkill -f 'n[e]xt dev'
```

Ou ne pas chercher du tout : garder le PID au lancement, ce que fait déjà
`iptv/demarrer.sh`.

```bash
npm run dev >/tmp/dev.log 2>&1 &
serveur=$!
trap 'kill "$serveur" 2>/dev/null' EXIT INT TERM
```

La seconde est meilleure partout où on a lancé le processus soi-même : elle vise
un processus précis au lieu d'un motif, donc elle ne peut atteindre ni le shell,
ni le voisin qui porte le même nom.

## Ce qui rend le piège coûteux

Le symptôme ment sur sa victime. Une commande qui meurt sans rien afficher se
lit comme « le serveur a planté », et on part lire son journal — qui est vide et
normal, puisque c'est le shell qui est mort. Le coût n'est pas le tour perdu,
c'est le diagnostic lancé dans la mauvaise direction.

# Un menu peut périmer avant le feu vert

**03/09/2026** — mesuré à la minute sur quatre fusions, en cherchant pourquoi un
lot autorisé n'avait plus rien à faire.

## Ce qui a été mesuré

Le §0 bis demande, avant d'écrire sur de l'existant, d'annoncer un menu et
d'attendre l'accord. Une session a relevé quatre écarts que
`verifier-coherence.py` signalait sur `main`, écrit le menu correspondant, et
attendu.

Voici ce qui s'est passé entre l'écriture du menu et l'arrivée du « go », en
temps universel :

| heure | fusion |
| --- | --- |
| 16:09:42 | le compte des projets Vercel corrigé — **point 2 du menu** |
| 16:11:12 | la PR de la session qui attendait |
| 16:12:19 | `le-coffre` écarté du `tsconfig.json` racine — **point 3** |
| 16:14:59 | `le-coffre` déclaré dans `CLAUDE.md` — **points 1 et 4** |

Le premier correctif a atterri **à la minute où le menu s'écrivait**. Le dernier
cinq minutes après. Quand le « go » est arrivé, `verifier-coherence.py` rendait
déjà « Le dépôt dit vrai sur lui-même ».

Aucune des trois sessions ne savait ce que faisaient les deux autres : elles
avaient toutes vu le même rouge, et c'est précisément ce qui les a fait
converger. **Un contrôle rouge sur `main` est visible par tout le monde en même
temps.**

## La leçon

**La boucle du §0 bis — menu, attente, accord — introduit une latence que les
sessions parallèles remplissent.** Elle est bornée par le temps de réponse du
propriétaire, qui pilote depuis un téléphone : quelques minutes, parfois
plusieurs heures. Dans ce dépôt, cinq minutes suffisent pour trois lots.

Ce n'est pas une objection au §0 bis. La règle protège de l'écrasement et elle
est juste ; ce qui manquait est la conséquence de sa latence, et elle tient en
une ligne.

## Le geste

**Remesurer après le feu vert, pas seulement avant le menu.** La cartographie
qui a produit le menu date d'avant l'attente ; celle qui décide de la première
écriture doit dater d'après. Une commande, deux secondes :

```bash
git fetch origin main && git checkout -B <branche> origin/main
# puis le contrôle qui avait motivé le lot
python3 .claude/skills/coherence-depot/scripts/verifier-coherence.py
```

Si le rouge a disparu, le lot n'a plus lieu d'être : on le dit et on passe à
autre chose. Écrire quand même produirait un conflit sur les mêmes lignes, ou
pire, un correctif qui défait celui d'une autre session sans que personne le
voie.

C'est le symétrique du `grep` avant remplacement de `CLAUDE.md` §10 : là-bas on
regarde qui dépend du code, ici on regarde si le défaut existe encore.

## Ce qui rend la chose contre-intuitive

Un menu approuvé **ressemble** à une décision acquise — il a été écrit, lu,
validé. La tentation est de l'exécuter tel quel, parce que le revalider
paraîtrait revenir sur la parole donnée.

C'est l'inverse : le « go » autorise **le geste**, il ne garantit pas que le
geste ait encore un objet. Revérifier n'est pas rouvrir la question, et ça ne
coûte pas un aller-retour — c'est une commande, seul.

## Ce que ça ne change pas

Le menu reste utile même quand il devient caduc : c'est lui qui a fait nommer
les quatre écarts par écrit, et deux des trois sessions correctrices ont livré
exactement ces points-là. Un défaut nommé publiquement se corrige plus vite
qu'un défaut que chacun voit sans le dire — y compris quand ce n'est pas celui
qui l'a nommé qui le corrige.

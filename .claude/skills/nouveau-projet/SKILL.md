---
name: nouveau-projet
description: Ajouter un projet à ce dépôt multi-projets sans rien oublier — les six endroits où il doit se déclarer pour être installé, vérifié, gardé par l'intégration continue et retrouvé par la session suivante, et ce qui se déclare tout seul. À utiliser dès qu'on crée un dossier de projet à la racine, qu'on démarre un outil, un assistant, une chaîne ou une application dans ce dépôt, qu'on met un chantier en sommeil ou qu'on le réveille, et quand une demande dit « nouveau projet », « on commence X », « pose l'architecture de », « ajoute un dossier pour » — y compris quand elle ne parle que du code à écrire, car c'est justement la déclaration qu'on oublie.
---

# Ajouter un projet ici

Ce dépôt en héberge une dizaine, sans code commun. Un projet qui n'est déclaré
nulle part fonctionne chez celui qui l'écrit et nulle part ailleurs : ses
dépendances manquent à la session suivante, ses tests ne gardent rien, et
personne ne sait comment le vérifier.

## Les six endroits

Dans cet ordre — chacun devient inutile si le précédent manque.

| # | Où | Ce qu'on y met | Ce que son oubli coûte |
| --- | --- | --- | --- |
| 1 | `<projet>/README.md` | Ce que fait le projet, comment le lancer, les décisions qui le tiennent | Le projet n'est reprenable que par son auteur |
| 2 | `.gitignore` | Ce qu'il ne versionne jamais : données personnelles, poids de modèles, sorties | Des données privées ou des centaines de mégaoctets dans l'historique — irréversible |
| 3 | `CLAUDE.md`, phrase d'en-tête | Le projet et son dossier, **et le compte recalculé** | Les sessions suivantes ignorent son existence |
| 4 | `.claude/hooks/session-start.sh` | L'installation de ses dépendances | Chaque session distante réinstalle à la main, ou échoue |
| 5 | `.claude/skills/verifier/SKILL.md` | Sa séquence de vérification, et ce qu'elle ne couvre pas | Personne ne sait comment savoir si c'est vert |
| 6 | `.github/requirements-tests.txt` | Les bibliothèques que ses **tests** atteignent | La CI rougit sur `ModuleNotFoundError` |

Le 6 mérite sa nuance : ce fichier est **volontairement plus court** que le
hook. Le hook prépare une session où l'on *exécute* les programmes ; la CI
n'installe que ce que les *tests* traversent. Y recopier la liste du hook fait
passer la vérification de quinze secondes à plusieurs minutes sans couvrir une
assertion de plus.

## Ce qui se déclare tout seul

**Une suite de tests Python n'a rien à déclarer.** `tests-python.yml` découvre
les `*/tests` contenant des `test_*.py` — parce qu'une liste écrite à la main
est fausse le lendemain dans ce dépôt, et fausse en silence. Poser les tests
dans `<projet>/tests/` suffit à être gardé.

Deux conséquences qui se paient cher si on les ignore :

- **Un seul niveau.** `archives-backlog/x/tests` n'est **pas** découvert. Un
  projet mis en sommeil sort donc du filet : c'est cohérent, mais il faut le
  savoir avant de croire qu'il est encore gardé.
- **Un projet qui n'est pas en Python** a besoin de son propre workflow, avec
  ses filtres de chemins — voir `amorce.yml`, `agence.yml`, `look-and-find.yml`.

## Une recette, ou pas

Un projet ne mérite une compétence (`.claude/skills/`) que s'il porte des
règles **que rien de générique ne connaît** : un piège du domaine, une frontière
de conception, une contrainte mesurée. Une recette qui paraphrase le `README`
du projet coûte du contexte à chaque session et n'apprend rien.

Si elle existe, l'inscrire dans la table de `CLAUDE.md` — c'est là qu'on la
cherche.

## L'ordre qui évite de revenir en arrière

1. Le dossier, son `README.md`, la ligne du `.gitignore`. Rien d'autre.
2. Le premier module **pur** et son test : c'est ce qui dit si l'architecture
   tient, et ça se vérifie sans rien installer.
3. Le hook et `requirements-tests.txt`, **avant** de dépendre d'une
   bibliothèque de plus. Une dépendance qu'une session fraîche ne peut pas
   installer rend le projet invérifiable ailleurs que chez soi.
4. `CLAUDE.md` et `/verifier`, ensemble : déclarer un projet sans dire comment
   le vérifier ne sert à personne.
5. La PR — voir `/branche-partagee`, ces fichiers de la racine sont exactement
   ceux qui entrent en conflit.

## Avant d'écrire la première ligne

Regarder les branches et les PR ouvertes. Deux sessions ont fabriqué
Life-Organizer chacune de son côté et la seconde a été refaite entièrement. Ce
qui est fusionné gagne : trente secondes de vérification valent mieux qu'une
architecture à jeter.

Et si l'idée n'est pas encore tranchée, elle relève de `/idee-faisabilite`,
qui la note et la range dans `inbox/`, `projets-actifs/` ou
`archives-backlog/` — pas d'un dossier créé à la hâte.

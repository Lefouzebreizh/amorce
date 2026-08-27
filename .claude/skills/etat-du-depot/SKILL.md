---
name: etat-du-depot
description: Répondre « où en est le dépôt » et « est-ce que je peux faire ça ici » par une mesure plutôt que par une liste écrite à la main, avec `.claude/outils/etat.py` — les chantiers découverts et leur activité, l'écart avec `main`, et l'outillage réellement installé avec la parade de chaque absent (ni `ffprobe`, ni `pdftotext`, ni `tesseract`, ni `gh` ne sont là, et aucun ne bloque). À utiliser au début d'une session, avant de s'engager dans un gros travail, avant d'écrire un compte rendu ou un résumé du dépôt, et dès qu'une demande dit « où on en est », « fais le point », « qu'est-ce qu'il y a dans ce dépôt », « combien de projets », « c'est possible de… », « tu peux lire ce format », « il me faut un PDF / un tableur / une transcription » — y compris quand une commande vient d'échouer avec « command not found ».
---

# Ce dépôt rend fausses les listes qu'on écrit à la main

Deux fois déjà, un inventaire tenu à la main a menti sans que rien ne le
signale : `CLAUDE.md` a annoncé dix projets là où il en énumérait neuf, et la
ligne du hook a listé les dépendances installées avec trois projets de retard.
Un texte périmé ne casse aucun test — c'est ce qui le rend coûteux.

Le script ne connaît donc pas les chantiers : il les **découvre**, en cherchant
les répertoires racine qui contiennent du code ou des commits. Un dixième
chantier apparu ce matin y figure sans que personne l'ait déclaré.

```bash
python3 .claude/outils/etat.py
```

Il rend la branche, la tête, **l'écart avec `origin/main`** — avec le renvoi vers
`/fusionner-main` s'il y a du retard — l'état de l'arbre, puis un chantier par
ligne : lignes de code, commits, fichiers de test, dernière touche.

Les trois colonnes se lisent ensemble. Beaucoup de lignes et peu de commits, sur
un chantier posé il y a plusieurs jours, c'est un projet né d'une session et
jamais rouvert. Zéro test sur un chantier qui en a mille, c'est ce qui cassera
en premier.

## « Est-ce que c'est possible ici ? » — presque toujours oui

```bash
python3 .claude/outils/etat.py --outillage
```

Une session distante n'a pas ce qu'on croit. `ffprobe`, `pdftotext`, `pdfinfo`,
`qpdf`, `tesseract`, `convert` et `gh` sont **absents**, alors que ce sont les
commandes que l'on tape d'instinct pour lire un média, un PDF ou une PR.

Ce qui rend l'absence coûteuse n'est pas l'absence : c'est de la découvrir en
plein travail, d'échouer, puis de conclure « ce n'est pas possible » — ce qui est
faux six fois sur sept. Le script liste donc ce qui manque **et la parade** :

| Réflexe absent | Ce qui le remplace, déjà installé |
| --- | --- |
| `ffprobe` | `ffmpeg -i <fichier>` — mêmes métadonnées, sur la sortie d'erreur |
| `pdftotext` | pdfplumber (`extract_text`) ou pymupdf (`get_text`) |
| `pdfinfo` | pymupdf : `len(pymupdf.open(f))`, `page.rect` |
| `qpdf` | pypdf : `PdfWriter` fusionne, découpe, pivote |
| `convert` | Pillow : recadrage, échelle, conversion |
| `gh` | les outils MCP `mcp__github__*` |

Sont réellement indisponibles, et il faut le **dire plutôt que le contourner
mal** : l'OCR (pas de `tesseract`) et la transcription locale (ni `whisper`, ni
`torch` — plusieurs minutes et plusieurs gigaoctets à installer, à annoncer
avant de se lancer).

Le reste s'installe en une commande, `pip install --break-system-packages <paquet>`.
L'image est une Debian récente où pip refuse d'écrire hors environnement
virtuel ; le drapeau n'est pas une négligence, il est déjà utilisé par le hook de
démarrage pour la même raison.

**Quand une parade manque à la table, l'ajouter au script** après s'en être
servi. C'est ce qui empêche la prochaine session de repayer la même impasse.

## Quand s'en servir

**Au début d'une session**, avant de toucher quoi que ce soit : le dépôt bouge
vite, et la branche courante est peut-être déjà en retard de cinq fusions.

**Avant d'écrire un compte rendu**, un résumé de reprise ou une fiche d'idée —
partout où un chiffre sur le dépôt va être écrit noir sur blanc. Recopier
l'inventaire d'hier, c'est exactement l'erreur que ce script existe pour éviter.

**Quand une commande vient d'échouer** avec « command not found » : la réponse
est probablement dans `--outillage`, avec le remplaçant.

## Ce que le script ne dit pas

Il compte, il ne juge pas. Il ne dit ni si le code est bon, ni si un chantier
mérite d'être poursuivi — pour ça, `INDEX.md` et les fiches de `/idee-faisabilite`
portent la décision, avec une note et une condition de reprise. Il ignore aussi
tout ce qui vit sur GitHub : PR ouvertes, vérifications, revues se lisent avec
les outils `mcp__github__*`.

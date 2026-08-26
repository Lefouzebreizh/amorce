---
name: extraction-multiformat
description: >-
  Lire et extraire le contenu d'un fichier que Claude ne peut pas ouvrir
  nativement, en écrivant et exécutant un script Python local plutôt qu'en
  déclarant le format illisible. Couvre les images (JPEG, PNG, HEIC, RAW) et
  leurs métadonnées EXIF/GPS, les livres numériques (EPUB, MOBI), les archives
  (ZIP, RAR, 7z, tar), les bases SQLite, les fichiers d'encodage douteux et
  surtout les binaires dont on ignore le format ou dont l'extension ment.
  Commence toujours par identifier le fichier sur ses octets de tête, car un
  « .jpg » d'iPhone est souvent un HEIC et un « .xls » d'ERP souvent un CSV.
  À utiliser dès qu'on te soumet un fichier à analyser, résumer, fouiller ou
  convertir et qu'il n'est pas du texte simple — y compris quand la demande dit
  seulement « c'est quoi ce fichier », « tu peux lire ça », « extrais-moi les
  données de ce truc », « d'où vient cette photo », « ça s'ouvre avec quoi »,
  ou quand un fichier n'a pas d'extension du tout. Pour la vidéo, l'audio et la
  transcription de parole, utiliser plutôt le skill transcription-media.
---

# Extraction multiformat

Aucun fichier n'est illisible. Il est seulement dans un format qu'il faut
convertir avant de le lire — et cette conversion est un script Python de
quinze lignes que tu peux écrire et exécuter tout de suite.

La règle qui compte : **ne jamais répondre « je ne peux pas lire ce format ».**
Écris le script, lance-le, lis sa sortie, réponds à la question posée.

## Le réflexe : sonder avant d'extraire

L'extension ment plus souvent qu'on ne le croit, et se tromper de bibliothèque
donne une trace d'erreur illisible qui fait perdre plusieurs tours. Commence
donc systématiquement par :

```bash
python3 scripts/sonder.py <fichier>
```

Le script lit les octets de tête, annonce le type réel, signale quand
l'extension trahit le contenu, propose la recette adaptée et dit **quels outils
manquent sur cette machine**. Il accepte plusieurs fichiers, et `--json` si tu
veux enchaîner dessus dans un autre script.

Un cas mérite une mention : quand le rapport affiche `→ un skill dédié existe`,
arrête-toi là et bascule sur ce skill (`pdf`, `xlsx`, `docx`, `pptx`). Ils font
bien mieux que ce que tu réécrirais à la main, et le fichier reste le même.

## La méthode, une fois le type connu

1. **Écris le script dans le répertoire scratch**, pas dans le dépôt de
   l'utilisateur. Ce sont des outils jetables ; les laisser traîner dans un
   projet, c'est du bruit dans son prochain `git status`.
2. **Fais-le imprimer ce que tu veux lire.** Ton script n'a pas besoin de
   produire un fichier : sa sortie console est ce que tu vas analyser. Pour un
   gros volume, imprime un extrait représentatif plus les compteurs (nombre de
   lignes, de pages, de colonnes), et écris l'intégralité dans un fichier
   que tu reliras par morceaux.
3. **Annonce le script avant de le lancer**, en une phrase. L'utilisateur doit
   savoir ce qui va s'exécuter chez lui.
4. **Réponds à la question initiale**, pas au format. Le contenu extrait est un
   moyen ; ce qu'on te demandait, c'est ce qu'il raconte.

## Quand un outil manque

C'est le cas courant, pas l'exception : `ffmpeg`, `tesseract` ou `pillow-heif`
sont absents de beaucoup de machines. Deux mauvaises réponses à éviter — abandonner,
et installer en silence quelque chose de lourd.

La bonne : **extraire ce qui reste accessible sans l'outil manquant**, puis dire
en une ligne ce que l'absence a coûté et la commande qui la comblerait. Un EPUB
se lit très bien avec `zipfile` + `BeautifulSoup` si `ebooklib` n'est pas là ;
un JPEG livre sa date de prise de vue via Pillow seul si `exifread` manque.

Propose l'installation, ne l'impose pas :

```bash
pip install pillow-heif exifread ebooklib chardet
```

## Où trouver la recette détaillée

Le SKILL.md ne porte que la méthode. Chaque famille a son fichier, à lire
seulement quand le sondage désigne cette famille :

| Fichier | Quand le lire |
| --- | --- |
| `references/images.md` | Photos, captures, scans — EXIF, date, GPS, HEIC, OCR |
| `references/livres.md` | EPUB, MOBI, AZW3, et le HTML qu'ils contiennent |
| `references/binaires.md` | Format inconnu, sans extension, ou que rien n'ouvre |

Les archives et les bases SQLite n'ont pas de fiche : `zipfile`, `tarfile` et
`sqlite3` sont dans la bibliothèque standard, et un membre d'archive se
re-sonde avec `sonder.py` comme n'importe quel fichier.

## Ce qu'il ne faut pas faire

- **Deviner le contenu.** Si l'extraction échoue ou ne rend qu'une bouillie,
  dis-le. Une réponse plausible inventée sur un fichier qu'on n'a pas su lire
  est bien pire qu'un « ce PDF est un scan, il faudrait tesseract ».
- **Taire ce qui a été perdu.** Un tableau extrait d'un PDF perd souvent ses
  cellules fusionnées, un EPUB perd sa mise en page. Signale-le quand ça peut
  changer la lecture des données.
- **Envoyer le fichier ailleurs.** Tout se fait en local. Aucune API externe,
  aucun téléversement, sans que l'utilisateur l'ait explicitement demandé — il
  peut s'agir de documents personnels ou confidentiels.

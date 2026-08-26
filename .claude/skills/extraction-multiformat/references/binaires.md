# Format inconnu : que faire d'un fichier que rien n'ouvre

Quand `sonder.py` répond « binaire non identifié », il reste beaucoup à faire.
Un format inconnu n'est pas un mur : c'est une enquête, et elle aboutit dans la
grande majorité des cas parce que les formats vraiment exotiques sont rares.

Mène-la dans cet ordre — chaque étape coûte quelques secondes et le premier
succès dispense des suivantes.

## 1. Regarder les octets de tête

```bash
xxd fichier.dat | head -5
```

La colonne de droite est celle qui parle. Beaucoup de formats écrivent leur nom
en clair dans les premiers octets — `SQLite format 3`, `%PDF-1.7`, `OggS`,
`ftypmp42`. Un motif qui se répète toutes les N colonnes trahit un enregistrement
de taille fixe, donc un format tabulaire binaire.

## 2. Chercher le texte noyé dedans

```bash
strings -n 6 fichier.dat | head -60
```

C'est l'étape la plus rentable de toutes. Un binaire propriétaire contient
presque toujours des noms de champs, des chemins de fichiers, une chaîne de
version, parfois le nom du logiciel qui l'a produit — ce qui donne directement
le format et le moyen de l'ouvrir. Pour du texte en UTF-16 (fréquent sous
Windows), ajouter `-e l`.

## 3. Essayer le déguisement le plus courant

Une bonne moitié des formats modernes sont des archives ZIP renommées :

```bash
unzip -l fichier.dat 2>/dev/null || tar tf fichier.dat 2>/dev/null
```

Si ça liste quelque chose, dépaquette et re-sonde chaque membre avec
`sonder.py` — le contenu utile est presque toujours du XML ou du JSON.

## 4. Mesurer le désordre

```python
import collections, math
o = open(chemin, "rb").read(65536)
c = collections.Counter(o)
h = -sum(n / len(o) * math.log2(n / len(o)) for n in c.values())
print(f"entropie {h:.2f} bits/octet sur {len(c)} valeurs distinctes")
```

L'entropie tranche entre trois mondes, et cette information change entièrement
la suite de l'enquête :

- **sous 6,0** : données structurées non compressées. Il y a de la répétition,
  donc du sens à trouver — continue à chercher, ça vaut le coup.
- **6,0 à 7,5** : format compressé courant, ou mélange en-tête clair /
  charge compressée. Regarde si un en-tête lisible précède la zone dense.
- **au-dessus de 7,9** : compressé ou chiffré. Aucune analyse statistique ne
  donnera rien de plus. Si aucun outil ne le décompresse, c'est le moment de
  s'arrêter et de le dire.

## 5. Demander au système

```bash
file fichier.dat          # sur Unix ; sa base de signatures dépasse largement sonder.py
```

À ne pas oublier alors qu'il est souvent installé : `file` reconnaît plusieurs
milliers de formats. `sonder.py` couvre les cas fréquents et dit quels outils
sont là, mais sur un format rare, `file` est plus savant.

## 6. Chercher le contexte plutôt que le fichier

Souvent l'énigme se résout hors du fichier : son extension, le logiciel qui l'a
produit, les fichiers voisins dans le même dossier. Un `.pak` à côté d'un
exécutable de jeu, un `.idx` à côté d'un `.dat` de même nom (index + données) —
demande à l'utilisateur d'où vient le fichier, c'est souvent plus rapide que
n'importe quelle analyse.

## Quand s'arrêter

Si l'entropie dépasse 7,9, que `strings` ne rend rien et que `file` sèche, le
fichier est chiffré ou compressé par un procédé maison. Dis-le clairement, avec
ce que tu as trouvé au passage (taille, entropie, motifs, chaînes éventuelles)
et ce qu'il faudrait pour aller plus loin — le nom du logiciel d'origine, le
plus souvent.

Un rapport honnête sur un fichier qu'on n'a pas su ouvrir vaut infiniment mieux
qu'une interprétation inventée. C'est le seul cas de ce skill où « je ne peux
pas lire ce fichier » est la bonne réponse — et encore, accompagnée de tout ce
qu'on a appris en essayant.

# Livres numériques : EPUB, MOBI, AZW3

## EPUB

Un EPUB est un ZIP contenant du XHTML. Cela veut dire qu'on peut toujours le
lire, même sans bibliothèque dédiée — c'est le format le plus accommodant de
tous ceux que tu rencontreras.

Avec `ebooklib`, le chemin propre :

```python
from ebooklib import epub
from bs4 import BeautifulSoup

livre = epub.read_epub(chemin)
print("Titre :", livre.get_metadata("DC", "title"))
print("Auteur:", livre.get_metadata("DC", "creator"))

# Parcourir le `spine`, et surtout pas `get_items_of_type(ITEM_DOCUMENT)` :
# celui-ci rend les chapitres dans l'ordre du manifeste, qui n'est pas l'ordre
# de lecture. Mesuré sur un livre à deux chapitres rangés à l'envers, il sort
# le second en premier — sans la moindre erreur, donc sans qu'on le remarque.
for idref, _ in livre.spine:
    item = livre.get_item_with_id(idref)
    texte = BeautifulSoup(item.get_content(), "html.parser").get_text("\n", strip=True)
    if texte:
        print(f"\n===== {item.get_name()} =====\n{texte}")
```

Sans `ebooklib`, la bibliothèque standard fait le même travail. Ce repli sert
deux fois : il évite d'imposer une installation pour un fichier unique, et il
lit des EPUB qu'`ebooklib` refuse. Ce dernier exige que le `container.xml`
porte son espace de noms OCF et s'arrête sur « Can not find container file »
quand il manque — ce qui arrive avec les fichiers produits par des outils de
conversion. `zipfile` ne s'en soucie pas et lit quand même :

```python
import zipfile
from bs4 import BeautifulSoup

with zipfile.ZipFile(chemin) as z:
    # L'ordre de lecture est dans le fichier .opf, pas dans l'ordre du ZIP.
    opf = next(n for n in z.namelist() if n.endswith(".opf"))
    plan = BeautifulSoup(z.read(opf), "xml")
    base = opf.rsplit("/", 1)[0] + "/" if "/" in opf else ""
    sources = {i["id"]: i["href"] for i in plan.find_all("item")}
    for ref in plan.find_all("itemref"):
        nom = base + sources[ref["idref"]]
        print(BeautifulSoup(z.read(nom), "html.parser").get_text("\n", strip=True))
```

Passer par le `.opf` plutôt que par l'ordre des fichiers du ZIP n'est pas un
détail : beaucoup d'EPUB rangent leurs chapitres dans le désordre, et un livre
restitué chapitre 7 avant chapitre 2 se lit comme un texte incohérent sans
qu'aucune erreur ne soit signalée.

## MOBI et AZW3 (Kindle)

Formats propriétaires, sans bibliothèque Python fiable. Le chemin praticable
est `ebook-convert`, l'outil en ligne de commande de Calibre :

```bash
ebook-convert livre.mobi livre.epub
```

Puis traiter l'EPUB obtenu comme ci-dessus. Si Calibre n'est pas installé,
`mobi` (`pip install mobi`) dépaquette certains fichiers, mais échoue sur les
fichiers protégés par DRM.

Un mot sur les DRM : un livre acheté verrouillé ne s'ouvrira pas, et ce n'est
pas un défaut d'outillage. Le dire simplement à l'utilisateur.

## Ce qu'on perd à l'extraction

Le texte sort, la structure souffre. Signale-le quand ça compte :

- Les **notes de bas de page** atterrissent souvent en fin de chapitre, loin de
  leur appel.
- Les **tableaux** deviennent des suites de lignes sans colonnes.
- Les **images** ne sortent pas du tout avec `get_text()` ; si le livre est une
  bande dessinée ou un manuel illustré, l'extraction textuelle ne rend presque
  rien, et il vaut mieux extraire les images du ZIP.
- La **pagination** de l'édition papier n'existe pas dans un EPUB. Impossible
  de répondre « page 214 » — se repérer par chapitre.

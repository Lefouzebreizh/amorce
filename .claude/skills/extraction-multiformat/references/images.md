# Images : pixels, métadonnées, texte

## Ce qu'on cherche dans une image

Trois choses, rarement les mêmes selon la question posée :

- **Les métadonnées** : date de prise de vue, appareil, coordonnées GPS,
  orientation. C'est ce que veut « d'où vient cette photo », « quand a-t-elle
  été prise », « est-ce un original ou une capture ».
- **Le texte** : capture d'écran, scan, photo d'un document. Il faut un OCR.
- **Les pixels eux-mêmes** : dimensions, couleur dominante, transparence.

## Métadonnées EXIF

Pillow suffit dans la plupart des cas et est presque toujours installé :

```python
from PIL import Image, ExifTags

img = Image.open(chemin)
brut = img.getexif()
exif = {ExifTags.TAGS.get(k, k): v for k, v in brut.items()}
print(f"{img.size[0]}×{img.size[1]} px, mode {img.mode}, format {img.format}")
print("Prise de vue :", exif.get("DateTimeOriginal") or exif.get("DateTime") or "absente")
print("Appareil     :", exif.get("Make"), exif.get("Model"))
```

Le GPS demande un détour, parce qu'il est rangé dans un sous-dictionnaire et
codé en degrés/minutes/secondes :

```python
gps = brut.get_ifd(ExifTags.IFD.GPSInfo)
if gps:
    t = {ExifTags.GPSTAGS.get(k, k): v for k, v in gps.items()}
    def dms(valeur, ref):
        d, m, s = (float(x) for x in valeur)
        deg = d + m / 60 + s / 3600
        return -deg if ref in ("S", "W") else deg
    print(dms(t["GPSLatitude"], t["GPSLatitudeRef"]),
          dms(t["GPSLongitude"], t["GPSLongitudeRef"]))
```

Deux avertissements qui évitent des conclusions fausses :

- **L'absence d'EXIF ne prouve rien.** Les réseaux sociaux le suppriment au
  téléversement, et une capture d'écran n'en a jamais eu. Dire « pas de
  métadonnées » plutôt que « photo non datée ».
- **Une date EXIF n'est pas une preuve.** Elle vient de l'horloge de l'appareil
  et s'édite en une commande. Si la question a un enjeu, le dire.

## HEIC (photos d'iPhone)

Pillow seul ne les ouvre pas. Avec `pillow-heif`, tout le code ci-dessus
fonctionne à l'identique, il suffit d'enregistrer le décodeur :

```python
from pillow_heif import register_heif_opener
register_heif_opener()          # à faire avant le premier Image.open
```

Sans la bibliothèque, il reste `exiftool` en ligne de commande, ou la
conversion `sips -s format jpeg photo.heic --out photo.jpg` sur macOS.
Dis alors clairement que les métadonnées ont été lues sur la copie convertie,
qui peut en avoir perdu.

## OCR : extraire le texte d'une image

`pytesseract` pilote le binaire `tesseract`, qui doit être installé séparément —
et le paquet de langue avec, sinon le français ressort truffé de fautes :

```python
import pytesseract
from PIL import Image
print(pytesseract.image_to_string(Image.open(chemin), lang="fra"))
```

Ce qui améliore réellement un OCR médiocre, dans l'ordre du gain : agrandir
l'image ×2 si elle fait moins de 1000 px de large, la passer en niveaux de gris,
puis binariser. Redresser une photo prise de travers compte davantage que
n'importe quel réglage de tesseract.

Si le résultat reste incohérent, dis-le franchement plutôt que de livrer un
texte à demi faux : sur une écriture manuscrite ou une photo floue, tesseract
produit de la bouillie plausible, ce qui est le pire des cas.

## Images sans EXIF exploitable

Reste toujours le fichier lui-même : dimensions, poids, format, présence d'une
couche alpha, palette. Une capture d'écran se reconnaît à des dimensions qui
correspondent exactement à une résolution d'écran courante et à l'absence
totale de métadonnées d'appareil.

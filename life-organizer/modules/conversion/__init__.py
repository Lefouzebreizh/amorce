"""Module 4 — conversion de format, et compression quand elle rapporte.

Écrit. Trois fichiers, dans l'ordre où ils ont été faits :

- `regles.py` — la règle applicable à un fichier, les sept refus qui protègent
  l'original, et le verdict rendu au vu du gain réellement mesuré. Entièrement
  pur : ses tests décident de convertir ou non sans encoder un seul octet.
- `traitement.py` — la mesure (Pillow, ffprobe), l'encodage (Pillow, ffmpeg) et
  le remplacement, qui n'a lieu qu'après relecture du fichier produit.
- `commande.py` — arguments, affichage, code de sortie.

Ce que ce module a appris et qui n'est écrit nulle part ailleurs : **un seuil de
gain unique aurait suffi à le rendre inutile.** Un HEIC repassé en JPEG grossit
presque toujours ; en exiger 15 % de gain, c'était ne convertir aucune photo
d'iPhone tout en ayant l'air de fonctionner. D'où `conversion.regles[].objectif`,
et les deux seuils qui vont avec.

Reste à faire : rien pour le format. Une mémoire des essais infructueux serait
le prochain pas utile — un fichier dont le gain était trop faible est réencodé à
chaque exécution pour être refusé à chaque fois. Sa place est `donnees/`.

Réglages dans `organizer_config.json`, section « conversion ».
"""

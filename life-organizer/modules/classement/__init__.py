"""Module 6 — ranger par date, par type et par thématique.

Écrit. Trois fichiers, dans l'ordre où ils ont été faits :

- `regles.py` — la date qui fait foi selon `source_de_la_date`, la catégorie
  déduite de l'extension, la thématique reconnue dans un texte, le chemin de
  destination composé. Entièrement pur : c'est le module le plus testable des
  six, et ses tests couvrent surtout les quatre refus — ne pas deviner une
  date, ne pas toucher à une extension inconnue, ne pas reproposer ce qui est
  rangé, ne pas ranger un document par sa date quand son sujet est reconnu.
- `traitement.py` — la datation (EXIF, nom de fichier, modification) et les
  déplacements, via `noyau/fichiers.py`.
- `commande.py` — arguments, affichage, code de sortie.

Reste à faire : la source « metadonnees » (date du conteneur vidéo), qui attend
que `noyau/outils_externes.py` sache localiser ffprobe. La commande annonce
qu'elle ne la lit pas encore plutôt que de l'ignorer en silence.

Réglages dans `organizer_config.json`, section « classement ».
"""

"""Module 3 — photos floues, quasi-doublons, vidéos inutilisables.

Trois fichiers à écrire, dans cet ordre :

- `regles.py` — décider à partir de mesures déjà prises : ce score de netteté est-il sous le seuil, ces empreintes sont-elles assez proches, lequel du groupe garde-t-on. Aucun import d'OpenCV ici — c'est ce qui rend le seuil vérifiable en une seconde.
- `traitement.py` — mesurer la netteté (laplacien, Fourier), calculer les empreintes perceptuelles, contrôler l'intégrité des vidéos. OpenCV s'importe dans le corps des fonctions.
- `commande.py` — arguments, affichage, code de sortie.

Réglages dans `organizer_config.json`, section « nettoyage_medias ».
"""

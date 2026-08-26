"""Localisation de ffmpeg et de tesseract, et dégradation propre en leur absence.

Ni l'un ni l'autre n'est un paquet Python : `pip install` ne les fait pas
apparaître. On les cherche au démarrage — celui du système d'abord, puis celui
livré par `imageio-ffmpeg` — et on désactive le module concerné avec un message
qui dit quoi installer. Découvrir l'absence au milieu du traitement d'un millier
de fichiers coûte tout le travail déjà fait.

À écrire : `trouver_ffmpeg`, `trouver_tesseract`, `capacites()` qui rend ce qui
est disponible, et les messages d'installation par système.
"""

"""Tout ce qui touche au monde extérieur : fichiers son et poids de modèles.

Ce dossier est le seul à importer numpy et le moteur TFLite. Une session sans
ces bibliothèques peut donc lancer toute la suite du `noyau/` — c'est ce qui
rend le projet vérifiable ailleurs que sur la machine qui l'a écrit.
"""

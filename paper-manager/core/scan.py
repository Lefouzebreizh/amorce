"""Module 1 — un fichier déposé devient quelque chose de lisible.

Trois entrées, une sortie : un PDF, une image, ou une photo prise au téléphone
deviennent soit du texte, soit une image redressée prête pour le lecteur.

Ce que fait ce module, et pourquoi :

- **Le texte déjà présent dans un PDF est pris tel quel.** Une facture
  téléchargée depuis un espace client contient son texte : la relire par
  reconnaissance optique, c'est payer et perdre en fiabilité pour rien.
- **Une page sans texte est rendue en image.** C'est le cas des scans et des
  photos ; le rendu se fait à 200 ppp, résolution en dessous de laquelle les
  petits caractères d'un pied de facture — les références client, précisément
  celles qui comptent — deviennent illisibles.
- **La photo est redressée et recadrée avant tout.** Un document photographié
  de travers, sur une table, se lit mal quel que soit le lecteur derrière.
- **Le document reste où il est.** Ce module ne déplace rien ; le déplacement
  est le travail de `nommage.py`, et seulement avec `--appliquer`.
"""

#!/usr/bin/env python3
"""Point d'entrée unique de Paper-Manager.

Un seul script pour les quatre modules, comme `kdp/kdp.py` : quatre commandes
séparées obligeraient à retenir quatre noms, et l'assistant existe précisément
pour ne rien avoir à retenir.

Sous-commandes prévues :

    classer   déposer, lire, nommer, ranger        (module 1)
    etat      le tableau de bord et les alertes     (module 3)
    agenda    les échéances vers un fichier .ics    (module 2)
    resilier  fabriquer le courrier                 (module 4)

Règle commune à toute commande qui touche au disque : elle **simule** par
défaut et n'agit qu'avec `--appliquer`. Un classement automatique dont on n'a
pas vu la sortie une première fois est un classement qu'on refera à la main.
"""

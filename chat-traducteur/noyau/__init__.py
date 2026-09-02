"""Noyau du traducteur de chat — bibliothèque standard pure.

Ni numpy, ni TFLite, ni fichier son n'entrent ici. C'est délibéré, et c'est la
même règle que le cœur de NexusCrypto : ce qui *décide* doit s'éprouver sur une
machine où rien n'est installé, sinon plus personne ne vérifie.

Les modèles vivent dans `adaptateurs/`, derrière une frontière étroite : ils
rendent des dictionnaires `étiquette -> score` et des listes de flottants. Le
noyau ne sait pas d'où ils viennent.
"""
